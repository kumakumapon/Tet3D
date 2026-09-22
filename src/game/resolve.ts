import { Board, type Cube } from "./board";
export const chainMultiplier = (chain: number) =>
  [1, 2, 4, 8, 16, 24, 32][Math.min(6, Math.max(0, chain - 1))];
export function scoreGroups(groups: Cube[][], chain: number) {
  const multi = new Set(groups.map((g) => g[0].color)).size;
  // Sum per-group bonuses, then +25% per additional simultaneously cleared color.
  return Math.round(
    (groups.reduce(
      (sum, g) =>
        sum + g.length * [10, 12, 15, 20, 25, 30][Math.min(5, g.length - 4)],
      0,
    ) *
      chainMultiplier(chain) *
      (4 + multi - 1)) /
      4,
  );
}
export interface ClearStep {
  board: Board;
  groups: Cube[][];
  chain: number;
  points: number;
}
export function resolve(board: Board) {
  const result = board.clone(),
    steps: ClearStep[] = [];
  while (true) {
    result.gravity();
    const groups = result.groups();
    if (!groups.length) break;
    const chain = steps.length + 1;
    steps.push({
      board: result.clone(),
      groups,
      chain,
      points: scoreGroups(groups, chain),
    });
    groups.flat().forEach((c) => result.set(c.pos, 0));
  }
  const perfect = steps.length > 0 && result.cubes().length === 0;
  return {
    board: result,
    steps,
    perfect,
    score: steps.reduce((sum, s) => sum + s.points, 0) + (perfect ? 5000 : 0),
  };
}
