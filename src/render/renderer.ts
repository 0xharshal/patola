import { FRAGMENT_SHADER, VERTEX_SHADER } from './shaders';
import { hexToRgb, ZARI_COLOUR } from '../palettes/presets';
import type { RenderMode, RenderSettings } from '../core/design';
import type { Grid } from '../core/compose';
import { ZARI_SLOT } from '../generators/types';

const MODE_INDEX: Record<RenderMode, number> = { flat: 0, woven: 1, realistic: 2 };
const THREAD_VIEW_INDEX: Record<RenderSettings['threads'], number> = { both: 0, warp: 1, weft: 2 };
const PALETTE_SIZE = 8;

/** sRGB channel (0…255) to linear light (0…1): the shader mixes and lights colours linearly. */
function srgbToLinear(channel: number): number {
  const value = channel / 255;
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

function linearRgb(hex: string): [number, number, number] {
  const [red, green, blue] = hexToRgb(hex);
  return [srgbToLinear(red), srgbToLinear(green), srgbToLinear(blue)];
}

/**
 * Samples per pixel along each axis. Threads only a few pixels wide alias in the
 * woven modes, so those pixels are supersampled (2 × 2); flat cells never need it.
 */
export function samplesPerAxis(mode: RenderMode, pixelsPerThread: number): number {
  return mode !== 'flat' && pixelsPerThread < 4 ? 2 : 1;
}

/** Which part of the piece to draw, and how large. */
export interface View {
  /** Render target size in pixels. */
  width: number;
  height: number;
  /** Piece position (in threads) at the top-left pixel. */
  originX: number;
  originY: number;
  /** Pixels per thread. */
  scale: number;
}

export interface Frame {
  grid: Grid;
  warpHorizontal: boolean;
  palette: string[];
  background: string;
  mode: RenderMode;
  render: RenderSettings;
  seed: number;
  view: View;
}

export class WebGLUnavailableError extends Error {}

/** Draws a design grid as woven double-ikat cloth with WebGL2. */
export class PatolaRenderer {
  private gl: WebGL2RenderingContext;
  private program!: WebGLProgram;
  private vertexArray!: WebGLVertexArrayObject;
  private gridTexture!: WebGLTexture;
  private uniformLocations = new Map<string, WebGLUniformLocation | null>();
  private uploadedGrid: Grid | null = null;
  private lastFrame: Frame | null = null;

  constructor(private canvas: HTMLCanvasElement) {
    const gl = canvas.getContext('webgl2', { antialias: false, preserveDrawingBuffer: false });
    if (!gl) throw new WebGLUnavailableError('WebGL2 is not available in this browser.');
    // Palette colours are sRGB; say so, so colour-managed (e.g. wide-gamut) screens show them exactly.
    gl.drawingBufferColorSpace = 'srgb';
    this.gl = gl;
    this.createResources();

    canvas.addEventListener('webglcontextlost', (event) => event.preventDefault());
    canvas.addEventListener('webglcontextrestored', () => {
      this.uniformLocations.clear();
      this.uploadedGrid = null;
      this.createResources();
      if (this.lastFrame) this.draw(this.lastFrame);
    });
  }

  private createResources(): void {
    const gl = this.gl;
    const vertexShader = this.compile(gl.VERTEX_SHADER, VERTEX_SHADER);
    const fragmentShader = this.compile(gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
    const program = gl.createProgram()!;
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS))
      throw new Error(`Shader link failed: ${gl.getProgramInfoLog(program)}`);
    gl.deleteShader(vertexShader);
    gl.deleteShader(fragmentShader);
    this.program = program;
    this.vertexArray = gl.createVertexArray()!;
    this.gridTexture = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, this.gridTexture);
    // Integer textures must use NEAREST filtering.
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  }

  private compile(type: number, source: string): WebGLShader {
    const gl = this.gl;
    const shader = gl.createShader(type)!;
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS))
      throw new Error(`Shader compile failed: ${gl.getShaderInfoLog(shader)}`);
    return shader;
  }

  private uniform(name: string): WebGLUniformLocation | null {
    if (!this.uniformLocations.has(name))
      this.uniformLocations.set(name, this.gl.getUniformLocation(this.program, name));
    return this.uniformLocations.get(name)!;
  }

  private uploadGrid(grid: Grid): void {
    if (grid === this.uploadedGrid) return;
    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, this.gridTexture);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8UI, grid.width, grid.height, 0, gl.RED_INTEGER, gl.UNSIGNED_BYTE, grid.slots);
    this.uploadedGrid = grid;
  }

  private paletteUniform(palette: string[]): Float32Array {
    const colours = new Float32Array(PALETTE_SIZE * 3);
    const withZari = [...palette.slice(0, ZARI_SLOT)];
    withZari[ZARI_SLOT] = ZARI_COLOUR;
    withZari.forEach((hex, slot) => {
      if (hex) colours.set(linearRgb(hex), slot * 3);
    });
    return colours;
  }

  draw(frame: Frame): void {
    this.lastFrame = frame;
    const gl = this.gl;
    if (gl.isContextLost()) return;
    const { view, render } = frame;
    if (this.canvas.width !== view.width) this.canvas.width = view.width;
    if (this.canvas.height !== view.height) this.canvas.height = view.height;

    this.uploadGrid(frame.grid);
    gl.viewport(0, 0, view.width, view.height);
    gl.useProgram(this.program);
    gl.bindVertexArray(this.vertexArray);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.gridTexture);

    gl.uniform1i(this.uniform('uGrid'), 0);
    gl.uniform2i(this.uniform('uGridSize'), frame.grid.width, frame.grid.height);
    gl.uniform3fv(this.uniform('uPalette'), this.paletteUniform(frame.palette));
    gl.uniform3fv(this.uniform('uBackground'), linearRgb(frame.background));
    gl.uniform2f(this.uniform('uViewSize'), view.width, view.height);
    gl.uniform2f(this.uniform('uOrigin'), view.originX, view.originY);
    gl.uniform1f(this.uniform('uScale'), view.scale);
    gl.uniform1i(this.uniform('uSamples'), samplesPerAxis(frame.mode, view.scale));
    gl.uniform1f(this.uniform('uThreadsPerCell'), render.step);
    gl.uniform1i(this.uniform('uWarpHorizontal'), frame.warpHorizontal ? 1 : 0);
    gl.uniform1i(this.uniform('uMode'), MODE_INDEX[frame.mode]);
    gl.uniform1i(this.uniform('uThreadView'), THREAD_VIEW_INDEX[render.threads]);
    gl.uniform1f(this.uniform('uBleed'), render.bleed);
    gl.uniform1f(this.uniform('uWarpJitter'), render.warpJitter);
    gl.uniform1f(this.uniform('uWeftJitter'), render.weftJitter);
    gl.uniform1f(this.uniform('uSheen'), render.sheen);
    gl.uniform1f(this.uniform('uTexture'), render.texture);
    gl.uniform1ui(this.uniform('uSeed'), frame.seed >>> 0);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  /** Pixels of the last draw as RGBA, top row first. Call right after draw(). */
  readPixels(): Uint8Array {
    const gl = this.gl;
    const { width, height } = this.canvas;
    const bottomUp = new Uint8Array(width * height * 4);
    gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, bottomUp);
    const topDown = new Uint8Array(bottomUp.length);
    const rowBytes = width * 4;
    for (let row = 0; row < height; row++) {
      topDown.set(bottomUp.subarray((height - 1 - row) * rowBytes, (height - row) * rowBytes), row * rowBytes);
    }
    return topDown;
  }

  /** Release the GPU context (for one-off renderers such as image export). */
  dispose(): void {
    this.gl.getExtension('WEBGL_lose_context')?.loseContext();
  }
}
