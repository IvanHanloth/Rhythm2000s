// The street's objectives (doc/hub.md#objectives): find the guide booklet, then play a song at a front-row computer.
// Both are read from the current save (doc/save-slots.md).

export type Objective = 'booklet' | 'play';

/** The objective text in the top left */
export const OBJECTIVE_TEXT: Record<Objective, string> = {
  booklet: 'Find the guide booklet on the CYBERSPACE CAFÉ front desk',
  play: 'Play a song on one of the two front-row computers',
};

/** The first objective not yet done; null when both are */
export function currentObjective(bookletRead: boolean, playedOnce: boolean): Objective | null {
  if (!bookletRead) return 'booklet';
  if (!playedOnce) return 'play';
  return null;
}
