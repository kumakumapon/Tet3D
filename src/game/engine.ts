import { Board, type Color, type Cube, type Vec } from "./board";
import {
  ColorRandomizer,
  cubes,
  fits,
  landed,
  project,
  translated,
  type Pair,
} from "./pair";
import { scoreGroups } from "./resolve";
export type Status = "title" | "playing" | "resolving" | "paused" | "over";
export interface Snapshot {
  board: Cube[];
  active: Cube[];
  ghost: Cube[];
  connected: Cube[][];
  clearing: Cube[];
  next: (readonly [Color, Color])[];
  status: Status;
  score: number;
  level: number;
  placed: number;
  chain: number;
  bestChain: number;
  perfect: boolean;
  event: number;
}
export class GameEngine {
  private board = new Board();
  private pair: Pair | null = null;
  private factory: ColorRandomizer;
  private queue: [Color, Color][] = [];
  private status: Status = "title";
  private resumeStatus: Status = "playing";
  private score = 0;
  private placed = 0;
  private chain = 0;
  private bestChain = 0;
  private clock = 0;
  private phase: "search" | "clear" = "search";
  private clearing: Cube[][] = [];
  private perfect = false;
  private event = 0;
  constructor(random: () => number = Math.random) {
    this.factory = new ColorRandomizer(random);
  }
  get level() {
    return 1 + Math.floor(this.placed / 10);
  }
  start() {
    this.board.clear();
    this.queue = [this.factory.pair(), this.factory.pair()];
    this.score = 0;
    this.placed = 0;
    this.chain = 0;
    this.bestChain = 0;
    this.clock = 0;
    this.perfect = false;
    this.clearing = [];
    this.status = "playing";
    this.spawn();
  }
  private spawn() {
    this.pair = {
      pivot: [1, 8, 1],
      orientation: 0,
      colors: this.queue.shift()!,
    };
    this.queue.push(this.factory.pair());
    this.clock = 0;
    if (!fits(this.board, this.pair)) {
      this.pair = null;
      this.status = "over";
      this.event++;
    } else this.status = "playing";
  }
  move(x: number, z: number) {
    if (this.status !== "playing" || !this.pair) return false;
    const p = translated(this.pair, [x, 0, z]);
    if (!fits(this.board, p)) return false;
    this.pair = p;
    return true;
  }
  rotate(direction: number) {
    if (this.status !== "playing" || !this.pair) return false;
    const p = {
      ...this.pair,
      orientation: (this.pair.orientation + direction + 5) % 5,
    };
    if (!fits(this.board, p)) return false;
    this.pair = p;
    return true;
  }
  drop(hard = false) {
    if (this.status !== "playing" || !this.pair) return;
    if (hard) {
      this.pair = landed(this.board, this.pair);
      this.lock();
      return;
    }
    const p = translated(this.pair, [0, -1, 0]);
    if (fits(this.board, p)) this.pair = p;
    else this.lock();
  }
  private lock() {
    for (const c of cubes(this.pair!)) this.board.set(c.pos, c.color);
    this.pair = null;
    this.placed++;
    this.chain = 0;
    this.perfect = false;
    this.board.gravity();
    this.status = "resolving";
    this.phase = "search";
    this.clock = 0;
    this.clearing = [];
  }
  pause() {
    if (this.status === "paused") this.status = this.resumeStatus;
    else if (this.status === "playing" || this.status === "resolving") {
      this.resumeStatus = this.status;
      this.status = "paused";
    }
  }
  tick(ms: number, soft = false) {
    if (this.status !== "playing" && this.status !== "resolving") return;
    this.clock += Math.max(0, Math.min(ms, 100));
    if (this.status === "playing") {
      const interval = soft ? 45 : Math.max(150, 1000 - (this.level - 1) * 100);
      if (this.clock >= interval) {
        this.clock = 0;
        this.drop();
      }
      return;
    }
    if (this.clock < (this.phase === "clear" ? 420 : 220)) return;
    this.clock = 0;
    if (this.phase === "clear") {
      this.clearing.flat().forEach((c) => this.board.set(c.pos, 0));
      this.clearing = [];
      this.board.gravity();
      this.phase = "search";
      return;
    }
    const groups = this.board.groups();
    if (groups.length) {
      this.chain++;
      this.bestChain = Math.max(this.bestChain, this.chain);
      this.score += scoreGroups(groups, this.chain);
      this.clearing = groups;
      this.phase = "clear";
      this.event++;
    } else {
      if (this.chain > 0 && this.board.cubes().length === 0) {
        this.score += 5000;
        this.perfect = true;
        this.event++;
      }
      this.spawn();
    }
  }
  snapshot(): Snapshot {
    const prediction = this.pair ? project(this.board, this.pair) : null;
    return {
      board: this.board.cubes(),
      active: this.pair
        ? cubes(this.pair).map((c) => ({ ...c, pos: [...c.pos] as Vec }))
        : [],
      ghost: prediction?.ghost ?? [],
      connected: prediction?.connected ?? [],
      clearing: this.clearing
        .flat()
        .map((c) => ({ ...c, pos: [...c.pos] as Vec })),
      next: this.queue.map((p) => [...p] as [Color, Color]),
      status: this.status,
      score: this.score,
      level: this.level,
      placed: this.placed,
      chain: this.chain,
      bestChain: this.bestChain,
      perfect: this.perfect,
      event: this.event,
    };
  }
  // Used by the guided tutorial and test-only adapter; never exposed on window in production.
  lesson(chain: 1 | 2 | 3) {
    this.start();
    this.board.clear();
    for (let x = 0; x < 3; x++) {
      this.board.set([x, 0, 0], 1);
      if (chain >= 2) this.board.set([x, 1, 0], 2);
      if (chain >= 3) this.board.set([x, 2, 0], 3);
    }
    if (chain >= 2) this.board.set([0, 0, 1], 2);
    if (chain >= 3) this.board.set([1, 0, 1], 3);
    this.pair = { pivot: [3, 8, 0], orientation: 0, colors: [1, 4] };
  }
  loadFixture(cells: Cube[], pair?: Pair) {
    this.start();
    this.board.clear();
    for (const c of cells) this.board.set(c.pos, c.color);
    if (pair) {
      this.pair = {
        ...pair,
        pivot: [...pair.pivot] as Vec,
        colors: [...pair.colors] as [Color, Color],
      };
      if (!fits(this.board, this.pair)) {
        this.pair = null;
        this.status = "over";
      }
    } else this.spawn();
  }
}
