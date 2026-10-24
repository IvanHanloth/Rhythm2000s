// 只给单元测试用：读取真实的 MVP 谱面文件并通过加载时的全部校验。

import mvpText from '../../../public/charts/xp-popup-mvp.json?raw';
import { checkChartData } from '../../game/chart-loader.ts';
import type { Chart } from '../../rhythm/chart.ts';

export function loadMvpChart(): Chart {
  const result = checkChartData(JSON.parse(mvpText), 'xp-popup-mvp');
  if (!result.chart) throw new Error(result.errors.join('\n'));
  return result.chart;
}
