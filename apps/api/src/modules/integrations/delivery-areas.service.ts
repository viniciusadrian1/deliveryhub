import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { DidifoodAdapter } from '@deliveryhub/didifood';

import { PrismaService } from '../../common/prisma/prisma.service.js';
import type { AuthContext } from '../../common/auth/auth-context.js';
import { AdapterRegistry } from './adapter.registry.js';
import type { CreateDeliveryAreaInput } from './dto/delivery-area.dto.js';
import { IntegrationsService } from './integrations.service.js';

/**
 * Áreas de entrega (Logistics API do 99Food). A loja define raio/polígono
 * de cobertura, preço e janelas de horário — gerenciado direto na
 * plataforma; aqui só intermediamos.
 */
@Injectable()
export class DeliveryAreasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly registry: AdapterRegistry,
    private readonly integrations: IntegrationsService,
  ) {}

  /** Resolve o adapter 99Food + tokens da conexão ativa da loja. */
  private async resolve(organizationId: string, storeId: string) {
    const platform = await this.prisma.platform.findUnique({
      where: { code: '99food' },
    });
    if (!platform) throw new NotFoundException('platform_not_found');

    const conn = await this.integrations.getActiveConnectionWithTokens(
      organizationId,
      storeId,
      platform.id,
    );
    if (!conn) throw new BadRequestException('no_active_99food_connection');

    const adapter = this.registry.get('99food');
    if (!(adapter instanceof DidifoodAdapter)) {
      throw new BadRequestException('delivery_areas_unsupported');
    }
    return { adapter, tokens: conn.tokens };
  }

  async list(auth: AuthContext, storeId: string) {
    const { adapter, tokens } = await this.resolve(auth.orgId, storeId);
    return adapter.getDeliveryAreas(tokens);
  }

  async add(auth: AuthContext, storeId: string, input: CreateDeliveryAreaInput) {
    const { adapter, tokens } = await this.resolve(auth.orgId, storeId);
    await adapter.addDeliveryArea(tokens, input);
    return adapter.getDeliveryAreas(tokens);
  }

  async remove(auth: AuthContext, storeId: string, areaIds: string[]) {
    const { adapter, tokens } = await this.resolve(auth.orgId, storeId);
    await adapter.deleteDeliveryArea(tokens, areaIds);
    return adapter.getDeliveryAreas(tokens);
  }
}
