// 判定：把玩家输入对到跟打目标上，给出 Perfect / Good / Miss。
// 时间单位为秒，使用音频时间轴；输入时间应已扣除玩家校准值。

export type JudgementLevel = 'perfect' | 'good' | 'miss';

export interface JudgeWindows {
  /** Perfect 的半宽（秒），偏差绝对值不超过它算 Perfect */
  perfect: number;
  /** Good 的半宽（秒），偏差绝对值不超过它算 Good，超出算 Miss */
  good: number;
}

/** MVP 暂定的判定窗口，见 doc/prototypes/mvp.md */
export const MVP_WINDOWS: JudgeWindows = { perfect: 0.045, good: 0.1 };

export interface Judgement {
  /** 目标下标 */
  target: number;
  level: JudgementLevel;
  /** 偏差（秒），正数表示晚；Miss 时为 null */
  offset: number | null;
  /** 判定发生的时间（秒）：命中时是输入时间，Miss 时是 Good 窗口关闭的时间 */
  time: number;
}

/** 偏差对应的等级；超出 Good 窗口时返回 null（由调用方决定是 Miss 还是无效输入）。 */
export function levelForOffset(offset: number, windows: JudgeWindows): JudgementLevel | null {
  const distance = Math.abs(offset);
  if (distance <= windows.perfect) return 'perfect';
  if (distance <= windows.good) return 'good';
  return null;
}

export class ResponseJudge {
  private readonly targets: readonly number[];
  private readonly windows: JudgeWindows;
  private readonly results: (Judgement | null)[];

  /** targets：各跟打目标的时间（秒），从小到大排列 */
  constructor(targets: readonly number[], windows: JudgeWindows = MVP_WINDOWS) {
    this.targets = targets;
    this.windows = windows;
    this.results = targets.map(() => null);
  }

  /** 第 i 个目标的判定结果；还没判定时为 null。 */
  result(target: number): Judgement | null {
    return this.results[target] ?? null;
  }

  get allJudged(): boolean {
    return this.results.every((r) => r !== null);
  }

  /**
   * 一次输入：对到最早的、还没判定的、偏差在 Good 窗口以内的目标。
   * 附近没有目标时返回 null，这次输入不计分也不罚分。
   */
  tap(time: number): Judgement | null {
    for (let i = 0; i < this.targets.length; i++) {
      if (this.results[i]) continue;
      const offset = time - this.targets[i]!;
      const level = levelForOffset(offset, this.windows);
      if (level) {
        const judgement: Judgement = { target: i, level, offset, time };
        this.results[i] = judgement;
        return judgement;
      }
    }
    return null;
  }

  /** 把 Good 窗口已经过去、仍没有输入的目标记为 Miss，返回这次新增的 Miss。 */
  expire(time: number): Judgement[] {
    const missed: Judgement[] = [];
    for (let i = 0; i < this.targets.length; i++) {
      if (this.results[i]) continue;
      const closeTime = this.targets[i]! + this.windows.good;
      if (time <= closeTime) break;
      const judgement: Judgement = { target: i, level: 'miss', offset: null, time: closeTime };
      this.results[i] = judgement;
      missed.push(judgement);
    }
    return missed;
  }
}
