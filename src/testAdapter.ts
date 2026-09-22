import type { GameEngine } from "./game/engine";
import type { Cube } from "./game/board";
export function install(game: GameEngine, draw: () => void) {
  const api = {
    snapshot: () => game.snapshot(),
    fixture: (name: string) => {
      if (name === "over") {
        const cells: Cube[] = Array.from({ length: 10 }, (_, y) => ({
          pos: [1, y, 1],
          color: y % 2 ? 1 : 2,
        }));
        game.loadFixture(cells);
      } else if (name === "perfect") {
        game.loadFixture(
          [
            { pos: [0, 0, 0], color: 1 },
            { pos: [1, 0, 0], color: 1 },
          ],
          { pivot: [2, 8, 0], orientation: 1, colors: [1, 1] },
        );
      } else game.lesson(Number(name) as 1 | 2 | 3);
      draw();
    },
  };
  Object.assign(window, { __cascade: api });
}
export type TestAPI = {
  snapshot: () => ReturnType<GameEngine["snapshot"]>;
  fixture: (name: string) => void;
};
declare global {
  interface Window {
    __cascade: TestAPI;
  }
}
