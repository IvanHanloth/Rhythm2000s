// Chart rule shared by the desktop scenes (doc/chart-format.md "Scene rules"): the n-th target to appear
// is dealt with by the n-th response, so every phrase's response must repeat its call action for action.

import type { Chart, ChartCue } from '../../rhythm/chart.ts';

/** Checks each phrase's pairing and hands its calls to `checkPhrase` for scene-specific limits. */
export function checkPairedPhrases(
  chart: Chart,
  sceneName: string,
  checkPhrase: (phrase: number, calls: readonly ChartCue[]) => string[],
): string[] {
  const errors: string[] = [];
  chart.phrases.forEach((_, phrase) => {
    const calls = chart.calls.filter((c) => c.phrase === phrase);
    const responses = chart.responses.filter((c) => c.phrase === phrase);
    if (calls.length !== responses.length) {
      errors.push(
        `phrases[${phrase}]: the ${sceneName} scene needs as many response events as call events (${calls.length} call, ${responses.length} response)`,
      );
    } else {
      responses.forEach((response, i) => {
        const expected = calls[i]!.action;
        if (response.action !== expected) {
          errors.push(
            `phrases[${phrase}].response[${i}]: the ${sceneName} scene needs the same action as call event ${i + 1} (${expected})`,
          );
        }
      });
    }
    errors.push(...checkPhrase(phrase, calls));
  });
  return errors;
}

/** Errors for counts over their per-phrase limit: [what, count, limit] */
export function overLimits(
  phrase: number,
  sceneName: string,
  limits: readonly [string, number, number][],
): string[] {
  return limits
    .filter(([, n, max]) => n > max)
    .map(
      ([name, n, max]) =>
        `phrases[${phrase}]: ${n} ${name}, the ${sceneName} scene allows at most ${max} per phrase`,
    );
}
