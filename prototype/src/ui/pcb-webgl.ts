// Render PCB com WebGL2 (2D ou vista 3D axonométrica com rotação).
import type { PcbBoard } from '../core/pcb-types.js';
import { FOOTPRINTS } from '../core/pcb-library.js';

const BOARD_Z = 0;
const COMP_Z = 14;

export function createPcbWebGl(canvas: HTMLCanvasElement) {
  const gl = canvas.getContext('webgl2', { antialias: true });
  if (!gl) return null;

  let view3d = false;
  let yaw = 0.55;
  let pitch = 0.35;

  const vs = `#version 300 es
    in vec2 a_pos;
    uniform vec2 u_scale;
    uniform vec2 u_offset;
    void main() {
      vec2 p = (a_pos - u_offset) * u_scale;
      gl_Position = vec4(p, 0.0, 1.0);
    }`;
  const fs = `#version 300 es
    precision mediump float;
    uniform vec4 u_color;
    out vec4 outColor;
    void main() { outColor = u_color; }`;

  function compile(type: number, src: string) {
    const s = gl.createShader(type)!;
    gl.shaderSource(s, src);
    gl.compileShader(s);
    return s;
  }
  const prog = gl.createProgram()!;
  gl.attachShader(prog, compile(gl.VERTEX_SHADER, vs));
  gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, fs));
  gl.linkProgram(prog);
  gl.useProgram(prog);
  const locPos = gl.getAttribLocation(prog, 'a_pos');
  const locScale = gl.getUniformLocation(prog, 'u_scale');
  const locOff = gl.getUniformLocation(prog, 'u_offset');
  const locColor = gl.getUniformLocation(prog, 'u_color');
  const buf = gl.createBuffer();

  function setColor(r: number, g: number, b: number, a = 1) {
    gl.uniform4f(locColor, r, g, b, a);
  }

  function project3d(x: number, y: number, z: number, cx: number, cy: number): { x: number; y: number } {
    let px = x - cx;
    let py = y - cy;
    let pz = z;
    const cyaw = Math.cos(yaw);
    const syaw = Math.sin(yaw);
    const x1 = px * cyaw - py * syaw;
    const y1 = px * syaw + py * cyaw;
    const cp = Math.cos(pitch);
    const sp = Math.sin(pitch);
    const y2 = y1 * cp - pz * sp;
    const z2 = y1 * sp + pz * cp;
    const k = 0.42;
    return { x: x1 + cx + z2 * k * 0.12, y: y2 + cy - z2 * 0.52 + x1 * k * 0.08 };
  }

  function boardCenter(board: PcbBoard) {
    const xs = board.outline.map((p) => p.x);
    const ys = board.outline.map((p) => p.y);
    return { cx: (Math.min(...xs) + Math.max(...xs)) / 2, cy: (Math.min(...ys) + Math.max(...ys)) / 2 };
  }

  function mapPt(x: number, y: number, z: number, cx: number, cy: number, view3dOn: boolean) {
    return view3dOn ? project3d(x, y, z, cx, cy) : { x, y };
  }

  function lineStrip(points: { x: number; y: number }[], scale: number, ox: number, oy: number, w: number, h: number) {
    if (points.length < 2) return;
    const sx = 2 / w / scale;
    const sy = -2 / h / scale;
    gl.uniform2f(locScale, sx, sy);
    gl.uniform2f(locOff, ox, oy);
    const data = new Float32Array(points.length * 2);
    points.forEach((p, i) => { data[i * 2] = p.x; data[i * 2 + 1] = p.y; });
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STREAM_DRAW);
    gl.enableVertexAttribArray(locPos);
    gl.vertexAttribPointer(locPos, 2, gl.FLOAT, false, 0, 0);
    gl.drawArrays(gl.LINE_STRIP, 0, points.length);
  }

  function fillPoly(points: { x: number; y: number }[], scale: number, ox: number, oy: number, w: number, h: number) {
    if (points.length < 3) return;
    const sx = 2 / w / scale;
    const sy = -2 / h / scale;
    gl.uniform2f(locScale, sx, sy);
    gl.uniform2f(locOff, ox, oy);
    const tris: number[] = [];
    for (let i = 1; i < points.length - 1; i++) {
      tris.push(points[0].x, points[0].y, points[i].x, points[i].y, points[i + 1].x, points[i + 1].y);
    }
    const data = new Float32Array(tris);
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STREAM_DRAW);
    gl.enableVertexAttribArray(locPos);
    gl.vertexAttribPointer(locPos, 2, gl.FLOAT, false, 0, 0);
    gl.drawArrays(gl.TRIANGLES, 0, tris.length / 2);
  }

  function drawBox(
    cx: number, cy: number, w: number, h: number, z0: number, z1: number,
    pivotX: number, pivotY: number,
    scale: number, ox: number, oy: number, width: number, height: number,
  ) {
    const corners = [
      { x: cx - w / 2, y: cy - h / 2 },
      { x: cx + w / 2, y: cy - h / 2 },
      { x: cx + w / 2, y: cy + h / 2 },
      { x: cx - w / 2, y: cy + h / 2 },
    ];
    const bot = corners.map((c) => mapPt(c.x, c.y, z0, pivotX, pivotY, true));
    const top = corners.map((c) => mapPt(c.x, c.y, z1, pivotX, pivotY, true));
    lineStrip([...bot, bot[0]], scale, ox, oy, width, height);
    lineStrip([...top, top[0]], scale, ox, oy, width, height);
    for (let i = 0; i < 4; i++) lineStrip([bot[i], top[i]], scale, ox, oy, width, height);
    setColor(0.35, 0.4, 0.45, 0.5);
    fillPoly(top, scale, ox, oy, width, height);
  }

  return {
    setView3d(on: boolean) { view3d = on; },
    isView3d: () => view3d,
    addRotation(dYaw: number, dPitch: number) {
      yaw += dYaw;
      pitch = Math.max(-1.1, Math.min(1.1, pitch + dPitch));
    },
    resetRotation() { yaw = 0.55; pitch = 0.35; },
    render(board: PcbBoard | null, vp: { x: number; y: number; scale: number }, width: number, height: number) {
      if (!board) return;
      gl.viewport(0, 0, width, height);
      gl.clearColor(0.06, 0.09, 0.12, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);

      const { cx, cy } = boardCenter(board);
      const P = (x: number, y: number, z = BOARD_Z) => mapPt(x, y, z, cx, cy, view3d);

      const outlinePts = board.outline.map((p) => P(p.x, p.y, BOARD_Z));

      setColor(0.95, 0.45, 0.7);
      lineStrip(outlinePts, vp.scale, vp.x, vp.y, width, height);
      if (view3d) {
        setColor(0.12, 0.16, 0.14, 0.9);
        fillPoly(outlinePts, vp.scale, vp.x, vp.y, width, height);
      }

      for (const pour of board.pours ?? []) {
        setColor(0.85, 0.65, 0.1, 0.35);
        const pts = pour.points.map((p) => P(p.x, p.y, BOARD_Z + 0.5));
        fillPoly(pts, vp.scale, vp.x, vp.y, width, height);
      }
      for (const t of board.tracks) {
        if (t.layer === 'bottom') setColor(0.4, 0.6, 0.95);
        else setColor(0.95, 0.75, 0.2);
        const z = t.layer === 'bottom' ? BOARD_Z - 0.5 : BOARD_Z + 0.5;
        lineStrip(t.points.map((p) => P(p.x, p.y, z)), vp.scale, vp.x, vp.y, width, height);
      }

      for (const fp of board.footprints) {
        const def = FOOTPRINTS[fp.kind];
        if (view3d) {
          setColor(0.55, 0.58, 0.62);
          drawBox(fp.x, fp.y, def.w, def.h, BOARD_Z + 1, BOARD_Z + COMP_Z, cx, cy, vp.scale, vp.x, vp.y, width, height);
        }
        setColor(0.7, 0.45, 0.15);
        for (const p of def.pads) {
          const px = fp.x + p.x;
          const py = fp.y + p.y;
          const pad = [
            P(px - p.w / 2, py - p.h / 2, BOARD_Z + 1.2),
            P(px + p.w / 2, py - p.h / 2, BOARD_Z + 1.2),
            P(px + p.w / 2, py + p.h / 2, BOARD_Z + 1.2),
            P(px - p.w / 2, py + p.h / 2, BOARD_Z + 1.2),
            P(px - p.w / 2, py - p.h / 2, BOARD_Z + 1.2),
          ];
          lineStrip(pad, vp.scale, vp.x, vp.y, width, height);
        }
      }
      setColor(0.9, 0.75, 0.1);
      for (const v of board.vias ?? []) {
        lineStrip(
          [P(v.x, v.y, BOARD_Z), P(v.x, v.y, BOARD_Z + COMP_Z * 0.6)],
          vp.scale, vp.x, vp.y, width, height,
        );
      }
    },
  };
}
