import { add, Board, type Color, type Cube, type Vec } from "./board";
// Cycle through five simple satellite positions; gravity always points down.
export const ORIENTATIONS: readonly Vec[] = [
  [0, 1, 0],
  [1, 0, 0],
  [0, 0, 1],
  [-1, 0, 0],
  [0, 0, -1],
];
export interface Pair {
  pivot: Vec;
  orientation: number;
  colors: readonly [Color, Color];
}
export function cubes(pair: Pair): Cube[] {
  return [
    { pos: pair.pivot, color: pair.colors[0] },
    {
      pos: add(pair.pivot, ORIENTATIONS[pair.orientation]),
      color: pair.colors[1],
    },
  ];
}
export function fits(board: Board, pair: Pair) {
  return cubes(pair).every(
    (c) => board.inside(c.pos) && board.get(c.pos) === 0,
  );
}
export function translated(pair: Pair, delta: Vec): Pair {
  return { ...pair, pivot: add(pair.pivot, delta) };
}
export function landed(board: Board, pair: Pair): Pair {
  let result = pair;
  while (fits(board, translated(result, [0, -1, 0])))
    result = translated(result, [0, -1, 0]);
  return result;
}
export function project(
  board: Board,
  pair: Pair,
): { board: Board; ghost: Cube[]; connected: Cube[][] } {
  const next = board.clone(),
    ghost: Cube[] = [];
  // Insert bottom-first so a vertical pair retains its order after splitting.
  for (const c of cubes(landed(board, pair)).sort(
    (a, b) => a.pos[1] - b.pos[1],
  )) {
    const [x, startY, z] = c.pos;
    let y = startY;
    while (y > 0 && next.get([x, y - 1, z]) === 0) y--;
    const pos: Vec = [x, y, z];
    next.set(pos, c.color);
    ghost.push({ pos, color: c.color });
  }
  const positions = new Set(ghost.map((c) => c.pos.join(",")));
  return {
    board: next,
    ghost,
    connected: next
      .groups(1)
      .filter((g) => g.some((c) => positions.has(c.pos.join(",")))),
  };
}
export class ColorRandomizer {
  private bag: Color[] = [];
  constructor(private random: () => number = Math.random) {}
  next(): Color {
    if (!this.bag.length) {
      this.bag = [1, 1, 2, 2, 3, 3, 4, 4];
      for (let i = this.bag.length - 1; i > 0; i--) {
        const j = Math.min(i, Math.max(0, Math.floor(this.random() * (i + 1))));
        [this.bag[i], this.bag[j]] = [this.bag[j], this.bag[i]];
      }
    }
    return this.bag.pop()!;
  }
  pair(): [Color, Color] {
    return [this.next(), this.next()];
  }
}
