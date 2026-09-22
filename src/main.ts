import "./style.css";
import { GameEngine } from "./game/engine";
import {
  GameRenderer,
  COLORS,
  NAMES,
  SYMBOLS,
  PRESETS,
  type Preset,
} from "./renderer/renderer";
import { GameStorage, Sound } from "./storage/storage";
const app = document.querySelector<HTMLDivElement>("#app")!;
app.innerHTML = `
<header><a class="brand" href="./"><span class="brand-icon">◈</span><span>CUBE<span class="thin">CASCADE</span><small>3D COLOR CHAIN PUZZLE</small></span></a><span class="edition">TET3D / VOL. 01</span><button id="sound" aria-pressed="false">SOUND OFF</button></header>
<main><section class="intro"><div><p class="eyebrow">SMALL CUBES. BIG CONNECTIONS.</p><h1>つなげて、崩して、<span>連鎖する。</span></h1></div><p class="rule">同じ色を <b>4個以上</b> つなげると消える。<br>左右・上下・前後、立体のつながりを見つけよう。</p></section>
<div class="layout"><section class="arena" aria-label="ゲーム"><div class="arena-top"><span><i class="live-dot"></i>4 × 4 × 10</span><span id="status">READY TO CONNECT</span></div><div id="viewport"></div><div id="chain" role="status" aria-live="polite"></div><div id="overlay" class="overlay"></div><div class="arena-bottom"><span id="prediction">Ghost を見て、次の一手を。</span><span>+X → −Z ↑</span></div></section>
<aside><section class="panel stats"><p class="eyebrow">YOUR RUN</p><label>SCORE<strong id="score">000000</strong></label><div class="stat-row"><label>BEST<b id="best">0</b></label><label>LEVEL<b id="level">01</b></label><label>CHAIN<b id="best-chain">0</b></label></div></section>
<section class="panel"><p class="eyebrow">UP NEXT <span>2 PAIRS</span></p><div id="next" aria-label="次の2ペア"></div></section>
<section class="panel"><p class="eyebrow">TOP VIEW <span>−Z / 奥</span></p><div id="map" aria-label="各列の最上部の色と高さ"></div><p class="caption">数字は列の高さ。＋Z は手前。</p></section>
<section class="panel"><p class="eyebrow">CAMERA</p><div class="camera">${PRESETS.map((p) => `<button data-camera="${p}" aria-pressed="${p === "ISO"}">${p}</button>`).join("")}</div></section>
<div class="actions"><button id="pause">一時停止</button><button id="restart">やり直す</button></div></aside></div>
<section id="tutorial" class="tutorial" hidden aria-live="polite"></section>
<section class="controls"><div><p class="eyebrow">MAKE YOUR MOVE</p><p><kbd>A D</kbd> 左右 <kbd>W S</kbd> 奥・手前 <kbd>Q E</kbd> 回転 <kbd>Shift</kbd> 早く落下 <kbd>Space</kbd> 配置 <kbd>Esc</kbd> 停止</p></div><div class="legend">${[1, 2, 3, 4].map((c) => `<span style="color:${COLORS[c]}">${SYMBOLS[c]} ${NAMES[c]}</span>`).join("")}</div></section>
<section class="touch" aria-label="タッチ操作"><button data-action="back" aria-label="奥へ">↑ 奥</button><button data-action="left" aria-label="左へ">← 左</button><button data-action="front" aria-label="手前へ">↓ 手前</button><button data-action="right" aria-label="右へ">右 →</button><button data-action="ccw">↶ 回転</button><button data-action="cw">回転 ↷</button><button data-action="soft">↓ 落下</button><button data-action="hard" class="primary">配置</button></section>
<footer>色をつなぐ。奥行きを読む。<span>CUBE CASCADE — v0.1</span></footer></main>`;
const el = (id: string) => document.getElementById(id)!;
const game = new GameEngine(),
  storage = new GameStorage(),
  sound = new Sound();
let renderer: GameRenderer | null = null;
try {
  renderer = new GameRenderer(el("viewport"));
} catch {
  el("viewport").innerHTML =
    '<p class="webgl-error">3D描画には WebGL 2 が必要です。対応ブラウザで開いてください。</p>';
}
let soft = false,
  last = performance.now(),
  lastEvent = 0,
  uiKey = "",
  overlayKey = "",
  tutorialStep = -1;
