// The computers' inbox for the Rickroll easter egg (doc/easter-eggs.md): the unlock rule. The finished charts and
// whether the 4chan message has been read are part of the current save (save-progress.ts, doc/save-slots.md).

/** Different charts to finish before the message arrives */
export const MAIL_UNLOCK_CHARTS = 3;

/** empty: not unlocked yet; unread / read: the message is in the inbox */
export type MailState = 'empty' | 'unread' | 'read';

/** The inbox after `finishedCount` different charts, with the message opened or not */
export function mailState(finishedCount: number, read: boolean): MailState {
  if (finishedCount < MAIL_UNLOCK_CHARTS) return 'empty';
  return read ? 'read' : 'unread';
}
