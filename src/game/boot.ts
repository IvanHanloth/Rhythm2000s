// Page entry: on a phone the boot screen turns into a "not supported" notice and the game is never downloaded
// (doc/phone-notice.md); on a computer it loads the game from main.ts.

import { isPhone } from './device.ts';

if (isPhone(navigator.userAgent)) {
  const text = document.querySelector('#boot .boot-text');
  if (!text) throw new Error('Boot screen text not found');
  const reason = document.createElement('span');
  reason.textContent = "Phones aren't supported yet.";
  // The last line keeps the boot screen's blinking cursor
  const advice = document.createElement('span');
  advice.className = 'boot-text';
  advice.textContent = 'Please play on a computer.';
  text.replaceWith(reason, advice);
} else {
  await import('./main.ts');
}
