import { requestRun, trustCode } from '../custom/codeRunner';
import { fillGrid } from './shapes';
import { SLOT, defineGenerator } from './types';

export const EXAMPLE_CODE = `// Return a palette slot for every cell:
//   0 ground, 1 primary, 2 secondary, 3 accent, 4 outline, 7 zari (gold)
// x, y: cell position. info: { width, height, random(), seed }
function cell(x, y, info) {
  const size = 18;                       // repeat size in cells
  const dx = Math.abs((x % size) - size / 2 + 0.5);
  const dy = Math.abs((y % size) - size / 2 + 0.5);
  const distance = dx + dy;              // stepped diamond distance
  if (distance < 2) return 3;
  if (distance < 6) return 1;
  if (distance < 7) return 4;
  return Math.max(dx, dy) > size / 2 - 1.5 ? 2 : 0;
}
`;

// The example ships with the app, so it never needs the user's approval to run.
trustCode(EXAMPLE_CODE);

/** Shown while the code runs, or if it can't run: faint diagonal hatching. */
function placeholder(width: number, height: number): Uint8Array {
  return fillGrid(width, height, (x, y) => ((x + y) % 12 === 0 ? SLOT.secondary : SLOT.ground));
}

/**
 * Your own algorithm: a JavaScript function `cell(x, y, info)` returning a
 * palette slot. It runs in a separate worker with a time limit.
 */
export const customCode = defineGenerator({
  id: 'custom-code',
  name: 'Custom code',
  about:
    'Write your own pattern in JavaScript: a function cell(x, y, info) that returns a palette slot for each cell. ' +
    'It runs in a sandboxed worker and is stopped if it takes too long.',
  userContent: true,
  params: [{ key: 'code', type: 'code', label: 'Code', default: EXAMPLE_CODE }],

  generate(params, { width, height, seed }): Uint8Array {
    const state = requestRun(params.code, width, height, seed);
    return state.status === 'done' ? state.slots : placeholder(width, height);
  },
});
