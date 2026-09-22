import { describe, expect, it } from "vitest";
import { Board, HEIGHT, type Cube, type Vec } from "../src/game/board";
import {
  ColorRandomizer,
  cubes,
  fits,
  project,
  type Pair,
} from "../src/game/pair";
import { resolve, scoreGroups, chainMultiplier } from "../src/game/resolve";
import { GameEngine } from "../src/game/engine";
const put = (b: Board, positions: Vec[], color: 1 | 2 | 3 | 4 = 1) =>
  positions.forEach((p) => b.set(p, color));
function settle(g: GameEngine) {
  for (let i = 0; i < 60; i++) g.tick(100);
}
function chainBoard(n: number) {
  const b = new Board();
  for (let x = 0; x < 4; x++) b.set([x, 0, 0], 1);
  if (n >= 2) {
    for (let x = 0; x < 3; x++) b.set([x, 1, 0], 2);
    b.set([0, 0, 1], 2);
  }
  if (n >= 3) {
    for (let x = 0; x < 3; x++) b.set([x, 2, 0], 3);
    b.set([1, 0, 1], 3);
  }
  return b;
}
describe("Board", () => {
  it("stores 160 cells and clears independently cloned boards", () => {
    const b = new Board();
    for (let y = 0; y < 10; y++)
      for (let z = 0; z < 4; z++)
        for (let x = 0; x < 4; x++) b.set([x, y, z], 4);
    expect(b.cubes()).toHaveLength(160);
    const copy = b.clone();
    b.clear();
    expect(b.cubes()).toHaveLength(0);
    expect(copy.get([3, 9, 3])).toBe(4);
  });
  it.each([
    [-1, 0, 0],
    [4, 0, 0],
    [0, -1, 0],
    [0, 10, 0],
    [0, 0, -1],
    [0, 0, 4],
    [0.5, 0, 0],
  ])("rejects boundaries %j", (x, y, z) => {
    const b = new Board();
    expect(() => b.set([x, y, z], 1)).toThrow(RangeError);
    expect(() => b.get([x, y, z])).toThrow(RangeError);
  });
  it("compacts holes without reordering colors and treats columns independently", () => {
    const b = new Board();
    b.set([0, 3, 0], 1);
    b.set([0, 8, 0], 2);
    b.set([1, 7, 1], 3);
    b.gravity();
    expect(b.cubes()).toEqual([
      { pos: [0, 0, 0], color: 1 },
      { pos: [1, 0, 1], color: 3 },
      { pos: [0, 1, 0], color: 2 },
    ]);
  });
});
describe("six-direction groups", () => {
  const shapes: Vec[][] = [
    [
      [0, 0, 0],
      [1, 0, 0],
      [2, 0, 0],
      [3, 0, 0],
    ],
    [
      [0, 0, 0],
      [0, 1, 0],
      [0, 2, 0],
      [0, 3, 0],
    ],
    [
      [0, 0, 0],
      [0, 0, 1],
      [0, 0, 2],
      [0, 0, 3],
    ],
    [
      [0, 0, 0],
      [1, 0, 0],
      [1, 1, 0],
      [1, 1, 1],
    ],
  ];
  it.each(shapes.map((shape, i) => ({ shape, i })))(
    "connects axis or spatial shape $i",
    ({ shape }) => {
      const b = new Board();
      put(b, shape);
      expect(b.groups().map((g) => g.length)).toEqual([4]);
    },
  );
  it("excludes diagonal adjacency and groups of three", () => {
    const b = new Board();
    put(b, [
      [0, 0, 0],
      [1, 1, 0],
      [2, 2, 0],
      [3, 3, 0],
    ]);
    expect(b.groups()).toEqual([]);
    b.clear();
    put(b, [
      [0, 0, 0],
      [1, 0, 0],
      [2, 0, 0],
    ]);
    expect(b.groups()).toEqual([]);
  });
  it("clears the entire group of five", () => {
    const b = chainBoard(1);
    b.set([0, 1, 0], 1);
    expect(b.groups()[0]).toHaveLength(5);
    expect(resolve(b).board.cubes()).toHaveLength(0);
  });
  it("detects disconnected groups and multiple colors simultaneously", () => {
    const b = chainBoard(1);
    for (let x = 0; x < 4; x++) {
      b.set([x, 0, 2], 2);
      b.set([x, 0, 3], 1);
    }
    expect(b.groups()).toHaveLength(3);
    const result = resolve(b);
    expect(result.steps).toHaveLength(1);
    expect(result.steps[0].groups).toHaveLength(3);
  });
});
describe("pair and prediction", () => {
  it("balances every eight-cube bag and supports injected randomness", () => {
    const a = new ColorRandomizer(() => 0.2),
      b = new ColorRandomizer(() => 0.2);
    const values = Array.from({ length: 32 }, () => a.next());
    expect(values).toEqual(Array.from({ length: 32 }, () => b.next()));
    for (let start = 0; start < 32; start += 8)
      expect(values.slice(start, start + 8).sort()).toEqual([
        1, 1, 2, 2, 3, 3, 4, 4,
      ]);
  });
  it("splits a horizontal pair and predicts each final position without mutation", () => {
    const b = new Board();
    b.set([0, 0, 0], 2);
    b.set([0, 1, 0], 3);
    const pair: Pair = { pivot: [0, 8, 0], orientation: 1, colors: [1, 4] };
    const p = project(b, pair);
    expect(p.ghost).toEqual([
      { pos: [0, 2, 0], color: 1 },
      { pos: [1, 0, 0], color: 4 },
    ]);
    expect(b.cubes()).toHaveLength(2);
  });
  it("keeps a vertical pair ordered", () => {
    const p = project(new Board(), {
      pivot: [0, 8, 0],
      orientation: 0,
      colors: [1, 2],
    });
    expect(p.ghost).toEqual([
      { pos: [0, 0, 0], color: 1 },
      { pos: [0, 1, 0], color: 2 },
    ]);
  });
  it("predicts clear and rejects wall rotations", () => {
    const b = new Board();
    put(b, [
      [0, 0, 0],
      [1, 0, 0],
      [2, 0, 0],
    ]);
    const pair: Pair = { pivot: [3, 8, 0], orientation: 0, colors: [1, 2] };
    expect(project(b, pair).connected.some((g) => g.length === 4)).toBe(true);
    expect(fits(b, { ...pair, orientation: 1 })).toBe(false);
    expect(cubes(pair)).toHaveLength(2);
  });
});
describe("chain and score", () => {
  it.each([1, 2, 3])(
    "resolves %i sequential chain(s) with gravity and perfect clear",
    (n) => {
      const b = chainBoard(n),
        result = resolve(b);
      expect(result.steps.map((s) => s.chain)).toEqual(
        Array.from({ length: n }, (_, i) => i + 1),
      );
      expect(result.perfect).toBe(true);
      expect(result.board.cubes()).toEqual([]);
      expect(result.score).toBe([5040, 5120, 5280][n - 1]);
      expect(b.cubes().length).toBeGreaterThan(0);
    },
  );
  it.each([
    [4, 40],
    [5, 60],
    [6, 90],
    [7, 140],
    [8, 200],
    [9, 270],
    [10, 300],
  ])("scores group %i as %i", (size, expected) => {
    const group: Cube[] = Array.from({ length: size }, () => ({
      pos: [0, 0, 0],
      color: 1,
    }));
    expect(scoreGroups([group], 1)).toBe(expected);
  });
  it("adds multi-color bonus once per simultaneous step", () => {
    const a = chainBoard(1).groups()[0];
    expect(
      scoreGroups([a, a.map((c) => ({ ...c, color: 2 as const }))], 1),
    ).toBe(100);
    expect(chainMultiplier(7)).toBe(32);
    expect(chainMultiplier(20)).toBe(32);
  });
  it("does not award perfect clear on an initially empty board", () =>
    expect(resolve(new Board()).score).toBe(0));
});
describe("GameEngine", () => {
  it("spawns a vertical pair and next two pairs", () => {
    const g = new GameEngine(() => 0.2);
    g.start();
    const s = g.snapshot();
    expect(s.active).toHaveLength(2);
    expect(s.active[1].pos[1] - s.active[0].pos[1]).toBe(1);
    expect(s.next).toHaveLength(2);
    expect(s.level).toBe(1);
  });
  it("moves and rotates, rejecting walls", () => {
    const g = new GameEngine();
    g.start();
    expect(g.move(-1, 0)).toBe(true);
    expect(g.move(-1, 0)).toBe(false);
    expect(g.move(0, -1)).toBe(true);
    expect(g.move(0, -1)).toBe(false);
    expect(g.rotate(1)).toBe(true);
    expect(g.snapshot().active[1].pos[0]).toBe(1);
    expect(g.rotate(-1)).toBe(true);
  });
  it("soft drops and hard drops, then spawns after resolving", () => {
    const g = new GameEngine();
    g.start();
    g.drop();
    expect(g.snapshot().active[0].pos[1]).toBe(7);
    g.drop(true);
    expect(g.snapshot().placed).toBe(1);
    expect(g.snapshot().status).toBe("resolving");
    settle(g);
    expect(g.snapshot().status).toBe("playing");
    expect(g.snapshot().board).toHaveLength(2);
  });
  it("clock advances gravity; paused state freezes both play and clearing", () => {
    const g = new GameEngine();
    g.start();
    for (let i = 0; i < 10; i++) g.tick(100);
    expect(g.snapshot().active[0].pos[1]).toBe(7);
    g.pause();
    const s = g.snapshot();
    settle(g);
    g.move(1, 0);
    g.drop(true);
    expect(g.snapshot()).toEqual(s);
    g.pause();
    g.lesson(2);
    g.drop(true);
    g.pause();
    const resolving = g.snapshot();
    settle(g);
    expect(g.snapshot()).toEqual(resolving);
    g.pause();
    settle(g);
    expect(g.snapshot().chain).toBe(2);
  });
  it.each([1, 2, 3] as const)("resolves playable %i-chain fixtures", (n) => {
    const g = new GameEngine();
    g.lesson(n);
    const prediction = g.snapshot().ghost;
    g.drop(true);
    expect(g.snapshot().board).toEqual(expect.arrayContaining(prediction));
    settle(g);
    expect(g.snapshot().chain).toBe(n);
    expect(g.snapshot().score).toBe([40, 120, 280][n - 1]);
  });
  it("spawn blocked at the top ends the game; restart clears score and board", () => {
    const g = new GameEngine();
    g.loadFixture([{ pos: [1, HEIGHT - 1, 1], color: 1 }]);
    expect(g.snapshot().status).toBe("over");
    g.start();
    expect(g.snapshot().status).toBe("playing");
    expect(g.snapshot().board).toEqual([]);
    expect(g.snapshot().score).toBe(0);
  });
  it("increases level every ten locked pairs", () => {
    const g = new GameEngine(() => 0.2);
    g.start();
    for (let i = 0; i < 10; i++) {
      const targetX = i % 4,
        targetZ = Math.floor(i / 4);
      let s = g.snapshot();
      g.move(targetX - s.active[0].pos[0], targetZ - s.active[0].pos[2]);
      g.drop(true);
      for (let t = 0; t < 20 && g.snapshot().status === "resolving"; t++)
        g.tick(100);
      s = g.snapshot();
      expect(s.status).toBe("playing");
    }
    expect(g.snapshot().level).toBe(2);
  });
  it("snapshots cannot mutate live state", () => {
    const g = new GameEngine();
    g.start();
    const s = g.snapshot();
    s.next[0] = [4, 4];
    s.board.push({ pos: [0, 0, 0], color: 1 });
    expect(g.snapshot().board).toEqual([]);
  });
});
