'use client';

import { ImagePlus, Loader2, Trash2, Upload } from 'lucide-react';
import { useRef, useState } from 'react';

import { API_BASE_URL } from '../../lib/api';
import { readTokens } from '../../lib/tokens';

interface ImageUploadProps {
  /** URL atual da imagem (preview). Null/undefined = sem imagem. */
  value: string | null | undefined;
  /** Callback quando upload terminar OU usuário remover. */
  onChange: (url: string | null) => void;
  /** Label/legend opcional. */
  label?: string;
  /** Tamanho máximo aceito (default: 5 MB). */
  maxBytes?: number;
}

const DEFAULT_MAX = 5 * 1024 * 1024;
const ACCEPTED = 'image/jpeg,image/png,image/webp,image/gif';

/**
 * Upload de imagem com preview + drag&drop + estado de erro.
 *
 * Faz multipart POST direto pro endpoint `/api/uploads/image`. Auth via
 * o JWT atual (mesma chave que o api client usa). Devolve a URL pública.
 *
 * Quando o backend não tem storage configurado, mostra o erro inline com
 * link pra documentação interna.
 */
export function ImageUpload({
  value,
  onChange,
  label = 'Imagem',
  maxBytes = DEFAULT_MAX,
}: ImageUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  async function upload(file: File) {
    setError(null);

    if (!ACCEPTED.split(',').includes(file.type)) {
      setError(`Tipo não suportado (${file.type || 'desconhecido'}). Use JPEG, PNG, WebP ou GIF.`);
      return;
    }
    if (file.size > maxBytes) {
      setError(`Arquivo grande demais. Máximo ${Math.round(maxBytes / (1024 * 1024))} MB.`);
      return;
    }

    const tokens = readTokens();
    if (!tokens) {
      setError('Sessão expirada. Faça login novamente.');
      return;
    }

    setUploading(true);
    setProgress(0);
    try {
      const formData = new FormData();
      formData.append('file', file);

      // XHR pra ter progresso real (fetch não dá granular sem ReadableStream).
      const url: string = await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', `${API_BASE_URL}/api/uploads/image`);
        xhr.setRequestHeader('Authorization', `Bearer ${tokens.accessToken}`);
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            setProgress(Math.round((e.loaded / e.total) * 100));
          }
        };
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              const body = JSON.parse(xhr.responseText) as { url: string };
              resolve(body.url);
            } catch {
              reject(new Error('invalid_response'));
            }
          } else {
            // Tenta extrair mensagem do erro
            try {
              const body = JSON.parse(xhr.responseText) as {
                message?: string | { message?: string; code?: string };
              };
              const msg =
                typeof body.message === 'string'
                  ? body.message
                  : body.message?.message ?? `Falha ${xhr.status}`;
              reject(new Error(msg));
            } catch {
              reject(new Error(`upload_failed_${xhr.status}`));
            }
          }
        };
        xhr.onerror = () => reject(new Error('network_error'));
        xhr.send(formData);
      });

      onChange(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'erro_desconhecido');
    } finally {
      setUploading(false);
      setProgress(0);
    }
  }

  function onFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) void upload(file);
    e.target.value = '';
  }

  function onDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) void upload(file);
  }

  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium uppercase tracking-wider text-ink-secondary">
        {label}
      </label>

      {value ? (
        <div className="relative overflow-hidden rounded-lg border border-surface-border-subtle bg-surface-base">
          <div className="relative aspect-[16/9] w-full bg-surface-base">
            <img
              src={value}
              alt="Pré-visualização"
              className="absolute inset-0 h-full w-full object-cover"
            />
          </div>
          <div className="flex items-center justify-between border-t border-surface-border-subtle bg-surface-raised/80 px-3 py-2 backdrop-blur">
            <p className="truncate text-[11px] text-ink-tertiary" title={value}>
              {extractFilename(value)}
            </p>
            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="rounded-md p-1.5 text-ink-tertiary hover:bg-surface-overlay hover:text-ink-primary"
                aria-label="Trocar imagem"
                disabled={uploading}
              >
                <Upload className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => onChange(null)}
                className="rounded-md p-1.5 text-ink-tertiary hover:bg-danger-soft hover:text-danger-bright"
                aria-label="Remover imagem"
                disabled={uploading}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div
          onClick={() => !uploading && inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          className={`flex aspect-[16/9] cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed bg-surface-base transition-all ${
            dragOver
              ? 'border-brand-500 bg-brand-500/5'
              : 'border-surface-border hover:border-surface-border-strong'
          } ${uploading ? 'pointer-events-none opacity-70' : ''}`}
        >
          {uploading ? (
            <>
              <Loader2 className="h-6 w-6 animate-spin text-brand-500" />
              <p className="text-xs text-ink-secondary">Enviando… {progress}%</p>
            </>
          ) : (
            <>
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-500/10 text-brand-500">
                <ImagePlus className="h-5 w-5" />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium text-ink-primary">
                  Clique ou arraste a foto aqui
                </p>
                <p className="mt-0.5 text-[11px] text-ink-tertiary">
                  JPEG, PNG, WebP, GIF até {Math.round(maxBytes / (1024 * 1024))} MB
                </p>
              </div>
            </>
          )}
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED}
        onChange={onFileSelected}
        className="hidden"
      />

      {error && (
        <p className="rounded-md border border-danger/30 bg-danger-soft px-3 py-2 text-xs text-danger-bright">
          {translateUploadError(error)}
        </p>
      )}
    </div>
  );
}

function extractFilename(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.pathname.split('/').pop() ?? url;
  } catch {
    return url;
  }
}

function translateUploadError(message: string): string {
  if (message.includes('storage_not_configured'))
    return 'Storage não está configurado no servidor (R2/S3). Pergunta pro admin preencher as variáveis STORAGE_* e reiniciar.';
  if (message.includes('storage_upload_failed'))
    return 'Falha ao enviar o arquivo para o storage. Tente novamente em alguns segundos.';
  if (message.includes('unsupported_mime_type'))
    return 'Tipo de arquivo não suportado. Use JPEG, PNG, WebP ou GIF.';
  if (message.includes('file_too_large')) return 'Arquivo grande demais (máx. 5 MB).';
  if (message.includes('Unauthorized') || message.includes('401'))
    return 'Sessão expirada. Faça login novamente.';
  return message;
}
