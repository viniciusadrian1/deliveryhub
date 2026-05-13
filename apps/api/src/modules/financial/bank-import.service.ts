import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';

import { AuditLogService } from '../../common/audit/audit-log.service.js';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import type { AuthContext } from '../../common/auth/auth-context.js';

export interface BankImportResult {
  parsed: number;
  inserted: number;
  duplicated: number;
  errors: Array<{ line: number; reason: string }>;
}

/**
 * Parser de CSV de extrato bancário. Aceita o formato comum dos bancos
 * brasileiros (Itaú/Bradesco/Nubank): colunas Data, Histórico, Valor,
 * separadas por `;` ou `,`. Detecta o separador automaticamente.
 *
 * Aceita data nos formatos `dd/mm/yyyy`, `yyyy-mm-dd`. Valor em pt-BR
 * (`1.234,56`) ou en-US (`1234.56`). Sinais positivos/negativos respeitados.
 */
@Injectable()
export class BankImportService {
  private readonly logger = new Logger(BankImportService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogService,
  ) {}

  async importCsv(auth: AuthContext, storeId: string, csv: string): Promise<BankImportResult> {
    await this.assertStore(auth.orgId, storeId);

    const parsed = this.parseCsv(csv);
    if (parsed.rows.length === 0 && parsed.errors.length > 0) {
      throw new BadRequestException({
        message: 'csv_unparseable',
        issues: parsed.errors.slice(0, 5),
      });
    }

    let inserted = 0;
    let duplicated = 0;

    for (const row of parsed.rows) {
      try {
        await this.prisma.bankTransaction.create({
          data: {
            organizationId: auth.orgId,
            storeId,
            date: row.date,
            amountCents: row.amountCents,
            description: row.description.slice(0, 200),
            raw: row.raw as never,
          },
        });
        inserted++;
      } catch (err) {
        const code = (err as { code?: string }).code;
        if (code === 'P2002') {
          duplicated++;
        } else {
          this.logger.error({ err, row }, 'bank_import_row_failed');
          parsed.errors.push({ line: row.line, reason: 'db_error' });
        }
      }
    }

    await this.audit.record({
      organizationId: auth.orgId,
      userId: auth.userId,
      entity: 'bank_transaction',
      action: 'create',
      diff: { imported: inserted, duplicated, parsed: parsed.rows.length },
    });

    return {
      parsed: parsed.rows.length,
      inserted,
      duplicated,
      errors: parsed.errors,
    };
  }

  // ---------- parser ----------

  private parseCsv(text: string): {
    rows: Array<{ line: number; date: Date; amountCents: bigint; description: string; raw: Record<string, string> }>;
    errors: Array<{ line: number; reason: string }>;
  } {
    // Remove BOM (U+FEFF) que muitos exports CSV brasileiros incluem.
    const cleaned = text.replace(/^\uFEFF/, '').trim();
    if (!cleaned) return { rows: [], errors: [{ line: 0, reason: 'empty_csv' }] };

    const lines = cleaned.split(/\r?\n/);
    if (lines.length < 2) return { rows: [], errors: [{ line: 0, reason: 'no_data_lines' }] };

    const separator = this.detectSeparator(lines[0] ?? '');
    const header = this.splitLine(lines[0] ?? '', separator).map((s) => s.toLowerCase().trim());

    const dateIdx = header.findIndex((h) => /data|date/.test(h));
    const descIdx = header.findIndex((h) => /hist[oó]rico|descri|memo|description/i.test(h));
    const amountIdx = header.findIndex((h) => /valor|amount|montante/.test(h));

    if (dateIdx < 0 || descIdx < 0 || amountIdx < 0) {
      return {
        rows: [],
        errors: [{ line: 1, reason: `missing_columns:date=${dateIdx},desc=${descIdx},amount=${amountIdx}` }],
      };
    }

    const rows: ReturnType<BankImportService['parseCsv']>['rows'] = [];
    const errors: Array<{ line: number; reason: string }> = [];

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i]?.trim();
      if (!line) continue;
      const parts = this.splitLine(line, separator);
      if (parts.length < Math.max(dateIdx, descIdx, amountIdx) + 1) {
        errors.push({ line: i + 1, reason: 'too_few_columns' });
        continue;
      }

      try {
        const date = this.parseDate(parts[dateIdx]!);
        const amountCents = this.parseAmountCents(parts[amountIdx]!);
        const description = parts[descIdx]!.trim();
        const raw: Record<string, string> = {};
        header.forEach((h, idx) => {
          raw[h] = parts[idx] ?? '';
        });
        rows.push({ line: i + 1, date, amountCents, description, raw });
      } catch (err) {
        errors.push({
          line: i + 1,
          reason: err instanceof Error ? err.message : 'parse_error',
        });
      }
    }

    return { rows, errors };
  }

  private detectSeparator(header: string): string {
    const semi = (header.match(/;/g) ?? []).length;
    const comma = (header.match(/,/g) ?? []).length;
    return semi > comma ? ';' : ',';
  }

  private splitLine(line: string, sep: string): string[] {
    // CSV simples — não cobre aspas com sep embutido, suficiente pro MVP.
    return line.split(sep).map((p) => p.trim().replace(/^"|"$/g, ''));
  }

  private parseDate(raw: string): Date {
    const trimmed = raw.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      return new Date(`${trimmed}T00:00:00Z`);
    }
    const m = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
    if (m) {
      const [, d, mo, y] = m;
      const year = y!.length === 2 ? `20${y}` : y;
      return new Date(`${year}-${mo!.padStart(2, '0')}-${d!.padStart(2, '0')}T00:00:00Z`);
    }
    throw new Error(`invalid_date:${raw}`);
  }

  private parseAmountCents(raw: string): bigint {
    // Remove R$, espaços e separadores de milhar; troca vírgula decimal por ponto.
    const cleaned = raw
      .replace(/[Rr]\$/g, '')
      .replace(/\s+/g, '')
      .replace(/\./g, '')
      .replace(/,/, '.');
    const value = Number(cleaned);
    if (!Number.isFinite(value)) throw new Error(`invalid_amount:${raw}`);
    return BigInt(Math.round(value * 100));
  }

  // ---------- helpers ----------

  private async assertStore(orgId: string, storeId: string): Promise<void> {
    const store = await this.prisma.store.findFirst({
      where: { id: storeId, organizationId: orgId },
      select: { id: true },
    });
    if (!store) throw new NotFoundException('store_not_found');
  }
}
