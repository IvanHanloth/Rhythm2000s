// 检查 public/charts/ 下真实的谱面文件：清单列全了、每个谱面都能通过加载时的全部校验。

import { describe, expect, it } from 'vite-plus/test';
import { parseChartIndex } from '../rhythm/chart-file.ts';
import { CHART_INDEX_FILE, checkChartData } from './chart-loader.ts';

const files = import.meta.glob<string>('/public/charts/*.json', {
  query: '?raw',
  import: 'default',
  eager: true,
});
const byName = Object.fromEntries(
  Object.entries(files).map(([path, text]) => [path.split('/').pop()!, JSON.parse(text)]),
);

describe('public/charts', () => {
  const index = parseChartIndex(byName[CHART_INDEX_FILE]);

  it('清单格式正确，并列出了目录下的全部谱面文件', () => {
    expect(index.ok).toBe(true);
    const listed = index.ok ? [...index.value.charts].sort() : [];
    const present = Object.keys(byName)
      .filter((name) => name !== CHART_INDEX_FILE)
      .sort();
    expect(listed).toEqual(present);
  });

  it.each(Object.keys(byName).filter((name) => name !== CHART_INDEX_FILE))(
    '%s 通过校验',
    (name) => {
      const result = checkChartData(byName[name], name.replace(/\.json$/, ''));
      expect(result.errors).toEqual([]);
    },
  );
});
