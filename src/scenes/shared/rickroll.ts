// What the Rickroll easter egg shows (doc/easter-eggs.md): the 4chan message, the /v/ thread and the addresses.
// All text is original. The song itself is never shipped: the mirror page embeds the official video (ADR 0014).
// No PixiJS, so both scenes and the shared page drawing can use it.

/** The message in the inbox once three charts are finished */
export const RICKROLL_MAIL = {
  fromName: '4chan',
  fromAddress: 'noreply@4chan.org',
  to: 'you@localhost',
  subject: 'GTA IV trailer is out — Rockstar’s site is down',
  /** As the message list shows it */
  received: '3/29/2007 5:12 PM',
  /** As the preview header shows it */
  date: 'Thursday, March 29, 2007 5:12 PM',
  /** Paragraphs before the link */
  body: [
    'The first Grand Theft Auto IV trailer went up today and rockstargames.com fell over within minutes.',
    'Anons on /v/ grabbed it before the site died. The thread has mirrors:',
  ],
  /** After the link */
  signOff: '— 4chan',
} as const;

/** The thread the message links to */
export const THREAD_URL = 'http://boards.4chan.org/v/res/2817734.html';
export const THREAD_TITLE = '/v/ - Video Games';

/** The disguised link in the opening post, and where it really goes */
export const MIRROR_LINK_TEXT = 'http://www.gtaiv-mirror.net/trailer1_hq.wmv';
export const VIDEO_ID = 'dQw4w9WgXcQ';
export const VIDEO_URL = `http://www.youtube.com/watch?v=${VIDEO_ID}`;
export const VIDEO_TITLE = 'YouTube - Rick Astley - Never Gonna Give You Up';
/** The player address: privacy-enhanced embed, playing straight away (the click on the mirror is the user gesture) */
export const VIDEO_EMBED_URL = `https://www.youtube-nocookie.com/embed/${VIDEO_ID}?autoplay=1&rel=0`;

/** One line of a post: plain, a greentext quote, or the mirror link */
export type PostLine = { text: string } | { quote: string } | { mirror: true };

export interface ChanPost {
  number: number;
  name: string;
  /** Opening post only */
  subject?: string;
  date: string;
  lines: readonly PostLine[];
}

/** Opening post first; the opening post carries the picture */
export const THREAD_POSTS: readonly ChanPost[] = [
  {
    number: 2817734,
    name: 'Anonymous',
    subject: 'GTA IV TRAILER',
    date: '03/29/07(Thu)12:04',
    lines: [
      { text: 'rockstargames.com is dead, everyone is hitting it at once.' },
      { text: 'Got the trailer before it went down. Mirror:' },
      { mirror: true },
    ],
  },
  {
    number: 2817741,
    name: 'Anonymous',
    date: '03/29/07(Thu)12:05',
    lines: [{ quote: '>refreshing the Rockstar site for an hour' }, { text: 'thank you OP' }],
  },
  {
    number: 2817756,
    name: 'Anonymous',
    date: '03/29/07(Thu)12:06',
    lines: [{ text: 'Liberty City is back. Downloading now.' }],
  },
  {
    number: 2817770,
    name: 'Anonymous',
    date: '03/29/07(Thu)12:08',
    lines: [
      { quote: '>>2817734' },
      { text: 'is this the HQ one? 56k here, don’t want to waste an hour' },
    ],
  },
];
