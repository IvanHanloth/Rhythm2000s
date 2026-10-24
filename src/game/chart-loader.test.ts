import { describe, expect, it } from 'vite-plus/test';
import { sourceFromPatterns } from '../rhythm/test-charts.ts';
import { loadCharts, type FetchChartJson } from './chart-loader.ts';

/** 假的下载函数：files 里没有的文件当作 404 */
function fakeFetch(files: Record<string, unknown>): FetchChartJson {
  return async (file) => {
    if (!(file in files)) throw new Error('下载失败（HTTP 404）');
    const value = files[file];
    if (value instanceof Error) throw value;
    return value;
  };
}

const good = sourceFromPatterns([[0, 1, 2]], { id: 'good' });

describe('loadCharts', () => {
  it('按清单顺序加载合法的谱面', async () => {
    const result = await loadCharts(
      fakeFetch({
        'index.json': { format: 1, charts: ['good.json'] },
        'good.json': good,
      }),
    );
    expect(result.errors).toEqual([]);
    expect(result.charts.map((c) => c.id)).toEqual(['good']);
  });

  it('清单下载失败时没有谱面，并报错', async () => {
    const result = await loadCharts(fakeFetch({}));
    expect(result).toEqual({
      charts: [],
      errors: ['谱面清单 index.json：下载失败（HTTP 404）'],
    });
  });

  it('坏谱面被跳过，其余照常加载，错误带文件名', async () => {
    const result = await loadCharts(
      fakeFetch({
        'index.json': { format: 1, charts: ['missing.json', 'broken.json', 'good.json'] },
        'broken.json': new SyntaxError('Unexpected token'),
        'good.json': good,
      }),
    );
    expect(result.charts.map((c) => c.id)).toEqual(['good']);
    expect(result.errors).toEqual([
      '谱面 missing.json：下载失败（HTTP 404）',
      '谱面 broken.json：不是有效的 JSON（Unexpected token）',
    ]);
  });

  it('场景附加规则和轮次提示的时间限制也会检查', async () => {
    const mismatched = sourceFromPatterns([[0, 1]], { id: 'mismatched' });
    mismatched.phrases[0]!.response = [{ beat: 0, action: 'close-window' }];
    const late = sourceFromPatterns([[0, 3.5], [0]], { id: 'late' });

    const result = await loadCharts(
      fakeFetch({
        'index.json': { format: 1, charts: ['mismatched.json', 'late.json'] },
        'mismatched.json': mismatched,
        'late.json': late,
      }),
    );
    expect(result.charts).toEqual([]);
    expect(result.errors[0]).toContain(
      '谱面 mismatched.json：phrases[0]：XP 场景要求跟打与示范的事件个数相同',
    );
    expect(result.errors[1]).toContain('谱面 late.json：phrases[0].call[1]：第 3.5 拍太靠后');
  });
});
