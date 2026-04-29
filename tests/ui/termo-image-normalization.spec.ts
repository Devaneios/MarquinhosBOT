import { normalizeKeyboardBuffer } from '@marquinhos/ui/screens/termo';
import { describe, expect, test } from 'bun:test';
import sharp from 'sharp';

describe('normalizeKeyboardBuffer', () => {
  test('outputs an opaque PNG and preserves dimensions', async () => {
    const rgba = Buffer.from([
      0, 0, 0, 0, 255, 0, 0, 128, 0, 255, 0, 255, 0, 0, 255, 0,
    ]);
    const input = await sharp(rgba, {
      raw: { width: 2, height: 2, channels: 4 },
    })
      .png()
      .toBuffer();

    const output = await normalizeKeyboardBuffer(input);
    const metadata = await sharp(output).metadata();

    expect(metadata.format).toBe('png');
    expect(metadata.width).toBe(2);
    expect(metadata.height).toBe(2);
    expect(metadata.channels).toBe(3);
    expect(metadata.hasAlpha).toBe(false);
  });
});
