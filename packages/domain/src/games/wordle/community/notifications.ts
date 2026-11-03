export type DeliveryState = 'pending' | 'sending' | 'delivered' | 'uncertain';
export type DeliveryEvent =
  'claim' | 'confirmed' | 'ambiguous' | 'found' | 'confirmed_absent';

export function transitionDelivery(
  state: DeliveryState,
  event: DeliveryEvent,
): DeliveryState | null {
  if (state === 'pending' && event === 'claim') return 'sending';
  if (state === 'sending' && event === 'confirmed') return 'delivered';
  if (state === 'sending' && event === 'ambiguous') return 'uncertain';
  if (state === 'uncertain' && event === 'found') return 'delivered';
  if (state === 'uncertain' && event === 'confirmed_absent') return 'pending';
  return null;
}
