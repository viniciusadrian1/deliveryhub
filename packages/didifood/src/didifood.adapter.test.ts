import { describe, expect, it } from 'vitest';

import {
  buildShopListRequestBody,
  extractBoundShopIds,
  extractBoundShopIdsFromRaw,
  signParams,
} from './didifood.adapter.js';

describe('99Food signed store-list payload', () => {
  it('emits app_id as a numeric token and keeps timestamp textual', () => {
    const body = JSON.parse(
      buildShopListRequestBody('5764607734245230543', 'secret', '1790280577'),
    ) as Record<string, unknown>;

    expect(typeof body.app_id).toBe('number');
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

  it('supports both 99Food store-list response field names', () => {
    // The adapter receives the response `data` object. The primary endpoint
    // uses `shop_list`; the authorization fallback uses `shops`.
    expect(extractBoundShopIds({ shop_list: [{ app_shop_id: 'shop-primary' }] })).toEqual([
      'shop-primary',
    ]);
    expect(extractBoundShopIds({ shops: [{ app_shop_id: 'shop-fallback' }] })).toEqual([
      'shop-fallback',
    ]);
  });

  it('preserves long shop_id values from the raw authorized-shops response', () => {
    expect(
      extractBoundShopIdsFromRaw(
        '{"data":{"shops":[{"shop_id":1234567890123456789,"bound_flag":1}]}}',
      ),
    ).toEqual(['1234567890123456789']);
    expect(
      extractBoundShopIdsFromRaw(
        '{"data":{"shop_list":[{"app_shop_id":"shop-primary"}]}}',
      ),
    ).toEqual(['shop-primary']);
  });
});
