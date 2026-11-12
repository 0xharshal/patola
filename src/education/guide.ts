/**
 * The "Learn" guide. Technique sections are written here; motif, figure and
 * layout descriptions come from their definitions (generators, built-in motifs,
 * layouts), so each text exists once.
 */
import { applyLayout, setZoneGenerator, type Design, type RenderMode } from '../core/design';
import { GENERATORS } from '../generators/registry';
import { LAYOUTS } from '../layouts/registry';
import { BUILT_IN_MOTIFS } from '../motifs/builtin';

/** Things a guide button can do to the design, so readers can see what they read about. */
export type GuideAction =
  | { kind: 'threads'; value: 'both' | 'warp' | 'weft' }
  | { kind: 'mode'; value: RenderMode }
  | { kind: 'layout'; value: string }
  | { kind: 'pattern'; value: string };

export interface GuideItem {
  title: string;
  text: string;
  action?: { label: string; action: GuideAction };
}

export interface GuideSection {
  id: string;
  title: string;
  paragraphs: string[];
  items?: GuideItem[];
  actions?: { label: string; action: GuideAction }[];
}

export const GUIDE: GuideSection[] = [
  {
    id: 'patola',
    title: 'What is patola?',
    paragraphs: [
      'Patola are silk textiles woven in Patan, in northern Gujarat, using the double-ikat technique. ' +
        'They have long been treasured as wedding and ceremonial cloth, and were traded far beyond India.',
      'Very few families still practise the craft. Tying, dyeing and weaving one saree by hand takes a team many months.',
    ],
  },
  {
    id: 'ikat',
    title: 'Ikat: dyeing before weaving',
    paragraphs: [
      'In ikat the pattern is made before the cloth exists. Threads are gathered in bundles, and the parts that must stay one colour are bound tightly so the dye cannot reach them. ' +
        'The bundles are dyed, re-tied and dyed again, usually from the lightest colour to the darkest.',
      'Each bundle of threads tied together becomes one "cell" of the design. That is why every diagonal and curve in a patola is a little staircase: ' +
        'in this playground the "Threads per cell" setting is the size of those bundles.',
    ],
    actions: [{ label: 'Show the design cells (Flat)', action: { kind: 'mode', value: 'flat' } }],
  },
  {
    id: 'double-ikat',
    title: 'Double ikat',
    paragraphs: [
      'Most ikat dyes only one set of threads. In double ikat both are dyed: the warp (the lengthwise threads stretched on the loom) and the weft (the crosswise threads woven through them).',
      'Each set carries only its own share of the pattern. The motif appears when the weaver lines the two up, thread by thread, as the cloth grows. ' +
        'Because the colour goes all the way through the threads, the pattern looks the same on both sides of the cloth.',
    ],
    actions: [
      { label: 'Show warp only', action: { kind: 'threads', value: 'warp' } },
      { label: 'Show weft only', action: { kind: 'threads', value: 'weft' } },
      { label: 'Show the woven cloth', action: { kind: 'threads', value: 'both' } },
    ],
  },
  {
    id: 'edges',
    title: 'Why the edges are soft',
    paragraphs: [
      'Tied threads never line up perfectly, and dye creeps a little way under the bindings. The result is the slightly feathered, flickering edge that makes ikat recognisable.',
      'In "Realistic" mode the playground shifts every thread a little along its own length: warp threads blur the design lengthwise, weft threads crosswise. ' +
        'Try the Ikat bleed, Warp shift and Weft shift sliders.',
    ],
    actions: [
      { label: 'Realistic', action: { kind: 'mode', value: 'realistic' } },
      { label: 'Woven, no shifts', action: { kind: 'mode', value: 'woven' } },
    ],
  },
  {
    id: 'pieces',
    title: 'Sarees and other pieces',
    paragraphs: [
      'A patola saree is not one repeat but a composition: a body framed by borders and ending in a richly decorated pallu. Each part has its own pattern.',
    ],
    items: LAYOUTS.filter((layout) => layout.id !== 'tile').map((layout) => ({
      title: layout.name,
      text: [layout.about, ...layout.zones.map((zone) => `${zone.name}: ${zone.about}`)].join(' '),
      action: { label: `Open a ${layout.name.toLowerCase()}`, action: { kind: 'layout', value: layout.id } },
    })),
  },
  {
    id: 'motifs',
    title: 'Patterns and motifs',
    paragraphs: [
      'Patola designs range from geometric lattices to figurative scenes. The names used here follow common usage; weavers and collectors do not always agree on them.',
    ],
    items: [
      ...GENERATORS.filter((generator) => !generator.userContent).map((generator) => ({
        title: generator.name,
        text: generator.about,
        action: { label: 'Try it', action: { kind: 'pattern', value: generator.id } as GuideAction },
      })),
      ...BUILT_IN_MOTIFS.map((motif) => ({ title: motif.name, text: motif.about })),
    ],
  },
  {
    id: 'colours',
    title: 'Colours',
    paragraphs: [
      'Older patola were dyed with natural dyes such as madder and other plant reds, indigo blue and yellow from plants like turmeric; greens came from dyeing yellow over blue. ' +
        'The palettes here are inspired by those colours.',
      'Every design in the playground is stored as palette slots (ground, primary, secondary, accent, outline), not as colours. ' +
        'That is why any palette recolours everything at once, much like re-dyeing the same tied threads.',
    ],
  },
];

/** Apply a guide button to the design. */
export function applyGuideAction(design: Design, action: GuideAction): void {
  switch (action.kind) {
    case 'threads':
      design.render.threads = action.value;
      if (design.mode === 'flat') design.mode = 'woven'; // threads only exist in the woven views
      break;
    case 'mode':
      design.mode = action.value;
      break;
    case 'layout':
      applyLayout(design, action.value);
      break;
    case 'pattern':
      setZoneGenerator(design, action.value);
      break;
  }
}
