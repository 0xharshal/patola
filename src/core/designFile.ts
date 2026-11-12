/**
 * Design files (.patola.json): the design's share query plus the user's own
 * motifs it uses, so nothing is lost when a file is sent to someone else.
 *
 * Storing the query (instead of raw state) means opening a file goes through
 * exactly the same validation as opening a link. Code in a file is shown but
 * only runs after the user presses Run, as with links.
 */
import { designToQuery, parseUrl } from './url';
import { getGenerator } from '../generators/registry';
import { BODY_ZONE } from '../layouts/types';
import { zoneFill, type Design } from './design';
import { getLayout } from '../layouts/registry';
import { getMotif, saveMotif, USER_MOTIF_PREFIX, type Motif } from '../motifs/library';
import { motifFromFile, motifToFile, type MotifFile } from '../motifs/format';

export const DESIGN_FILE_FORMAT = 'patola-design';
export const DESIGN_FILE_VERSION = 1;

interface EmbeddedMotif extends MotifFile {
  id: string;
  colours: string[];
}

export interface DesignFile {
  format: typeof DESIGN_FILE_FORMAT;
  version: number;
  /** The readable share query, without the leading '?'. */
  query: string;
  motifs: EmbeddedMotif[];
}

/** Ids of the user's own motifs used anywhere in the design. */
export function userMotifIds(design: Design): string[] {
  const zoneIds = [BODY_ZONE, ...getLayout(design.layout).zones.map((zone) => zone.id)];
  const ids = new Set<string>();
  for (const zoneId of zoneIds) {
    const fill = zoneFill(design, zoneId);
    for (const def of getGenerator(fill.generator).params) {
      const value = fill.params[def.key];
      if (def.type === 'asset' && typeof value === 'string' && value.startsWith(USER_MOTIF_PREFIX)) ids.add(value);
    }
  }
  return [...ids];
}

export function designToFile(design: Design): DesignFile {
  const motifs = userMotifIds(design)
    .map((id) => getMotif(id))
    .filter((motif): motif is Motif => motif !== undefined)
    .map((motif) => ({ ...motifToFile(motif.name, motif), id: motif.id, colours: motif.colours }));
  return { format: DESIGN_FILE_FORMAT, version: DESIGN_FILE_VERSION, query: designToQuery(design), motifs };
}

/**
 * Read a design file: adds its motifs to this browser's library (motifs that
 * are already here are kept as they are) and returns the design.
 */
export function designFromFile(json: unknown): { design: Design; addedMotifs: number } | { error: string } {
  const file = json as Partial<DesignFile>;
  if (file?.format !== DESIGN_FILE_FORMAT || typeof file.query !== 'string')
    return { error: 'This is not a patola design file.' };

  let addedMotifs = 0;
  for (const embedded of Array.isArray(file.motifs) ? file.motifs : []) {
    if (typeof embedded?.id !== 'string' || !embedded.id.startsWith(USER_MOTIF_PREFIX) || getMotif(embedded.id))
      continue;
    const parsed = motifFromFile(embedded);
    if ('error' in parsed) continue;
    const colours = Array.isArray(embedded.colours)
      ? embedded.colours.filter((colour) => typeof colour === 'string')
      : [];
    saveMotif({ id: embedded.id, name: parsed.name, colours, ...parsed.motif });
    addedMotifs++;
  }
  return { design: parseUrl(`?${file.query.replace(/^\?/, '')}`).design, addedMotifs };
}
