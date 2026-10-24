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

  it('读出本地 XP 箭头的尺寸和热点', () => {
    expect([arrow.width, arrow.height]).toEqual([32, 32]);
    expect(arrow.hotspot).toEqual({ x: 10, y: 10 });
  });

  it('热点就是箭头尖：黑色描边，外面透明，里面白色', () => {
    expect(alphaAt(10, 10)).toBe(255);
    expect(rgbAt(10, 10)).toEqual([0, 0, 0]);
    expect(alphaAt(9, 10)).toBe(0);
    expect(alphaAt(10, 9)).toBe(0);
    expect(rgbAt(11, 12)).toEqual([255, 255, 255]);
  });

  it('不是光标文件时报错', () => {
    expect(() => decodeCur(new Uint8Array(30))).toThrow('不是 .cur 光标文件');
  });
});
