import { describe, expect, it } from 'vitest';

import { DidifoodAdapter } from './didifood.adapter.js';

describe('DidifoodAdapter', () => {
  const config = {
    clientId: '5764607734245230543',
    clientSecret: '0b9b6354bcb50ede0854139b97750a5f',
    apiBaseUrl: 'https://openapi.99food.com',
    webhookSecret: '0b9b6354bcb50ede0854139b97750a5f',
  };

  it('verifica assinatura de webhook MD5 com sucesso', () => {
    const adapter = new DidifoodAdapter(config);
    const rawBody = Buffer.from(JSON.stringify({ type: 'orderNew', order_id: 123456789 }));
    const crypto = require('crypto');
    const expected = crypto
      .createHash('md5')
      .update(Buffer.concat([rawBody, Buffer.from(config.webhookSecret, 'utf8')]))
      .digest('hex');

    const valid = adapter.verifyWebhookSignature({ 'didi-header-sign': expected }, rawBody);
    expect(valid).toBe(true);
  });

  it('rejeita assinatura inválida', () => {
    const adapter = new DidifoodAdapter(config);
    const rawBody = Buffer.from(JSON.stringify({ type: 'orderNew' }));
    const valid = adapter.verifyWebhookSignature({ 'didi-header-sign': 'invalido' }, rawBody);
    expect(valid).toBe(false);
  });

  it('parseWebhook extrai externalOrderId de 64-bit corretamente', () => {
    const adapter = new DidifoodAdapter(config);
    const rawBody = Buffer.from(
      '{"type":"orderNew","data":{"order_id":5764615586765604533},"app_shop_id":"1234"}',
    );
    const parsed = adapter.parseWebhook(
      { type: 'orderNew', app_shop_id: '1234' },
      rawBody,
    );
    expect(parsed.externalOrderId).toBe('5764615586765604533');
    expect(parsed.externalMerchantId).toBe('1234');
    expect(parsed.eventType).toBe('orderNew');
  });
});
