// Colours of the web pages the in-game browsers show in the Rickroll easter egg (doc/easter-eggs.md): 4chan's 2007
// Yotsuba style and the black behind the embedded video. Browser frames use each scene's own palette.

export const WEB_2007 = {
  chan: {
    /** Page background and default text */
    page: '#ffffee',
    text: '#800000',
    /** Board title */
    title: '#af0a0f',
    /** Horizontal rules */
    rule: '#d9bfb7',
    /** "Posting mode: Reply" bar */
    modeBar: '#e04000',
    onModeBar: '#ffffff',
    /** Reply boxes and their right / bottom edge */
    reply: '#f0e0d6',
    replyEdge: '#d9bfb7',
    /** Opening post subject, poster names, greentext */
    subject: '#cc1105',
    name: '#117743',
    quote: '#789922',
    link: '#0000ee',
    /** The drawn picture in the opening post: a night skyline */
    picture: {
      sky: ['#0b1a3a', '#3a2a5a'],
      buildings: '#05070f',
      windows: '#f6d36b',
      border: '#000000',
    },
  },
  /** Behind the embedded video */
  video: '#000000',
} as const;
