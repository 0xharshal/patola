/** One entry point for every export format, used by the export dialog and by `download=` links. */
import type { Composition } from '../core/compose';
import { renderSettings, type Design } from '../core/design';
import { designToFile } from '../core/designFile';
import type { ExportFormat } from '../core/url';
import type { Size } from '../layouts/types';
import { exportJpeg, exportPng, type ExportProgress, type FrameWithoutView } from './raster';
import { imageSize } from './sizes';
import { buildSvg } from './svg';

export interface ExportSource {
  design: Design;
  composition: Composition;
  frame: FrameWithoutView;
  pieceThreads: Size;
}

export interface ExportJob {
  format: ExportFormat;
  /** Image scale; ignored for design files. */
  pixelsPerThread: number;
  /** 0…1, JPG only. */
  jpegQuality?: number;
}

export interface ExportResult {
  blob: Blob;
  filename: string;
}

export const FORMAT_LABELS: Record<ExportFormat, string> = {
  png: 'PNG',
  jpg: 'JPG',
  svg: 'SVG',
  design: 'Design file',
};

export async function runExport(
  job: ExportJob,
  source: ExportSource,
  progress: ExportProgress = {},
): Promise<ExportResult> {
  const { design, composition, frame, pieceThreads } = source;
  const baseName = `patola-${design.layout}-${design.generator}-${design.seed}`;
  const size = imageSize(pieceThreads, job.pixelsPerThread);
  const sizeSuffix = `${size.width}x${size.height}`;

  switch (job.format) {
    case 'png':
      return {
        blob: await exportPng(frame, size, job.pixelsPerThread, progress),
        filename: `${baseName}-${sizeSuffix}.png`,
      };
    case 'jpg':
      return {
        blob: await exportJpeg(frame, size, job.pixelsPerThread, job.jpegQuality ?? 0.92, progress),
        filename: `${baseName}-${sizeSuffix}.jpg`,
      };
    case 'svg': {
      const pixelsPerCell = job.pixelsPerThread * renderSettings(design.render).step;
      const svg = buildSvg(
        composition.grid,
        design.palette,
        pixelsPerCell,
        `Patola design (${design.layout}, ${design.generator})`,
      );
      return { blob: new Blob([svg], { type: 'image/svg+xml' }), filename: `${baseName}.svg` };
    }
    case 'design':
      return {
        blob: new Blob([JSON.stringify(designToFile(design), null, 2)], { type: 'application/json' }),
        filename: `${baseName}.patola.json`,
      };
  }
}
