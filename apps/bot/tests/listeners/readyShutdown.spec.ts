import { stopReadySchedulers } from '@marquinhos/listeners/ready';
import { describe, expect, it } from 'bun:test';

describe('ReadyListener scheduler lifecycle', () => {
  it('exposes an idempotent stopReadySchedulers cleanup hook', () => {
    expect(() => {
      stopReadySchedulers();
      stopReadySchedulers();
    }).not.toThrow();
  });
});
