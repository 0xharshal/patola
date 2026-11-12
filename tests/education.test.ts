import { describe, expect, it } from 'vitest';
import { applyGuideAction, GUIDE } from '../src/education/guide';
import { defaultDesign } from '../src/core/design';
import { designToQuery, parseUrl } from '../src/core/url';
import { GENERATORS } from '../src/generators/registry';
import { LAYOUTS } from '../src/layouts/registry';

describe('learn guide', () => {
  it('has unique sections with text', () => {
    expect(new Set(GUIDE.map((section) => section.id)).size).toBe(GUIDE.length);
    for (const section of GUIDE) expect(section.paragraphs.join('').length).toBeGreaterThan(40);
  });

  it('takes motif and layout texts from their definitions', () => {
    const motifs = GUIDE.find((section) => section.id === 'motifs')!.items!;
    for (const generator of GENERATORS.filter((candidate) => !candidate.userContent)) {
      expect(motifs.find((item) => item.title === generator.name)?.text).toBe(generator.about);
    }
    const pieces = GUIDE.find((section) => section.id === 'pieces')!.items!;
    expect(pieces).toHaveLength(LAYOUTS.length - 1);
  });

  it('every guide button changes the design as described', () => {
    const actions = GUIDE.flatMap((section) => [
      ...(section.actions ?? []),
      ...(section.items ?? []).flatMap((item) => (item.action ? [item.action] : [])),
    ]);
    for (const { action } of actions) {
      const design = defaultDesign();
      design.mode = 'flat';
      applyGuideAction(design, action);
      if (action.kind === 'threads') {
        expect(design.render.threads).toBe(action.value);
        expect(design.mode).not.toBe('flat'); // threads are only visible in woven views
      }
      if (action.kind === 'mode') expect(design.mode).toBe(action.value);
      if (action.kind === 'layout') expect(design.layout).toBe(action.value);
      if (action.kind === 'pattern') expect(design.generator).toBe(action.value);
    }
  });

  it('keeps the thread view in links', () => {
    const design = defaultDesign();
    design.render.threads = 'weft';
    expect(parseUrl(`?${designToQuery(design)}`).design.render.threads).toBe('weft');
    expect(parseUrl('?threads=sideways').design.render.threads).toBe('both');
  });
});
