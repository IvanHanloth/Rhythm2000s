// Finder 列表视图：17 像素高的列标题（白色渐变，排序所在的列是浅蓝果冻并带小三角），
// 下面一行一项，选中行蓝底白字。左上角在 (0, 0)。

import { Container, Graphics, type Text } from 'pixi.js';
import { AQUA } from '../../../theme/aqua.ts';
import { aquaText, vGradient } from './paint.ts';

const HEADER_HEIGHT = 17;
export const LIST_ROW_HEIGHT = 20;
const PADDING_X = 6;
const ICON_SIZE = 16;

export interface ListColumn {
  title: string;
  width: number;
  align?: 'left' | 'right';
}

export interface ListRow {
  cells: string[];
  /** 第一列文字前的小图标，左上角在 (0, 0)、边长 16 */
  icon?: Container;
}

interface RowView {
  highlight: Graphics;
  texts: Text[];
}

export class AquaListView {
  readonly view = new Container({ label: 'list-view' });
  private readonly rows: RowView[] = [];
  private selected = -1;

  constructor(columns: readonly ListColumn[], rows: readonly ListRow[], sortColumn = 0) {
    const width = columns.reduce((sum, c) => sum + c.width, 0);

    // 列标题
    const header = new Graphics();
    let x = 0;
    columns.forEach((column, i) => {
      const colors = i === sortColumn ? AQUA.listHeaderSorted : AQUA.listHeader;
      header.rect(x, 0, column.width, HEADER_HEIGHT).fill(
        vGradient([
          [0, colors.top],
          [1, colors.bottom],
        ]),
      );
      header.rect(x + column.width - 1, 2, 1, HEADER_HEIGHT - 4).fill(AQUA.listHeader.edge);
      const title = aquaText(column.title, { size: 11 });
      title.anchor.set(0, 0.5);
      title.position.set(x + PADDING_X, HEADER_HEIGHT / 2);
      this.view.addChild(title);
      if (i === sortColumn) {
        // 排序方向的小三角（升序，尖朝上）
        const tx = x + column.width - 12;
        const cy = HEADER_HEIGHT / 2;
        header.poly([tx, cy + 2.5, tx + 7, cy + 2.5, tx + 3.5, cy - 2.5]).fill(AQUA.inkSoft);
      }
      x += column.width;
    });
    header.rect(0, HEADER_HEIGHT - 1, width, 1).fill(AQUA.listHeader.edge);
    this.view.addChildAt(header, 0);

    // 各行
    rows.forEach((row, r) => {
      const top = HEADER_HEIGHT + r * LIST_ROW_HEIGHT;
      const highlight = new Graphics().rect(0, top, width, LIST_ROW_HEIGHT).fill(AQUA.selection);
      highlight.visible = false;
      this.view.addChild(highlight);

      const texts: Text[] = [];
      let cellX = 0;
      columns.forEach((column, c) => {
        let textX = cellX + PADDING_X;
        if (c === 0 && row.icon) {
          row.icon.position.set(textX, top + (LIST_ROW_HEIGHT - ICON_SIZE) / 2);
          this.view.addChild(row.icon);
          textX += ICON_SIZE + 5;
        }
        const text = aquaText(row.cells[c] ?? '', { size: 12 });
        if (column.align === 'right') {
          text.anchor.set(1, 0.5);
          text.position.set(cellX + column.width - PADDING_X, top + LIST_ROW_HEIGHT / 2);
        } else {
          text.anchor.set(0, 0.5);
          text.position.set(textX, top + LIST_ROW_HEIGHT / 2);
        }
        this.view.addChild(text);
        texts.push(text);
        cellX += column.width;
      });
      this.rows.push({ highlight, texts });
    });
  }

  /** 选中第 index 行（蓝底白字）；-1 表示不选 */
  setSelected(index: number): void {
    if (index === this.selected) return;
    const previous = this.rows[this.selected];
    if (previous) {
      previous.highlight.visible = false;
      for (const text of previous.texts) text.style.fill = AQUA.ink;
    }
    this.selected = index;
    const row = this.rows[index];
    if (row) {
      row.highlight.visible = true;
      for (const text of row.texts) text.style.fill = AQUA.white;
    }
  }
}
