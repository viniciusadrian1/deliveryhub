import { describe, expect, it } from 'vitest';

import { buildShopListRequestBody, signParams } from './didifood.adapter.js';

describe('99Food signed store-list payload', () => {
  it('keeps app_id and timestamp as strings in JSON', () => {
    const body = JSON.parse(
      buildShopListRequestBody('5764607734245230543', 'secret', '1790280577'),
    ) as Record<string, unknown>;

    expect(typeof body.app_id).toBe('string');
    expect(typeof body.timestamp).toBe('string');
    expect(body.page_no).toBe(1);
    expect(body.page_size).toBe(30);
    expect(body.sign).toBe(
      signParams(
        {
          app_id: '5764607734245230543',
          timestamp: '1790280577',
          page_no: 1,
          page_size: 30,
        },
        'secret',
      ),
    );
  });
});
