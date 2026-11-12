/** Type-level checks: settings keep their exact keys and choices (verified by the type checker). */
import { describe, expectTypeOf, it } from 'vitest';
import type { ParamValues } from '../src/core/params';
import { navratna } from '../src/generators/navratna';
import { nariKunjar } from '../src/generators/nariKunjar';
import { stripes } from '../src/generators/stripes';

describe('typed settings', () => {
  it('infers numbers, booleans and select choices from a schema', () => {
    type Navratna = ParamValues<typeof navratna.params>;
    expectTypeOf<Navratna['repeat']>().toEqualTypeOf<number>();
    expectTypeOf<Navratna['halfDrop']>().toEqualTypeOf<boolean>();
    expectTypeOf<Navratna['centre']>().toEqualTypeOf<'jewels' | 'flower' | 'plain'>();
    expectTypeOf<ParamValues<typeof stripes.params>['style']>().toEqualTypeOf<'diagonal' | 'zigzag-h' | 'zigzag-v'>();
  });

  it('keeps literal keys for motif toggles', () => {
    type NariKunjar = ParamValues<typeof nariKunjar.params>;
    expectTypeOf<NariKunjar['elephant']>().toEqualTypeOf<boolean>();
    expectTypeOf<NariKunjar['lattice']>().toEqualTypeOf<'none' | 'single' | 'double'>();
  });
});

describe('typed settings have no catch-all keys', () => {
  it('rejects keys that are not in the schema', () => {
    type NariKunjar = ParamValues<typeof nariKunjar.params>;
    expectTypeOf<NariKunjar>().not.toHaveProperty('notASetting');
  });
});
