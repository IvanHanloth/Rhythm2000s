// Every keyboard shortcut in the game, grouped by where it works, as the settings window lists them (doc/settings.md).
// Keep in step with the key handlers in src/hub/hub.ts, src/game/main.ts and src/scenes/shared/level-scene.ts.

export interface Shortcut {
  keys: string;
  does: string;
}

export interface ShortcutGroup {
  where: string;
  shortcuts: readonly Shortcut[];
}

/** `enter` is the scene's name for the Enter key ("Enter" on XP, "Return" on the Mac) */
export function shortcutGroups(enter: string): ShortcutGroup[] {
  return [
    {
      where: 'Street',
      shortcuts: [
        { keys: 'W A S D / Arrows', does: 'Walk' },
        { keys: 'Shift', does: 'Run' },
        { keys: 'Mouse', does: 'Look around (click the screen first)' },
        { keys: 'E', does: 'Examine; sit down; continue talking' },
        { keys: enter, does: 'Start, on the title screen' },
        { keys: 'Esc', does: 'Pause; stand up when seated' },
      ],
    },
    {
      where: 'Level list',
      shortcuts: [
        { keys: 'Arrow keys', does: 'Select a level' },
        { keys: enter, does: 'Play the selected level' },
        { keys: 'Esc', does: 'Back to the café' },
      ],
    },
    {
      where: 'In a level',
      shortcuts: [
        { keys: 'Space / Click', does: 'Do the action' },
        { keys: 'H', does: 'Beat Guide on / off' },
        { keys: 'Tab', does: 'Skip the remaining practice' },
        { keys: 'Esc', does: 'Back to the level list' },
      ],
    },
    {
      where: 'Results',
      shortcuts: [
        { keys: enter, does: 'Next Level (Retry on the last one)' },
        { keys: 'R', does: 'Retry' },
        { keys: 'Esc', does: 'Back to the level list' },
      ],
    },
  ];
}
