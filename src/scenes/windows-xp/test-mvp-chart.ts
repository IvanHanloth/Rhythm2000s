// Unit tests only: loads the real MVP chart file through every load-time check.

import mvpText from '@public/charts/xp-popup-mvp.json?raw';
import { checkChartData } from '@/game/chart-loader.ts';
import type { Chart } from '@/rhythm/chart.ts';

export function loadMvpChart(): Chart {
  const result = checkChartData(JSON.parse(mvpText), 'xp-popup-mvp');
  if (!result.chart) throw new Error(result.errors.join('\n'));
  return result.chart;
}
