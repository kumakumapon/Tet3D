import * as THREE from "three";
import { key, type Cube } from "../game/board";
import type { Snapshot } from "../game/engine";
export const COLORS = ["#000000", "#ff6579", "#64baff", "#78e6b0", "#ffd76b"];
export const NAMES = ["", "RED", "BLUE", "GREEN", "YELLOW"];
export const SYMBOLS = ["", "●", "◆", "▲", "■"];
export const PRESETS = [
  "ISO",
  "FRONT",
  "RIGHT",
  "BACK",
  "LEFT",
  "TOP",
] as const;
export type Preset = (typeof PRESETS)[number];
export class GameRenderer {
  private scene = new THREE.Scene();
  private camera = new THREE.OrthographicCamera(-6, 6, 7, -7, 0.1, 100);
  private renderer: THREE.WebGLRenderer;
  private geometry = new THREE.BoxGeometry(0.86, 0.86, 0.86);
  private settled: THREE.InstancedMesh;
  private active: THREE.InstancedMesh;
  private ghost: THREE.InstancedMesh;
  private edges: THREE.LineSegments;
  private resize: ResizeObserver;
  private matrix = new THREE.Matrix4();
  private color = new THREE.Color();
  private preset: Preset = "ISO";
  private materials: THREE.Material[] = [];
  constructor(private host: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.domElement.setAttribute(
      "aria-label",
      "3D盤面。列の色と高さは右のTOP VIEWでも確認できます",
    );
    this.renderer.domElement.setAttribute("role", "img");
    host.append(this.renderer.domElement);
    this.scene.add(new THREE.HemisphereLight(0xcdeeff, 0x263548, 3));
    const light = new THREE.DirectionalLight(0xffffff, 3);
    light.position.set(4, 10, 6);
    this.scene.add(light);
    const make = (count: number, opacity = 1) => {
      const material = new THREE.MeshStandardMaterial({
        roughness: 0.3,
        metalness: 0.15,
        transparent: opacity < 1,
        opacity,
        depthWrite: opacity === 1,
      });
      this.materials.push(material);
      const mesh = new THREE.InstancedMesh(this.geometry, material, count);
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.frustumCulled = false;
      this.scene.add(mesh);
      mesh.count = 0;
      return mesh;
    };
    this.settled = make(160);
    this.active = make(2);
    this.ghost = make(2, 0.25);
    const outline = new THREE.EdgesGeometry(new THREE.BoxGeometry(4, 10, 4));
    const lineMaterial = new THREE.LineBasicMaterial({
      color: 0x4f758d,
      transparent: true,
      opacity: 0.5,
    });
    this.materials.push(lineMaterial);
    this.edges = new THREE.LineSegments(outline, lineMaterial);
    this.edges.position.set(1.5, 4.5, 1.5);
    this.scene.add(this.edges);
    const grid = new THREE.GridHelper(4, 4, 0x80aebf, 0x355268);
    grid.position.set(1.5, -0.5, 1.5);
    this.scene.add(grid);
    this.resize = new ResizeObserver(() => this.size());
    this.resize.observe(host);
    this.setCamera("ISO");
  }
  setCamera(preset: Preset) {
    this.preset = preset;
    const positions: Record<Preset, number[]> = {
      ISO: [12, 12, 15],
      FRONT: [1.5, 4.5, 22],
      RIGHT: [22, 4.5, 1.5],
      BACK: [1.5, 4.5, -22],
      LEFT: [-22, 4.5, 1.5],
      TOP: [1.5, 25, 1.5],
    };
    this.camera.position.fromArray(positions[preset]);
    this.camera.up.set(0, preset === "TOP" ? 0 : 1, preset === "TOP" ? -1 : 0);
    this.camera.lookAt(1.5, 4, 1.5);
    this.size();
  }
  private size() {
    const width = this.host.clientWidth,
      height = this.host.clientHeight;
    if (!width || !height) return;
    this.renderer.setSize(width, height, false);
    const span = this.preset === "TOP" ? 3.6 : 7.2,
      aspect = width / height;
    this.camera.left = -span * Math.max(1, aspect);
    this.camera.right = -this.camera.left;
    this.camera.top = span / Math.min(1, aspect);
    this.camera.bottom = -this.camera.top;
    this.camera.updateProjectionMatrix();
  }
  private fill(
    mesh: THREE.InstancedMesh,
    cells: Cube[],
    highlights: Set<string>,
    clearing: Set<string>,
    time: number,
    reduced: boolean,
  ) {
    mesh.count = cells.length;
    cells.forEach((c, i) => {
      const isClear = clearing.has(key(c.pos)),
        pulse = isClear && !reduced ? 0.78 + 0.18 * Math.sin(time / 90) : 1;
      this.matrix.makeScale(pulse, pulse, pulse);
      this.matrix.setPosition(...c.pos);
      mesh.setMatrixAt(i, this.matrix);
      this.color.set(COLORS[c.color]);
      if (highlights.has(key(c.pos)))
        this.color.lerp(new THREE.Color("white"), 0.3);
      if (isClear) this.color.lerp(new THREE.Color("white"), 0.6);
      mesh.setColorAt(i, this.color);
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }
  render(s: Snapshot, time: number, reduced: boolean) {
    const highlights = new Set(s.connected.flat().map((c) => key(c.pos))),
      clearing = new Set(s.clearing.map((c) => key(c.pos)));
    this.fill(this.settled, s.board, highlights, clearing, time, reduced);
    this.fill(this.active, s.active, new Set(), new Set(), time, reduced);
    this.fill(this.ghost, s.ghost, new Set(), new Set(), time, reduced);
    this.renderer.render(this.scene, this.camera);
  }
  dispose() {
    this.resize.disconnect();
    this.scene.traverse((object) => {
      if (
        object instanceof THREE.Mesh ||
        object instanceof THREE.LineSegments
      ) {
        object.geometry.dispose();
        const materials = Array.isArray(object.material)
          ? object.material
          : [object.material];
        materials.forEach((m: THREE.Material) => m.dispose());
      }
    });
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
