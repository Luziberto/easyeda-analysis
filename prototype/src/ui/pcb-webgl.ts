// Render PCB com WebGL2 (trilhas, pads, pour, contorno).
import type { PcbBoard } from '../core/pcb-types.js';
import { FOOTPRINTS } from '../core/pcb-library.js';

export function createPcbWebGl(canvas: HTMLCanvasElement) {
  const gl = canvas.getContext('webgl2', { antialias: true });
  if (!gl) return null;

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

  return {
    render(board: PcbBoard | null, vp: { x: number; y: number; scale: number }, width: number, height: number) {
      if (!board) return;
      gl.viewport(0, 0, width, height);
      gl.clearColor(0.06, 0.09, 0.12, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);
      setColor(0.95, 0.45, 0.7);
      lineStrip(board.outline, vp.scale, vp.x, vp.y, width, height);
      for (const pour of board.pours ?? []) {
        setColor(0.85, 0.65, 0.1, 0.35);
        fillPoly(pour.points, vp.scale, vp.x, vp.y, width, height);
      }
      for (const t of board.tracks) {
        if (t.layer === 'bottom') setColor(0.4, 0.6, 0.95);
        else setColor(0.95, 0.75, 0.2);
        lineStrip(t.points, vp.scale, vp.x, vp.y, width, height);
      }
      for (const fp of board.footprints) {
        setColor(0.7, 0.45, 0.15);
        for (const p of FOOTPRINTS[fp.kind].pads) {
          const cx = fp.x + p.x;
          const cy = fp.y + p.y;
          lineStrip([
            { x: cx - p.w / 2, y: cy - p.h / 2 },
            { x: cx + p.w / 2, y: cy - p.h / 2 },
            { x: cx + p.w / 2, y: cy + p.h / 2 },
            { x: cx - p.w / 2, y: cy + p.h / 2 },
            { x: cx - p.w / 2, y: cy - p.h / 2 },
          ], vp.scale, vp.x, vp.y, width, height);
        }
      }
      setColor(0.9, 0.75, 0.1);
      for (const v of board.vias ?? []) {
        lineStrip([
          { x: v.x - 2, y: v.y },
          { x: v.x + 2, y: v.y },
        ], vp.scale, vp.x, vp.y, width, height);
      }
    },
  };
}
