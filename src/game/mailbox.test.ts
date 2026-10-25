import { describe, expect, it } from 'vite-plus/test';
import { MAIL_UNLOCK_CHARTS, mailState } from './mailbox.ts';

describe('mailState', () => {
  it('stays empty until enough different charts are finished', () => {
    expect(mailState(MAIL_UNLOCK_CHARTS - 1, false)).toBe('empty');
    expect(mailState(MAIL_UNLOCK_CHARTS - 1, true)).toBe('empty');
    expect(mailState(MAIL_UNLOCK_CHARTS, false)).toBe('unread');
    expect(mailState(MAIL_UNLOCK_CHARTS + 2, true)).toBe('read');
  });
});
