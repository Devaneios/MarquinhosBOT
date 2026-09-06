import { describe, expect, it } from 'bun:test';
import i18next from '../../../i18n';
import { isKnownRuleset, presentationFor, seatLabel } from './presentation';

const t = i18next.t.bind(i18next);

describe('presentationFor truco-1v1', () => {
  it('is a known ruleset with its own title', () => {
    expect(isKnownRuleset('truco-1v1')).toBe(true);
    expect(presentationFor('truco-1v1', t).title).toBe('TRUCO 1X1');
  });

  it('labels only the two seats that exist, with no partner label', () => {
    const presentation = presentationFor('truco-1v1', t);
    expect(seatLabel(presentation, 0, t)).toBe('Você');
    expect(seatLabel(presentation, 1, t)).toBe('Adversário');
  });

  it('still labels moves the same way as 4-player truco', () => {
    const presentation = presentationFor('truco-1v1', t);
    expect(presentation.moveLabels?.call_truco).toBe('Pedir truco');
  });
});
