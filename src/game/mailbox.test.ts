import { describe, expect, it } from 'vite-plus/test';
import { MAIL_UNLOCK_CHARTS, Mailbox, parseFinished, type MailStorage } from './mailbox.ts';

function memoryStorage(): MailStorage & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => void data.set(key, value),
  };
}

describe('Mailbox', () => {
  it('stays empty until enough different charts are finished', () => {
    const mailbox = new Mailbox(memoryStorage());
    for (let i = 0; i < MAIL_UNLOCK_CHARTS - 1; i++) mailbox.recordFinished(`chart-${i}`);
    // Finishing the same chart again doesn't count twice
    mailbox.recordFinished('chart-0');
    expect(mailbox.state).toBe('empty');
    mailbox.recordFinished('another');
    expect(mailbox.state).toBe('unread');
  });

  it('remembers the read message across mailboxes on the same storage', () => {
    const storage = memoryStorage();
    const first = new Mailbox(storage);
    first.markRead();
    expect(first.state).toBe('empty');
    for (let i = 0; i < MAIL_UNLOCK_CHARTS; i++) first.recordFinished(`chart-${i}`);
    first.markRead();
    expect(new Mailbox(storage).state).toBe('read');
  });

  it('counts nothing without storage or when storage throws', () => {
    const none = new Mailbox(null);
    for (let i = 0; i < MAIL_UNLOCK_CHARTS; i++) none.recordFinished(`chart-${i}`);
    expect(none.state).toBe('empty');
    const broken = new Mailbox({
      getItem: () => {
        throw new Error('denied');
      },
      setItem: () => {
        throw new Error('denied');
      },
    });
    broken.recordFinished('chart');
    expect(broken.state).toBe('empty');
  });
});

describe('parseFinished', () => {
  it('reads a list of chart ids and ignores anything else', () => {
    expect(parseFinished('["a","b"]')).toEqual(['a', 'b']);
    expect(parseFinished(null)).toEqual([]);
    expect(parseFinished('not json')).toEqual([]);
    expect(parseFinished('[1, 2]')).toEqual([]);
    expect(parseFinished('{"a": 1}')).toEqual([]);
  });
});
