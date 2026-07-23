# The Learning Playground

Every finished game on the server becomes one line of TTN - a couple of
bytes per move (see `server/src/notation.ts`). This folder is where those
lines turn into robots. It is a teaching lab, not a framework: zero
dependencies, two short scripts, and every step readable in one sitting.

## The learning path

```
play games  ->  data/games.ttn  ->  train.ts  ->  policy.json  ->  learner.ts
   (humans + robots)   (TTN lines)   (behavior       (lookup        (a robot that
                                      cloning)        table)         learned to play)
```

1. **Collect.** The server appends every finished game to `data/games.ttn`
   (the `TTN_LOG` env var moves or disables it). v2 lines even carry per-move
   thinking time.
2. **Train.**

   ```sh
   bun playground/train.ts
   ```

   The trainer replays recorded games, tops the dataset up with self-play
   through the *real* engine (half the seats play a greedy win/block teacher,
   half play randomly), and counts, for every position, where the eventual
   winner moved. The majority vote per state is written to
   `playground/policy.json`, then the policy is scored against random and
   greedy rivals so you see exactly what your data bought you.

3. **Play it.**

   ```sh
   bun playground/learner.ts
   ```

   `cloney` registers on your dev server as a normal SDK robot advertising
   only the 3x3 / 2-player configuration it was trained on. In the web app,
   press "+ robot" and pick `cloney`.

## Why the table is small

`policy.ts` encodes states mover-relative (the player to move is always
"A") and canonicalizes over the 8 symmetries of the square, so one entry
covers every rotation, reflection, and color-swap of a position. 3x3
tic-tac-toe collapses from a few thousand reachable positions to a few
hundred canonical ones - small enough to print, honest enough to lose when
its data is thin.

## Ideas to take it further

- Feed it more human games (`data/games.ttn` grows every time you play).
- Raise `--selfplay`, or make the teacher `robots/minimax.ts` and clone
  perfection.
- Replace the majority vote with counts -> probabilities and sample.
- Iterate: train, self-play with the learned policy, retrain on its wins.
- Grow the config constants in `train.ts` beyond 3x3 and watch the state
  space explode - then invent a better representation than a lookup table.
  That is the whole field, in miniature.
