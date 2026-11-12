import type { Generator } from './types';
import { navratna } from './navratna';
import { phool } from './phool';
import { pan } from './pan';
import { chhabadi } from './chhabadi';
import { ratanChowk } from './ratanChowk';
import { diamonds } from './diamonds';
import { chowkdi } from './chowkdi';
import { stripes } from './stripes';
import { kinar } from './kinar';
import { imageMotif } from './imageMotif';
import { nariKunjar } from './nariKunjar';
import { customCode } from './customCode';
import { withRotation } from './rotation';

/** Every generator, each with a Rotation setting. */
export const GENERATORS: Generator[] = [
  navratna,
  phool,
  pan,
  chhabadi,
  ratanChowk,
  diamonds,
  chowkdi,
  stripes,
  kinar,
  nariKunjar,
  imageMotif,
  customCode,
].map(withRotation);

export const DEFAULT_GENERATOR_ID = navratna.id;

export function findGenerator(id: string): Generator | undefined {
  return GENERATORS.find((generator) => generator.id === id);
}

export function getGenerator(id: string): Generator {
  return findGenerator(id) ?? findGenerator(DEFAULT_GENERATOR_ID)!;
}
