import { describe, expect, it } from 'vitest';
import { applyLayout, defaultDesign, MAX_SIZE, MIN_SIZE } from '../src/core/design';
import { designToQuery, parseUrl } from '../src/core/url';
import { surprise } from '../src/core/randomize';
import { mulberry32 } from '../src/core/rng';

const roundTrip = (query: string) => parseUrl(`?${designToQuery(parseUrl(query).design)}`).design;

describe('url', () => {
  it('reads readable parameters', () => {
    const { design } = parseUrl(
      '?gen=chowkdi&seed=123&palette=jewel&mode=woven&w=800&h=600&bleed=0.2&p.size=20&p.twoTone=0',
    );
    expect(design.generator).toBe('chowkdi');
    expect(design.seed).toBe(123);
    expect(design.paletteId).toBe('jewel');
    expect(design.mode).toBe('woven');
    expect(design.size).toEqual({ width: 800, height: 600 });
    expect(design.render.bleed).toBe(0.2);
    expect(design.params.size).toBe(20);
    expect(design.params.twoTone).toBe(false);
  });

  it('round-trips a pattern-only design', () => {
    const query = '?gen=chowkdi&seed=123&palette=jewel&mode=woven&w=800&h=600&bleed=0.2&p.size=20';
    expect(roundTrip(query)).toEqual(parseUrl(query).design);
  });

  it('round-trips layouts with zone patterns and settings', () => {
    const query = '?layout=saree&l.across=150&l.band=4&z.pallu=phool&z.pallu.repeat=30&z.border.motif=checks&seed=5';
    const design = parseUrl(query).design;
    expect(design.layout).toBe('saree');
    expect(design.layoutSettings.across).toBe(150);
    expect(design.zones.pallu).toMatchObject({ generator: 'phool', params: { repeat: 30 } });
    expect(design.zones.border.params.motif).toBe('checks');
    expect(roundTrip(query)).toEqual(design);
  });

  it('keeps custom code and image ids in links', () => {
    const design = defaultDesign();
    design.generator = 'custom-code';
    design.params = { code: 'function cell(x, y) { return (x + y) % 3; }' };
    const again = parseUrl(`?${designToQuery(design)}`).design;
    expect(again.params.code).toBe(design.params.code);
  });

  it('survives a surprise in every layout', () => {
    for (const layout of ['tile', 'saree', 'dupatta', 'gharchola', 'rug']) {
      const design = defaultDesign();
      applyLayout(design, layout);
      surprise(design, [], mulberry32(5));
      const again = parseUrl(`?${designToQuery(design)}`).design;
      expect(again.layout).toBe(design.layout);
      expect(again.generator).toBe(design.generator);
      expect(again.palette).toEqual(design.palette);
      expect(Object.keys(again.zones)).toEqual(Object.keys(design.zones));
    }
  });

  it('accepts inline hex palettes and wallpaper view', () => {
    const { design, view } = parseUrl('?palette=112233,445566&view=wallpaper');
    expect(design.paletteId).toBeNull();
    expect(design.palette[0]).toBe('#112233');
    expect(view).toBe('wallpaper');
  });

  it('writes saved (browser-only) palettes as hex', () => {
    const design = defaultDesign();
    design.paletteId = 'user:abc';
    design.palette = ['#111111', '#222222', '#333333', '#444444', '#555555'];
    expect(new URLSearchParams(designToQuery(design)).get('palette')).toBe('111111,222222,333333,444444,555555');
  });

  it('ignores garbage instead of failing', () => {
    const { design } = parseUrl(
      '?gen=nope&layout=nope&seed=-5&palette=%%%&mode=x&w=abc&thread=999&p.repeat=zz&z.border=nope',
    );
    const defaults = defaultDesign();
    expect(design.generator).toBe(defaults.generator);
    expect(design.layout).toBe('tile');
    expect(design.mode).toBe(defaults.mode);
    expect(design.size).toBeNull();
    expect(design.render.threadPx).toBe(12); // clamped to the maximum
    expect(design.params).toEqual(defaults.params);
  });

  it('clamps huge sizes', () => {
    expect(parseUrl('?w=100000&h=10').design.size).toEqual({ width: MAX_SIZE, height: MIN_SIZE });
  });
});
