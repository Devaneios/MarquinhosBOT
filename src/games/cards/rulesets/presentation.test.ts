import { describe, expect, it } from 'bun:test';
import { isKnownRuleset, presentationFor, seatLabel } from './presentation';

describe('presentationFor truco-1v1', () => {
  it('is a known ruleset with its own title', () => {
    expect(isKnownRuleset('truco-1v1')).toBe(true);
    expect(presentationFor('truco-1v1').title).toBe('TRUCO 1X1');
  });

  it('labels only the two seats that exist, with no partner label', () => {
    const presentation = presentationFor('truco-1v1');
    expect(seatLabel(presentation, 0)).toBe('Você');
    expect(seatLabel(presentation, 1)).toBe('Adversário');
  });

  it('still labels moves the same way as 4-player truco', () => {
    const presentation = presentationFor('truco-1v1');
    expect(presentation.moveLabels?.call_truco).toBe('Pedir truco');
  });
});
