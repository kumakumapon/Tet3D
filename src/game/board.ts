export const WIDTH = 4,
  DEPTH = 4,
  HEIGHT = 10;
export type Color = 1 | 2 | 3 | 4;
export type Cell = 0 | Color;
export type Vec = readonly [number, number, number];
export interface Cube {
  pos: Vec;
  color: Color;
}
export const DIRECTIONS: readonly Vec[] = [
  [1, 0, 0],
  [-1, 0, 0],
  [0, 1, 0],
  [0, -1, 0],
  [0, 0, 1],
  [0, 0, -1],
];
export const key = (p: Vec) => p.join(",");
export const add = (a: Vec, b: Vec): Vec => [
  a[0] + b[0],
  a[1] + b[1],
  a[2] + b[2],
];
export class Board {
  private cells = new Uint8Array(WIDTH * DEPTH * HEIGHT);
  inside([x, y, z]: Vec) {
    return (
      [x, y, z].every(Number.isInteger) &&
      x >= 0 &&
      x < WIDTH &&
      y >= 0 &&
      y < HEIGHT &&
      z >= 0 &&
      z < DEPTH
    );
  }
  private index([x, y, z]: Vec) {
    return x + WIDTH * (z + DEPTH * y);
  }
  get(p: Vec): Cell {
    if (!this.inside(p)) throw new RangeError("Outside board");
    return this.cells[this.index(p)] as Cell;
  }
  set(p: Vec, c: Cell) {
    if (!this.inside(p) || !Number.isInteger(c) || c < 0 || c > 4)
      throw new RangeError("Invalid cell");
    this.cells[this.index(p)] = c;
  }
  clear() {
    this.cells.fill(0);
  }
  clone() {
    const b = new Board();
    b.cells.set(this.cells);
    return b;
  }
  cubes(): Cube[] {
    const result: Cube[] = [];
    for (let y = 0; y < HEIGHT; y++)
      for (let z = 0; z < DEPTH; z++)
        for (let x = 0; x < WIDTH; x++) {
          const pos: Vec = [x, y, z],
            color = this.get(pos);
          if (color) result.push({ pos, color });
        }
    return result;
  }
  gravity() {
    for (let x = 0; x < WIDTH; x++)
      for (let z = 0; z < DEPTH; z++) {
        let target = 0;
        for (let y = 0; y < HEIGHT; y++) {
          const c = this.get([x, y, z]);
          if (c) {
            this.set([x, y, z], 0);
            this.set([x, target++, z], c);
          }
        }
      }
  }
  groups(minimum = 4): Cube[][] {
    const seen = new Set<string>(),
      result: Cube[][] = [];
    for (const cube of this.cubes()) {
      if (seen.has(key(cube.pos))) continue;
      const group = [cube];
      seen.add(key(cube.pos));
      for (let i = 0; i < group.length; i++)
        for (const d of DIRECTIONS) {
          const p = add(group[i].pos, d),
            k = key(p);
          if (this.inside(p) && !seen.has(k) && this.get(p) === cube.color) {
            seen.add(k);
            group.push({ pos: p, color: cube.color });
          }
        }
      if (group.length >= minimum) result.push(group);
    }
    return result;
  }
}
