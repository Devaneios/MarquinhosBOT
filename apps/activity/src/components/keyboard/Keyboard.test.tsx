import { fireEvent, render } from '@testing-library/react';
import { describe, expect, it, mock } from 'bun:test';
import { Keyboard } from './Keyboard';
import type { KeyboardKey, KeyboardKeyStyle } from './types';

const CORRECT_STYLE: KeyboardKeyStyle = {
  bg: '#6aaa64',
  text: '#ffffff',
  base: ['#6aaa64', '#538d4e'],
  cap: ['#6aaa64', '#538d4e'],
  surface: ['#538d4e', '#6aaa64'],
};

function buildRows(overrides?: Partial<KeyboardKey>[]): KeyboardKey[][] {
  return [
    [
      { id: 'q', label: 'Q' },
      { id: 'w', label: 'W', ...(overrides?.[0] ?? {}) },
    ],
    [
      { id: 'a', label: 'A' },
      { id: 'Backspace', label: '⌫', variant: 'medium' },
      { id: 'Enter', label: 'Enter', variant: 'wide' },
    ],
  ];
}

describe('Keyboard', () => {
  it('renders one key button per key id with the layered keycap markup', () => {
    const { container } = render(
      <Keyboard
        rows={buildRows()}
        pressedKeys={new Set()}
        disabled={false}
        onKey={() => {}}
      />,
    );

    const buttons = container.querySelectorAll('.hg-button');
    expect(buttons.length).toBe(5);

    const qButton = Array.from(buttons).find((el) =>
      el.querySelector('.keycap-text')?.textContent?.includes('Q'),
    );
    expect(qButton).toBeTruthy();
    expect(qButton?.querySelector('.keycap-cap')).toBeTruthy();
    expect(qButton?.classList.contains('keycap')).toBe(true);
  });

  it('maps Backspace/Enter to library tokens and applies medium/wide variant classes', () => {
    const { container } = render(
      <Keyboard
        rows={buildRows()}
        pressedKeys={new Set()}
        disabled={false}
        onKey={() => {}}
      />,
    );

    expect(container.querySelector('.keycap-medium')).toBeTruthy();
    expect(container.querySelector('.keycap-wide')).toBeTruthy();
  });

  it('calls onKey with the original key id when a letter is clicked', () => {
    const onKey = mock(() => {});
    const { container } = render(
      <Keyboard
        rows={buildRows()}
        pressedKeys={new Set()}
        disabled={false}
        onKey={onKey}
      />,
    );

    const qButton = Array.from(container.querySelectorAll('.hg-button')).find(
      (el) => el.querySelector('.keycap-text')?.textContent === 'Q',
    ) as HTMLElement;
    fireEvent.pointerDown(qButton);

    expect(onKey).toHaveBeenCalledWith('q');
  });

  it('plays a configured key sound when an enabled key is clicked', () => {
    const play = mock(() => Promise.resolve());
    const sources: string[] = [];
    const originalAudio = Object.getOwnPropertyDescriptor(globalThis, 'Audio');

    class TestAudio {
      constructor(src: string) {
        sources.push(src);
      }

      play = play;
    }

    Object.defineProperty(globalThis, 'Audio', {
      configurable: true,
      value: TestAudio,
    });

    try {
      const { container } = render(
        <Keyboard
          rows={buildRows([{ sound: '/keypress.ogg' }])}
          pressedKeys={new Set()}
          disabled={false}
          onKey={() => {}}
        />,
      );
      const wButton = Array.from(container.querySelectorAll('.hg-button')).find(
        (el) => el.querySelector('.keycap-text')?.textContent === 'W',
      ) as HTMLElement;

      fireEvent.pointerDown(wButton);

      expect(sources).toEqual(['/keypress.ogg']);
      expect(play).toHaveBeenCalledTimes(1);
    } finally {
      if (originalAudio) {
        Object.defineProperty(globalThis, 'Audio', originalAudio);
      } else {
        Reflect.deleteProperty(globalThis, 'Audio');
      }
    }
  });

  it('does not create audio for a key without a configured sound', () => {
    const onKey = mock(() => {});
    const originalAudio = Object.getOwnPropertyDescriptor(globalThis, 'Audio');

    class ThrowingAudio {
      constructor() {
        throw new Error('silent keys must not create audio');
      }
    }

    Object.defineProperty(globalThis, 'Audio', {
      configurable: true,
      value: ThrowingAudio,
    });

    try {
      const { container } = render(
        <Keyboard
          rows={buildRows()}
          pressedKeys={new Set()}
          disabled={false}
          onKey={onKey}
        />,
      );
      const qButton = Array.from(container.querySelectorAll('.hg-button')).find(
        (element) => element.textContent?.includes('Q'),
      );
      if (!qButton) throw new Error('Expected the Q key to render');

      fireEvent.pointerDown(qButton);

      expect(onKey).toHaveBeenCalledWith('q');
    } finally {
      if (originalAudio) {
        Object.defineProperty(globalThis, 'Audio', originalAudio);
      } else {
        Reflect.deleteProperty(globalThis, 'Audio');
      }
    }
  });

  it('translates the {bksp}/{enter} tokens back to Backspace/Enter on click', () => {
    const onKey = mock(() => {});
    const { container } = render(
      <Keyboard
        rows={buildRows()}
        pressedKeys={new Set()}
        disabled={false}
        onKey={onKey}
      />,
    );

    const enterButton = Array.from(
      container.querySelectorAll('.hg-button'),
    ).find((el) => el.querySelector('.keycap-text')?.textContent === 'Enter');
    fireEvent.pointerDown(enterButton as HTMLElement);

    expect(onKey).toHaveBeenCalledWith('Enter');
  });

  it('does not call onKey when disabled', () => {
    const onKey = mock(() => {});
    const originalAudio = Object.getOwnPropertyDescriptor(globalThis, 'Audio');

    class ThrowingAudio {
      constructor() {
        throw new Error('disabled keys must not play audio');
      }
    }

    Object.defineProperty(globalThis, 'Audio', {
      configurable: true,
      value: ThrowingAudio,
    });

    try {
      const { container } = render(
        <Keyboard
          rows={buildRows([{ sound: '/keypress.ogg' }])}
          pressedKeys={new Set()}
          disabled={true}
          onKey={onKey}
        />,
      );

      const wButton = Array.from(container.querySelectorAll('.hg-button')).find(
        (el) => el.querySelector('.keycap-text')?.textContent === 'W',
      ) as HTMLElement;
      fireEvent.pointerDown(wButton);

      expect(onKey).not.toHaveBeenCalled();
      expect(container.querySelector('.keyboard-disabled')).toBeTruthy();
    } finally {
      if (originalAudio) {
        Object.defineProperty(globalThis, 'Audio', originalAudio);
      } else {
        Reflect.deleteProperty(globalThis, 'Audio');
      }
    }
  });

  it('applies the keycap-pressed class only to keys in pressedKeys', () => {
    const { container } = render(
      <Keyboard
        rows={buildRows()}
        pressedKeys={new Set(['q'])}
        disabled={false}
        onKey={() => {}}
      />,
    );

    const qButton = Array.from(container.querySelectorAll('.hg-button')).find(
      (el) => el.querySelector('.keycap-text')?.textContent === 'Q',
    );
    const wButton = Array.from(container.querySelectorAll('.hg-button')).find(
      (el) => el.querySelector('.keycap-text')?.textContent === 'W',
    );

    expect(qButton?.classList.contains('keycap-pressed')).toBe(true);
    expect(wButton?.classList.contains('keycap-pressed')).toBe(false);
  });

  it('sets a data-preview attribute with the key label on plain letter keys', () => {
    const { container } = render(
      <Keyboard
        rows={buildRows()}
        pressedKeys={new Set()}
        disabled={false}
        onKey={() => {}}
      />,
    );

    const qButton = Array.from(container.querySelectorAll('.hg-button')).find(
      (el) => el.querySelector('.keycap-text')?.textContent === 'Q',
    ) as HTMLElement;
    expect(qButton.getAttribute('data-preview')).toBe('Q');
  });

  it('does not set a data-preview attribute on Backspace/Enter', () => {
    const { container } = render(
      <Keyboard
        rows={buildRows()}
        pressedKeys={new Set()}
        disabled={false}
        onKey={() => {}}
      />,
    );

    const enterButton = Array.from(
      container.querySelectorAll('.hg-button'),
    ).find((el) => el.querySelector('.keycap-text')?.textContent === 'Enter');
    const backspaceButton = Array.from(
      container.querySelectorAll('.hg-button'),
    ).find((el) => el.querySelector('.keycap-text')?.textContent === '⌫');

    expect(enterButton?.hasAttribute('data-preview')).toBe(false);
    expect(backspaceButton?.hasAttribute('data-preview')).toBe(false);
  });

  it('applies per-key style as inline CSS custom properties', () => {
    const rows = buildRows([{ style: CORRECT_STYLE }]);
    const { container } = render(
      <Keyboard
        rows={rows}
        pressedKeys={new Set()}
        disabled={false}
        onKey={() => {}}
      />,
    );

    const wButton = Array.from(container.querySelectorAll('.hg-button')).find(
      (el) => el.querySelector('.keycap-text')?.textContent === 'W',
    ) as HTMLElement;

    expect(wButton.style.getPropertyValue('--base-from')).toBe('#6aaa64');
    expect(wButton.style.getPropertyValue('--key-text')).toBe('#ffffff');
  });
});
