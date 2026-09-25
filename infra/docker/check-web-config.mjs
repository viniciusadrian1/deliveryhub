import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

// Run before and after next build so missing build arguments fail the image build.
const configured = process.env.NEXT_PUBLIC_API_URL;
if (!configured || configured !== configured.trim()) {
  throw new Error('NEXT_PUBLIC_API_URL must be provided as a Docker build argument.');
}
const url = new URL(configured);
if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password ||
    url.search || url.hash || url.pathname !== '/') {
  throw new Error('NEXT_PUBLIC_API_URL must be an HTTP(S) origin, without credentials or /api.');
}

if (process.argv.includes('--built')) {
  function chunks(directory) {
    return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
      const path = join(directory, entry.name);
      return entry.isDirectory() ? chunks(path) : entry.name.endsWith('.js') ? [path] : [];
    });
  }
  const compiled = chunks('apps/web/.next/static/chunks').map((path) => readFileSync(path, 'utf8'));
  const apiChunks = compiled.filter((text) => text.includes('/api/auth/refresh'));
  const expected = configured.replace(/\/$/, '');
  if (!apiChunks.length || apiChunks.some((text) => !text.includes(expected) || text.includes('env.NEXT_PUBLIC_API_URL'))) {
    throw new Error('The browser API client does not contain the configured public API URL.');
  }
}
console.log('Public API configuration verified.');
