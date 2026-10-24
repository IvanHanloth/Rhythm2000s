import { describe, expect, it } from 'vite-plus/test';
import arrowDataUrl from '@assets/reference/windows-xp/icons/default_arrow.cur?inline';
import { decodeCur } from './cur-file.ts';

function bytesFromDataUrl(url: string): Uint8Array {
  const binary = atob(url.slice(url.indexOf(',') + 1));
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

describe('decodeCur', () => {
  const arrow = decodeCur(bytesFromDataUrl(arrowDataUrl));
  const alphaAt = (x: number, y: number) => arrow.rgba[(y * arrow.width + x) * 4 + 3];
  const rgbAt = (x: number, y: number) =>
    Array.from(arrow.rgba.slice((y * arrow.width + x) * 4, (y * arrow.width + x) * 4 + 3));

  it('reads the size and hotspot of the local XP arrow', () => {
    expect([arrow.width, arrow.height]).toEqual([32, 32]);
    expect(arrow.hotspot).toEqual({ x: 10, y: 10 });
  });

  it('the hotspot is the arrow tip: black outline, transparent outside, white inside', () => {
    expect(alphaAt(10, 10)).toBe(255);
    expect(rgbAt(10, 10)).toEqual([0, 0, 0]);
    expect(alphaAt(9, 10)).toBe(0);
    expect(alphaAt(10, 9)).toBe(0);
    expect(rgbAt(11, 12)).toEqual([255, 255, 255]);
  });

  it('throws for something that is not a cursor file', () => {
    expect(() => decodeCur(new Uint8Array(30))).toThrow('Not a .cur cursor file');
  });
});
