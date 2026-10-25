# 0019 A per-save difficulty sets the chart speed and scales the recorded score

- Status: Accepted
- Date: 2026-10-25

## Context

The user asked for a difficulty setting with five levels, Heaven, Easy, Normal, Hard and Hell, playing charts at ×0.5, ×0.8, ×1, ×1.2 and ×1.5 speed. It is normally picked when a new game starts and can be changed in the settings during play. Scores are marked with their difficulty, and the score recorded is the final score times the speed. Design: [difficulty.md](../difficulty.md).

## Options

Where the difficulty lives:

1. In each save, picked in New Game and changed in the settings window for the current save.
2. In the device settings, shared by every save like the calibration.

How the speed is applied:

1. Multiply the chart's tempo for the level; every timing in the game is in beats, so the chart, demos, drums, turn cues and beat guide follow.
2. Also scale the judgement windows with the speed.

How the best score works:

1. One best per chart, compared by recorded score, kept with its difficulty.
2. A best per chart and difficulty.

## Decision

The difficulty belongs to each save (option 1), since it is chosen when the save is created. The speed multiplies the tempo only (option 1); the judgement windows stay in milliseconds, which is what makes faster speeds harder. One best per chart is kept, compared by recorded score (score × speed, rounded) and stored with its difficulty; the rating still comes from the unscaled score so "Superb" means the same at every speed.

The save file moves to version 2, adding the save's difficulty and each best score's difficulty; version 1 files and older progress become Normal.

Since a chart must play at every difficulty, the turn-cue timing check runs at the fastest speed (×1.5). Every official chart already passed it at that speed when this was decided.

## Consequences

- Charts that only just met the turn-cue timing at their own tempo may now fail validation, in the importer and HackerEditor as well.
- The settings window is wider, with a Difficulty column, and the New Game window gains five radio buttons; XP and Aqua each need a radio button widget.
- HackerEditor's Play and Test and the showcase stay at the chart's own tempo.
- No runtime dependency is added.
