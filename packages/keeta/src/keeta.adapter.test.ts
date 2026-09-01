import { describe, expect, it } from 'vitest';

import { signKeeta } from './keeta.adapter.js';

// Assinatura `sig` da Standard API: sha256(URL + '?' + params_ordenados + appSecret).
// É o que autentica TODA request — se quebrar, nenhuma chamada passa. Um check.
describe('signKeeta', () => {
  const url = 'https://open.mykeeta.com/api/open/order/get';
  const params = { appId: '3084446411', timestamp: '1700000000', accessToken: 'tok' };

  it('bate com o vetor conhecido (SHA-256 hex minúsculo)', () => {
    expect(signKeeta(url, params, 'SEKRET')).toBe(
      'fdb0c75a74946eb58dbfcd5ebe6b7f42a9a12f4302c697e750de9691277e6965',
    );
  });

  it('ordena os params (independe da ordem de inserção)', () => {
    const shuffled = { accessToken: 'tok', timestamp: '1700000000', appId: '3084446411' };
    expect(signKeeta(url, shuffled, 'SEKRET')).toBe(signKeeta(url, params, 'SEKRET'));
  });

  it('nunca inclui o próprio `sig` no cálculo', () => {
    expect(signKeeta(url, { ...params, sig: 'qualquer' }, 'SEKRET')).toBe(
      signKeeta(url, params, 'SEKRET'),
    );
  });

  it('muda com o appSecret (o segredo importa)', () => {
    expect(signKeeta(url, params, 'A')).not.toBe(signKeeta(url, params, 'B'));
  });
});
