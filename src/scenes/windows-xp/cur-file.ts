// 解码 Windows 光标文件（.cur）：取第一张图，转成 RGBA 像素和热点。
// 本地的 XP 指针（assets/reference/windows-xp/icons/*.cur）是 1 位黑白图 + 透明遮罩，
// PixiJS 不认 .cur，所以自己解出像素再做成纹理。支持 1/4/8/24/32 位的 BMP 格式；
// Vista 以后才有的「内嵌 PNG」格式本地没有，遇到时报错。

export interface CursorImage {
  width: number;
  height: number;
  /** 热点：点击发生在图里的哪个像素 */
  hotspot: { x: number; y: number };
  /** 逐行从上到下的 RGBA，长度 width × height × 4 */
  rgba: Uint8ClampedArray<ArrayBuffer>;
}

export function decodeCur(bytes: Uint8Array): CursorImage {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const u16 = (offset: number) => view.getUint16(offset, true);
  const u32 = (offset: number) => view.getUint32(offset, true);

  if (bytes.length < 22 || u16(0) !== 0 || u16(2) !== 2 || u16(4) < 1) {
    throw new Error('不是 .cur 光标文件');
  }
  // 目录项：宽、高（0 表示 256）、颜色数、保留、热点 x、热点 y、数据大小、数据偏移
  const hotspot = { x: u16(10), y: u16(12) };
  const offset = u32(18);

  if (u32(offset) === 0x474e5089) throw new Error('暂不支持内嵌 PNG 的光标');
  const headerSize = u32(offset);
  const width = view.getInt32(offset + 4, true);
  // BMP 头里的高度是「图像 + 透明遮罩」两份的高度
  const height = view.getInt32(offset + 8, true) / 2;
  const bpp = u16(offset + 14);
  if (![1, 4, 8, 24, 32].includes(bpp)) throw new Error(`不支持 ${bpp} 位色的光标`);

  const paletteSize = bpp <= 8 ? u32(offset + 32) || 1 << bpp : 0;
  const palette = offset + headerSize;
  const xorStart = palette + paletteSize * 4;
  const xorStride = Math.ceil((width * bpp) / 32) * 4;
  const andStart = xorStart + xorStride * height;
  const andStride = Math.ceil(width / 32) * 4;

  const rgba = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    // BMP 的行从下往上存
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
      // 遮罩为 1 的像素透明（遮罩为 1 且图像不是黑色时原版是「反色」，这里也当透明）
      if (transparent) a = 0;
      rgba.set([r, g, b, a], out);
    }
  }
  return { width, height, hotspot, rgba };
}
