// Decodes Windows cursor files (.cur): the first image as RGBA pixels plus its hotspot.
// The local XP pointers (assets/reference/windows-xp/icons/*.cur) are 1-bit images with a transparency mask,
// and PixiJS can't read .cur, so the pixels are decoded here. Supports 1/4/8/24/32-bit BMP data;
// the embedded-PNG format from Vista on is not used locally and throws.

export interface CursorImage {
  width: number;
  height: number;
  /** Hotspot: the pixel where the click happens */
  hotspot: { x: number; y: number };
  /** RGBA rows top to bottom, width × height × 4 long */
  rgba: Uint8ClampedArray<ArrayBuffer>;
}

export function decodeCur(bytes: Uint8Array): CursorImage {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const u16 = (offset: number) => view.getUint16(offset, true);
  const u32 = (offset: number) => view.getUint32(offset, true);

  if (bytes.length < 22 || u16(0) !== 0 || u16(2) !== 2 || u16(4) < 1) {
    throw new Error('Not a .cur cursor file');
  }
  // Directory entry: width, height (0 means 256), colours, reserved, hotspot x, hotspot y, data size, data offset
  const hotspot = { x: u16(10), y: u16(12) };
  const offset = u32(18);

  if (u32(offset) === 0x474e5089) throw new Error('Cursors with embedded PNG are not supported');
  const headerSize = u32(offset);
  const width = view.getInt32(offset + 4, true);
  // The BMP header's height covers both the image and the mask
  const height = view.getInt32(offset + 8, true) / 2;
  const bpp = u16(offset + 14);
  if (![1, 4, 8, 24, 32].includes(bpp)) throw new Error(`${bpp}-bit cursors are not supported`);

  const paletteSize = bpp <= 8 ? u32(offset + 32) || 1 << bpp : 0;
  const palette = offset + headerSize;
  const xorStart = palette + paletteSize * 4;
  const xorStride = Math.ceil((width * bpp) / 32) * 4;
  const andStart = xorStart + xorStride * height;
  const andStride = Math.ceil(width / 32) * 4;

  const rgba = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    // BMP rows are stored bottom up
    const xorRow = xorStart + (height - 1 - y) * xorStride;
    const andRow = andStart + (height - 1 - y) * andStride;
    for (let x = 0; x < width; x++) {
      const out = (y * width + x) * 4;
      const transparent = (bytes[andRow + (x >> 3)]! >> (7 - (x & 7))) & 1;
      let r: number;
      let g: number;
      let b: number;
      let a = 255;
      if (bpp <= 8) {
        const bitOffset = x * bpp;
        const byte = bytes[xorRow + (bitOffset >> 3)]!;
        const index = (byte >> (8 - bpp - (bitOffset & 7))) & ((1 << bpp) - 1);
        const entry = palette + index * 4;
        [b, g, r] = [bytes[entry]!, bytes[entry + 1]!, bytes[entry + 2]!];
      } else {
        const pixel = xorRow + x * (bpp / 8);
        [b, g, r] = [bytes[pixel]!, bytes[pixel + 1]!, bytes[pixel + 2]!];
        if (bpp === 32) a = bytes[pixel + 3]!;
      }
      // Mask bit 1 is transparent (with a non-black pixel the original inverts; treated as transparent here)
      if (transparent) a = 0;
      rgba.set([r, g, b, a], out);
    }
  }
  return { width, height, hotspot, rgba };
}
