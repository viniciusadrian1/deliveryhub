import { describe, expect, it } from 'vitest';

import {
  canTransition,
  InvalidTransitionError,
  reconcileFromPlatform,
  transition,
} from './order-status.js';

describe('order-status state machine', () => {
  describe('canTransition', () => {
    it('allows the happy path', () => {
      expect(canTransition('placed', 'accepted')).toBe(true);
      expect(canTransition('accepted', 'preparing')).toBe(true);
      expect(canTransition('preparing', 'ready')).toBe(true);
      expect(canTransition('ready', 'dispatched')).toBe(true);
      expect(canTransition('dispatched', 'delivered')).toBe(true);
    });

    it('allows cancel from non-terminal states', () => {
      for (const s of ['placed', 'accepted', 'preparing', 'ready', 'dispatched'] as const) {
        expect(canTransition(s, 'cancelled')).toBe(true);
      }
    });

    it('rejects going back', () => {
      expect(canTransition('accepted', 'placed')).toBe(false);
      expect(canTransition('preparing', 'accepted')).toBe(false);
    });

    it('rejects transitions out of terminal states', () => {
      expect(canTransition('delivered', 'cancelled')).toBe(false);
      expect(canTransition('cancelled', 'placed')).toBe(false);
    });
  });

  describe('transition (user-driven)', () => {
    it('is idempotent for same status', () => {
      expect(transition('placed', 'placed')).toBe('placed');
    });

    it('returns the new status on valid transition', () => {
      expect(transition('placed', 'accepted')).toBe('accepted');
    });

    it('throws on invalid transition', () => {
      expect(() => transition('delivered', 'accepted')).toThrow(InvalidTransitionError);
      expect(() => transition('placed', 'delivered')).toThrow(InvalidTransitionError);
    });
  });

  describe('reconcileFromPlatform (relaxed)', () => {
    it('accepts jumps forward (e.g., placed → dispatched)', () => {
      expect(reconcileFromPlatform('placed', 'dispatched')).toBe('dispatched');
      expect(reconcileFromPlatform('accepted', 'delivered')).toBe('delivered');
    });

    it('does not move out of terminal states', () => {
      expect(reconcileFromPlatform('delivered', 'cancelled')).toBe('delivered');
      expect(reconcileFromPlatform('cancelled', 'delivered')).toBe('cancelled');
    });

    it('returns same status on no change', () => {
      expect(reconcileFromPlatform('preparing', 'preparing')).toBe('preparing');
    });
  });
});