const reduced = matchMedia("(prefers-reduced-motion: reduce)");
const lessons = [
  "A / D（または左右ボタン）で左右へ動かそう。",
  "W / S で奥と手前へ動かそう。",
  "Q / E で2個のCubeの向きを変えよう。",
  "半透明のGhostが着地位置。Spaceで配置しよう。",
  "赤3個の隣に赤いGhostがあります。Spaceで初CLEAR！",
  "青が落ちると次の色がつながります。Spaceで2 CHAINを体験！",
  "チュートリアル完了！ 通常プレイで連鎖を作ろう。",
];
function lessonView() {
  const box = el("tutorial");
  box.hidden = tutorialStep < 0;
  if (tutorialStep >= 0) {
    box.innerHTML = `<strong>LEARN ${Math.min(tutorialStep + 1, 6)} / 6</strong><span>${lessons[tutorialStep]}</span><button id="skip">${tutorialStep === 6 ? "通常プレイへ" : "終了"}</button>`;
    el("skip").onclick = () => start(false);
  }
}
function start(tutorial: boolean) {
  game.start();
  tutorialStep = tutorial ? 0 : -1;
  soft = false;
  last = performance.now();
  lessonView();
  draw();
}
function advance(action: string, success = true) {
  if (!success) return;
  if (
    (tutorialStep === 0 && ["left", "right"].includes(action)) ||
    (tutorialStep === 1 && ["back", "front"].includes(action)) ||
    (tutorialStep === 2 && ["cw", "ccw"].includes(action))
  ) {
    tutorialStep++;
    lessonView();
  }
}
function act(action: string) {
  const state = game.snapshot();
  if (state.status !== "playing") return;
  let success = true;
  switch (action) {
    case "left":
      success = game.move(-1, 0);
      break;
    case "right":
      success = game.move(1, 0);
      break;
    case "back":
      success = game.move(0, -1);
      break;
    case "front":
      success = game.move(0, 1);
      break;
    case "ccw":
      success = game.rotate(-1);
      break;
    case "cw":
      success = game.rotate(1);
      break;
    case "soft":
      game.drop();
      break;
    case "hard":
      game.drop(true);
      break;
  }
  advance(action, success);
  draw();
}
const keys: Record<string, string> = {
  a: "left",
  ArrowLeft: "left",
  d: "right",
  ArrowRight: "right",
  w: "back",
  ArrowUp: "back",
  s: "front",
  ArrowDown: "front",
  q: "ccw",
  e: "cw",
  " ": "hard",
};
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    event.preventDefault();
    soft = false;
    game.pause();
    draw();
    return;
  }
  if (
    event.target instanceof HTMLButtonElement &&
    [" ", "Enter"].includes(event.key)
  )
    return;
  const action = keys[event.key] ?? keys[event.key.toLowerCase()];
  if (event.key === "Shift") {
    event.preventDefault();
    soft = true;
  }
  if (action) {
    event.preventDefault();
    if (!event.repeat || !["hard", "cw", "ccw"].includes(action)) act(action);
  }
});
document.addEventListener("keyup", (e) => {
  if (e.key === "Shift") soft = false;
});
function suspend() {
  soft = false;
  const s = game.snapshot().status;
  if (s === "playing" || s === "resolving") game.pause();
  draw();
}
window.addEventListener("blur", suspend);
document.addEventListener("visibilitychange", () => {
  if (document.hidden) suspend();
});
document.querySelectorAll<HTMLButtonElement>("[data-action]").forEach(
  (b) =>
    (b.onclick = () => {
      act(b.dataset.action!);
      b.blur();
    }),
);
document.querySelectorAll<HTMLButtonElement>("[data-camera]").forEach(
  (b) =>
    (b.onclick = () => {
      renderer?.setCamera(b.dataset.camera as Preset);
      document
        .querySelectorAll("[data-camera]")
        .forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
      b.blur();
    }),
);
el("pause").onclick = () => {
  soft = false;
  game.pause();
  draw();
};
el("restart").onclick = () => {
  if (tutorialStep === 4 || tutorialStep === 5) {
    game.lesson(tutorialStep === 4 ? 1 : 2);
    draw();
  } else start(tutorialStep >= 0);
};
el("sound").onclick = () => {
  sound.enabled = !sound.enabled;
  if (sound.enabled) {
    try {
      sound.unlock();
      sound.play(1);
    } catch {
      sound.enabled = false;
    }
  }
  el("sound").textContent = sound.enabled ? "SOUND ON" : "SOUND OFF";
  el("sound").setAttribute("aria-pressed", String(sound.enabled));
};
function draw() {
  const s = game.snapshot();
  storage.record(s.score);
  const signature = JSON.stringify(s);
  if (signature !== uiKey) {
    uiKey = signature;
    el("score").textContent = String(s.score).padStart(6, "0");
    el("best").textContent = String(storage.score);
    el("level").textContent = String(s.level).padStart(2, "0");
    el("best-chain").textContent = String(s.bestChain);
    el("status").textContent = {
      title: "READY TO CONNECT",
      playing: "FIND YOUR CONNECTION",
      resolving: "CASCADE IN MOTION",
      paused: "PAUSED",
      over: "GAME OVER",
    }[s.status];
    el("pause").textContent = s.status === "paused" ? "再開" : "一時停止";
    (el("pause") as HTMLButtonElement).disabled = ["title", "over"].includes(
      s.status,
    );
    el("next").innerHTML = s.next
      .map(
        (pair, i) =>
          `<div class="next-pair"><span class="next-index">0${i + 1}</span>${pair.map((c) => `<span class="cube-chip" style="--cube:${COLORS[c]}" aria-label="${NAMES[c]}">${SYMBOLS[c]}</span>`).join("")}</div>`,
      )
      .join("");
    el("map").innerHTML = Array.from({ length: 16 }, (_, i) => {
      const x = i % 4,
        z = Math.floor(i / 4),
        column = s.board.filter((c) => c.pos[0] === x && c.pos[2] === z),
        top = column.at(-1),
        height = top ? top.pos[1] + 1 : 0,
        ghost = s.ghost.some((c) => c.pos[0] === x && c.pos[2] === z);
      return `<div class="map-cell ${ghost ? "target" : ""}" style="--cube:${COLORS[top?.color ?? 0]}" aria-label="列${x + 1},${z + 1} ${top ? NAMES[top.color] : "空"} 高さ${height}"><span>${top ? SYMBOLS[top.color] : "·"}</span><b>${height}</b></div>`;
    }).join("");
    el("prediction").textContent = s.connected.length
      ? s.connected
          .map(
            (g) =>
              `${NAMES[g[0].color]} ${g.length >= 4 ? "CLEAR" : "CONNECT"} ×${g.length}${g.length >= 4 ? "!" : ""}`,
          )
          .join(" / ")
      : "Ghost を見て、次の一手を。";
    el("chain").textContent = s.perfect
      ? "PERFECT CLEAR +5000"
      : s.chain > 0
        ? `${s.chain} CHAIN${s.chain >= 2 ? "!" : ""}`
        : "";
  }
  const currentOverlay = ["title", "paused", "over"].includes(s.status)
    ? s.status
    : "";
  if (
    currentOverlay !== overlayKey ||
    (!overlayKey && !el("overlay").children.length && s.status === "title")
  ) {
    overlayKey = currentOverlay;
    el("overlay").hidden = !currentOverlay;
    if (currentOverlay) {
      el("overlay").innerHTML =
        s.status === "title"
          ? '<div class="modal"><p class="eyebrow">WELCOME TO THE THIRD DIMENSION</p><h2>ひとつの色から、<br>連鎖がはじまる。</h2><p>4色、2個のCube、無限の組み合わせ。</p><button id="play" class="primary">PLAY →</button><button id="learn">はじめての方へ</button></div>'
          : s.status === "paused"
            ? '<div class="modal"><p class="eyebrow">TAKE YOUR TIME</p><h2>PAUSED</h2><button id="resume" class="primary">再開</button></div>'
            : `<div class="modal"><p class="eyebrow">ONE MORE CONNECTION?</p><h2>GAME OVER</h2><p>SCORE ${s.score} · BEST ${storage.score}</p><button id="again" class="primary">PLAY AGAIN</button></div>`;
      document
        .getElementById("play")
        ?.addEventListener("click", () => start(false));
      document
        .getElementById("learn")
        ?.addEventListener("click", () => start(true));
      document.getElementById("resume")?.addEventListener("click", () => {
        game.pause();
        draw();
      });
      document
        .getElementById("again")
        ?.addEventListener("click", () => start(false));
    }
  }
  if (s.event !== lastEvent) {
    lastEvent = s.event;
    if (s.clearing.length) sound.play(s.chain);
  }
}
function frame(time: number) {
  const dt = time - last;
  last = time;
  // Early tutorial steps are untimed; the player can learn at their own pace.
  if (
    tutorialStep < 0 ||
    tutorialStep === 6 ||
    game.snapshot().status === "resolving"
  )
    game.tick(dt, soft);
  const s = game.snapshot();
  if (s.status === "playing" && tutorialStep === 3 && s.placed > 0) {
    tutorialStep = 4;
    game.lesson(1);
    lessonView();
  } else if (s.status === "playing" && tutorialStep === 4 && s.chain >= 1) {
    tutorialStep = 5;
    game.lesson(2);
    lessonView();
  } else if (s.status === "playing" && tutorialStep === 5 && s.chain >= 2) {
    tutorialStep = 6;
    lessonView();
  }
  draw();
  renderer?.render(game.snapshot(), time, reduced.matches);
  requestAnimationFrame(frame);
}
// Vite removes this import and the complete debug adapter from production bundles.
if (
  import.meta.env.MODE === "e2e" &&
  new URLSearchParams(location.search).has("e2e")
)
  void import("./testAdapter").then(({ install }) => install(game, draw));
draw();
requestAnimationFrame(frame);
