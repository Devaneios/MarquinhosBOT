import { describe, expect, it } from 'bun:test';
import {
  GREETING_POOL,
  isGreeting,
  pickGreeting,
} from '@marquinhos/services/aiChat/greeting';

describe('isGreeting', () => {
  it('detects a plain "oi"', () => {
    expect(isGreeting('oi')).toBe(true);
  });

  it('detects "bom dia" with extra text after', () => {
    expect(isGreeting('bom dia pessoal')).toBe(true);
  });

  it('detects a greeting after a stripped mention', () => {
    expect(isGreeting('<@123456789> oi tudo bem?')).toBe(true);
  });

  it('does not treat a real question as a greeting', () => {
    expect(isGreeting('qual a capital do brasil?')).toBe(false);
  });
});

describe('pickGreeting', () => {
  it('always returns a value from the greeting pool', () => {
    expect(GREETING_POOL).toContain(pickGreeting());
  });
});
