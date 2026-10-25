// Unit tests only: loads the MVP chart (kept here as a fixture, no longer a shipped level) through every load-time check.

import mvpText from './test-mvp-chart.json?raw';
import { checkChartData } from '@/game/chart-loader.ts';
import type { Chart } from '@/rhythm/chart.ts';

export function loadMvpChart(): Chart {
  const result = checkChartData(JSON.parse(mvpText), 'xp-popup-mvp');
  if (!result.loaded) throw new Error(result.errors.join('\n'));
  return result.loaded.chart;
}
