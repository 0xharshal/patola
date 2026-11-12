import { FRAGMENT_SHADER, IMAGE_FRAGMENT_SHADER, VERTEX_SHADER } from './shaders';
import { hexToRgb, ZARI_COLOUR } from '../palettes/presets';
import type { RenderMode, RenderSettings } from '../core/design';
import type { Grid } from '../core/compose';
import { ZARI_SLOT } from '../generators/types';
import type { Rect } from '../layouts/types';

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

/**
 * Where the lamp hangs over `area` (in threads): off to the side the light comes
 * from (0° = from the top, 90° = from the right) and as high as the area is large,
 * so every part of the cloth sees it from a slightly different angle. Returns
 * piece x, y and height, in threads.
 */
export function lampPosition(area: Rect, fromDegrees: number): [number, number, number] {
  const size = Math.max(area.width, area.height);
  const radians = (fromDegrees * Math.PI) / 180;
  return [
    area.x + area.width / 2 + Math.sin(radians) * 0.6 * size,
    area.y + area.height / 2 - Math.cos(radians) * 0.6 * size,
    0.7 * size,
  ];
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
  /** Area the lamp is placed over (threads); default: the visible part. Tiled exports pass the whole image. */
  lightArea?: Rect;
}

export class WebGLUnavailableError extends Error {}

/** Draws a design grid as woven double-ikat cloth with WebGL2. */
/** Part of the piece rendered once into a texture, to show again and again (see renderImage). */
export interface RenderedImage {
  /** Piece area shown, in threads. */
  area: Rect;
  width: number;
  height: number;
  /** Rows rendered so far (rendering is spread over several calls). */
  rowsDone: number;
  /** The weave context it belongs to; images don't survive a lost context. */
  generation: number;
  texture: WebGLTexture;
  framebuffer: WebGLFramebuffer;
}

export class PatolaRenderer {
  private gl: WebGL2RenderingContext;
  private program!: WebGLProgram;
  private imageProgram!: WebGLProgram;
  private vertexArray!: WebGLVertexArrayObject;
  /** Increases when the context is restored after a loss, which drops all textures. */
  private generation = 0;
  private gridTexture!: WebGLTexture;
  private uniformLocations = new Map<WebGLProgram, Map<string, WebGLUniformLocation | null>>();
  private uploadedGrid: Grid | null = null;
  private lastFrame: Frame | null = null;

  /** `gpu`: which graphics card to ask the browser for; it decides. */
  constructor(
    private canvas: HTMLCanvasElement,
    gpu: WebGLPowerPreference = 'default',
  ) {
    const gl = canvas.getContext('webgl2', { antialias: false, preserveDrawingBuffer: false, powerPreference: gpu });
    if (!gl) throw new WebGLUnavailableError('WebGL2 is not available in this browser.');
    // Palette colours are sRGB; say so, so colour-managed (e.g. wide-gamut) screens show them exactly.
    gl.drawingBufferColorSpace = 'srgb';
    this.gl = gl;
    this.createResources();

    canvas.addEventListener('webglcontextlost', (event) => event.preventDefault());
    canvas.addEventListener('webglcontextrestored', () => {
      this.uniformLocations.clear();
      this.uploadedGrid = null;
      this.generation++;
      this.createResources();
      if (this.lastFrame) this.draw(this.lastFrame);
    });
  }

