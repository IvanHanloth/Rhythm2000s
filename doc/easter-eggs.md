# Easter eggs

> Status: Draft

Hidden extras on the level-list computers, outside the rhythm game. They never affect scores, records or judging.

## The GTA IV trailer mirror (Rickroll)

A replay of how Rickrolling began. On 29 March 2007 Rockstar released the first Grand Theft Auto IV trailer and its website went down under the traffic. On 4chan's video game board a post offered a "mirror" of the trailer; the link went to Rick Astley's "Never Gonna Give You Up" instead, and the bait-and-switch spread from there.

In the game the player gets the same bait by e-mail and follows it through a period browser.

### Decided

- **Both computers** have it: the XP machine with Outlook Express and Internet Explorer, the Mac with Mail and Safari.
- **Unlock**: after the player has finished **3 different charts** (played to the results window, any score), counted together across both computers and kept in browser storage. Imported charts count; HackerEditor's play and test don't. Nor do levels finished with the cheat code on ([cheat-code.md](cheat-code.md)).
- **Before the unlock** the mail program opens to an empty inbox.
- **The message stays** in the inbox once it has arrived, so it can be opened again. Whether it has been read is saved.
- **The song** is the official music video embedded from YouTube inside the in-game browser ([ADR 0014](decisions/0014-rickroll-embeds-youtube.md)). The game ships none of the song's audio, video or lyrics.

### Flow

```
3rd different chart finished
        │
        ▼
back on the level list ──► new mail notice (XP: tray envelope + balloon; Mac: Mail bounces, badge "1")
        │
        ▼
open mail (XP: balloon or "start" → "E-mail"; Mac: Mail in the Dock)
        │
        ▼
click the message ──► marked read; the preview shows the link
        │
        ▼
click the link ──► browser window: the 4chan /v/ thread, with the "mirror" link in the first post
        │
        ▼
click the mirror ──► same browser window goes to YouTube: "Never Gonna Give You Up" plays
```

- The mail and browser windows are modal windows over the level list, like the settings window: the list waits behind them, and the close button or Esc closes them. Following the link swaps the mail window for the browser.
- **Notice**: while the message is unread, the first time the level list is idle during a visit to the computer, XP shows the Outlook Express envelope in the tray and a balloon ("Outlook Express" / "You have 1 new message.") with the new-mail sound (Windows XP Notify); the Mac's Mail icon bounces three times with Mail's badge at 1 and the Ping sound. The envelope and badge stay until the message is read. Clicking the XP balloon opens Outlook Express; its close button only dismisses it.
- Nothing in the easter egg is rhythm input; clicks are ordinary interface clicks.

### Content (all original text)

| Part | Content |
| --- | --- |
| Mail | From "4chan" &lt;noreply@4chan.org&gt;, subject "GTA IV trailer is out — Rockstar's site is down", dated Thu 29 Mar 2007; a short note that the official site is down and a thread on /v/ has mirrors, with the thread's address as a link |
| Thread | 4chan's 2007 look (Yotsuba: cream page, maroon text, tan reply boxes, green names), board "/v/ - Video Games". The first post, by Anonymous, says the official site died and offers a mirror link; a few short replies. The opening post's picture is a drawn night skyline, not Rockstar artwork |
| Mirror page | The browser's address changes to the YouTube watch address and the page holds the embedded video, which starts playing on its own (the click on the link is the user gesture browsers ask for) |

### Provisional (first version, adjustable)

- Window sizes and layouts are simplified versions of Outlook Express 6, Mail 1.x, Internet Explorer 6 and Safari 1.0, drawn with the scenes' own widgets. Their toolbars, menus and folder lists are decoration; only the message row, links and close buttons respond.
- Safari 1.0 shipped for Mac OS X 10.2 in 2003 with a brushed-metal window; the scene draws it as an ordinary Aqua window.
- Without a network connection the video area stays black (YouTube's own error shows inside it).

### Code

- `src/game/mailbox.ts`: finished charts and the message's read state in browser storage, and the unlock rule.
- `src/scenes/shared/rickroll.ts`: the mail, thread and addresses.
- `src/ui/rickroll-pages.ts` draws the thread and switches to the video page; `src/ui/video-embed.ts` places the YouTube player (a DOM iframe) over the canvas; `src/theme/web-2007.ts` holds the page colours.
- Each scene draws its own mail and browser windows: `src/scenes/windows-xp/outlook-express-window.ts`, `internet-explorer-window.ts`; `src/scenes/mac-2000/mail-window.ts`, `safari-window.ts`.
