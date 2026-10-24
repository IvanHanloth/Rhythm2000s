# 0014 The Rickroll easter egg embeds the official YouTube video

- Status: Accepted
- Date: 2026-10-24

## Context

The user asked for an easter egg replaying the 2007 GTA IV trailer Rickroll ([easter-eggs.md](../easter-eggs.md)): its payoff is "Never Gonna Give You Up". The song and its video are copyrighted, so the game can't ship them, and the project shouldn't recreate the lyrics either. Everything else in the game is drawn on the PixiJS canvas and plays through our own Web Audio graph ([ADR 0001](0001-tech-stack.md)).

## Options

1. **Embed the official music video** from YouTube in an iframe placed over the in-game browser's page area.
2. **Open YouTube in a new browser tab**, leaving the game.
3. **An in-game parody** with our own animation and no music from the song.

## Decision

The user chose option 1. The iframe uses the privacy-enhanced `youtube-nocookie.com` embed address and autoplays; it exists only while the in-game browser shows the mirror page.

## Consequences

- The only network dependency outside the game's own files, and only for this easter egg; offline the area stays black.
- Its sound comes from the iframe, outside the audio clock. That is fine: nothing is judged while it plays.
- The canvas can't draw an iframe, so `src/ui/video-embed.ts` keeps a DOM element lined up with a canvas rectangle every frame. Scenes reach the DOM through a new `overlay` element on `SceneContext`.
- No runtime dependency is added.