  private link(fragmentSource: string): WebGLProgram {
    const gl = this.gl;
    const vertexShader = this.compile(gl.VERTEX_SHADER, VERTEX_SHADER);
    const fragmentShader = this.compile(gl.FRAGMENT_SHADER, fragmentSource);
    const program = gl.createProgram()!;
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS))
      throw new Error(`Shader link failed: ${gl.getProgramInfoLog(program)}`);
    gl.deleteShader(vertexShader);
    gl.deleteShader(fragmentShader);
    return program;
  }

  private createResources(): void {
    const gl = this.gl;
    this.program = this.link(FRAGMENT_SHADER);
    this.imageProgram = this.link(IMAGE_FRAGMENT_SHADER);
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

  private uniform(name: string, program = this.program): WebGLUniformLocation | null {
    let locations = this.uniformLocations.get(program);
    if (!locations) this.uniformLocations.set(program, (locations = new Map()));
    if (!locations.has(name)) locations.set(name, this.gl.getUniformLocation(program, name));
    return locations.get(name)!;
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
    if (this.gl.isContextLost()) return;
    this.resizeCanvas(frame.view);
    this.gl.viewport(0, 0, frame.view.width, frame.view.height);
    this.drawWeave(frame, false);
  }

  private resizeCanvas(view: View): void {
    if (this.canvas.width !== view.width) this.canvas.width = view.width;
    if (this.canvas.height !== view.height) this.canvas.height = view.height;
  }

  /** Draw the weave into the bound framebuffer, in sRGB or (for sRGB images) linear light. */
  private drawWeave(frame: Frame, linearOutput: boolean): void {
    const gl = this.gl;
    const { view, render } = frame;
    this.uploadGrid(frame.grid);
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
    const visible = {
      x: view.originX,
      y: view.originY,
      width: view.width / view.scale,
      height: view.height / view.scale,
    };
    gl.uniform3fv(this.uniform('uLight'), lampPosition(frame.lightArea ?? visible, render.light));
    gl.uniform1ui(this.uniform('uSeed'), frame.seed >>> 0);
    gl.uniform1i(this.uniform('uLinearOutput'), linearOutput ? 1 : 0);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  /** Largest image side this GPU supports. */
  maxImageSide(): number {
    return this.gl.getParameter(this.gl.MAX_TEXTURE_SIZE);
  }

  /** An empty image of `area` (threads) at width × height pixels; fill it with renderImage. */
  createImage(area: Rect, width: number, height: number): RenderedImage {
    const gl = this.gl;
    const texture = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, texture);
    const levels = Math.floor(Math.log2(Math.max(width, height))) + 1;
    // sRGB storage: 8 bits where the eye needs them, and filtering in linear light.
    gl.texStorage2D(gl.TEXTURE_2D, levels, gl.SRGB8_ALPHA8, width, height);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const framebuffer = gl.createFramebuffer()!;
    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return { area, width, height, rowsDone: 0, generation: this.generation, texture, framebuffer };
  }

  /** Whether an image can still be used (a lost context drops it). */
  isImageValid(image: RenderedImage): boolean {
    return image.generation === this.generation && !this.gl.isContextLost();
  }

  /**
   * Render up to `maxPixels` more of an image (whole rows), so big images can be
   * prepared a little per frame. Returns true once the image is complete.
   */
  renderImage(image: RenderedImage, frame: Omit<Frame, 'view'>, maxPixels: number): boolean {
    const gl = this.gl;
    if (image.rowsDone >= image.height) return true;
    if (!this.isImageValid(image)) return false;
    const rows = Math.min(image.height - image.rowsDone, Math.max(1, Math.floor(maxPixels / image.width)));
    gl.bindFramebuffer(gl.FRAMEBUFFER, image.framebuffer);
    gl.viewport(0, 0, image.width, image.height);
    gl.enable(gl.SCISSOR_TEST);
    // Rows count from the top of the area; the framebuffer's y runs bottom-up.
    gl.scissor(0, image.height - image.rowsDone - rows, image.width, rows);
    this.drawWeave(
      {
        ...frame,
        view: {
          width: image.width,
          height: image.height,
          originX: image.area.x,
          originY: image.area.y,
          scale: image.width / image.area.width,
        },
      },
      true,
    );
    gl.disable(gl.SCISSOR_TEST);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    image.rowsDone += rows;
    if (image.rowsDone < image.height) return false;
    gl.bindTexture(gl.TEXTURE_2D, image.texture);
    gl.generateMipmap(gl.TEXTURE_2D);
    return true;
  }

  /** Clear the canvas to `background` at the view's size. */
  clear(view: View, background: string): void {
    const gl = this.gl;
    if (gl.isContextLost()) return;
    this.resizeCanvas(view);
    gl.viewport(0, 0, view.width, view.height);
    const [red, green, blue] = hexToRgb(background);
    gl.clearColor(red / 255, green / 255, blue / 255, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
  }

  /** Show a complete image in the view, blended over what is there; parts it doesn't cover stay. */
  drawImage(image: RenderedImage, view: View, opacity = 1): void {
    const gl = this.gl;
    if (!this.isImageValid(image)) return;
    const program = this.imageProgram;
    gl.useProgram(program);
    gl.bindVertexArray(this.vertexArray);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, image.texture);
    gl.uniform1i(this.uniform('uImage', program), 0);
    gl.uniform4f(this.uniform('uArea', program), image.area.x, image.area.y, image.area.width, image.area.height);
    gl.uniform2f(this.uniform('uViewSize', program), view.width, view.height);
    gl.uniform2f(this.uniform('uOrigin', program), view.originX, view.originY);
    gl.uniform1f(this.uniform('uScale', program), view.scale);
    gl.uniform1f(this.uniform('uOpacity', program), opacity);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.disable(gl.BLEND);
  }

  deleteImage(image: RenderedImage): void {
    if (!this.isImageValid(image)) return;
    this.gl.deleteFramebuffer(image.framebuffer);
    this.gl.deleteTexture(image.texture);
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

  /** Name of the graphics card drawing, as far as the browser tells (some hide or shorten it). */
  gpuName(): string {
    const gl = this.gl;
    const info = gl.getExtension('WEBGL_debug_renderer_info');
    return String(gl.getParameter(info ? info.UNMASKED_RENDERER_WEBGL : gl.RENDERER));
  }

  /** Release the GPU context (for one-off renderers such as image export). */
  dispose(): void {
    this.gl.getExtension('WEBGL_lose_context')?.loseContext();
  }
}
