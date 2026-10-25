// The dance machine's block arrow, pointing up and centred on the origin, about 88 px tall: [x0, y0, x1, y1, …].
// Shared by the 2D screen (PixiJS), the street cabinet's attract screen and its pad panels (canvas).

export const ARROW_POINTS: readonly number[] = [
  0, -44, 44, 0, 18, 0, 18, 42, -18, 42, -18, 0, -44, 0,
];

/** Traces the arrow as a closed path on a 2D canvas (the caller fills and strokes) */
export function traceArrow(g: CanvasRenderingContext2D): void {
  g.beginPath();
  g.moveTo(ARROW_POINTS[0]!, ARROW_POINTS[1]!);
  for (let i = 2; i < ARROW_POINTS.length; i += 2) g.lineTo(ARROW_POINTS[i]!, ARROW_POINTS[i + 1]!);
  g.closePath();
}
