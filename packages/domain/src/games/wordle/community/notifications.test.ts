import { expect, it } from 'bun:test';
import { transitionDelivery } from './notifications';

it('keeps ambiguous deliveries for reconciliation instead of silently resending', () => {
  expect(transitionDelivery('pending', 'claim')).toBe('sending');
  expect(transitionDelivery('sending', 'confirmed')).toBe('delivered');
  expect(transitionDelivery('sending', 'ambiguous')).toBe('uncertain');
  expect(transitionDelivery('uncertain', 'claim')).toBeNull();
  expect(transitionDelivery('uncertain', 'found')).toBe('delivered');
  expect(transitionDelivery('uncertain', 'confirmed_absent')).toBe('pending');
  expect(transitionDelivery('delivered', 'claim')).toBeNull();
});
