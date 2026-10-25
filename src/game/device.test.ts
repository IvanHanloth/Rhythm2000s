import { describe, expect, it } from 'vite-plus/test';
import { isPhone } from './device.ts';

describe('isPhone', () => {
  it.each([
    [
      'iPhone Safari',
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    ],
    [
      'Android Chrome',
      'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36',
    ],
    ['Android Firefox', 'Mozilla/5.0 (Android 14; Mobile; rv:130.0) Gecko/130.0 Firefox/130.0'],
  ])('treats %s as a phone', (_, userAgent) => {
    expect(isPhone(userAgent)).toBe(true);
  });

  it.each([
    [
      'Windows Chrome',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
    ],
    [
      'Mac Safari',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
    ],
    [
      'iPad Chrome',
      'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/130.0.0.0 Mobile/15E148 Safari/604.1',
    ],
    [
      'Android tablet Chrome',
      'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
    ],
  ])('lets %s load the game', (_, userAgent) => {
    expect(isPhone(userAgent)).toBe(false);
  });
});
