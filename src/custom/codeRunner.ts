/**
 * Runs user-written pattern code off the main thread.
 *
 * - Each run gets a fresh Web Worker, terminated after a time limit, so an
 *   endless loop can never freeze the page.
 * - Code only runs once it is trusted: typed in this browser, or explicitly
 *   approved by the user after arriving in a shared link.
 * - Results are cached per (code, size, seed); the generator reads the cache
 *   synchronously and listeners are told when a new result arrives.
 */

import { createChangeSignal } from '../core/changeSignal';

export const TIME_LIMIT_MS = 4000;
const MAX_CACHED_RESULTS = 60;

export type RunState =
  | { status: 'untrusted' }
  | { status: 'running' }
  | { status: 'done'; slots: Uint8Array }
  | { status: 'error'; message: string };

const WORKER_SOURCE = `
self.onmessage = (event) => {
  const { code, width, height, seed } = event.data;
  try {
    const define = new Function('"use strict";\\n' + code + '\\n;return typeof cell === "function" ? cell : null;');
    const cell = define();
    if (!cell) throw new Error('Define a function named cell(x, y, info).');
    let state = seed >>> 0;
    const random = () => {
      state = (state + 0x6d2b79f5) >>> 0;
      let mixed = state;
      mixed = Math.imul(mixed ^ (mixed >>> 15), mixed | 1);
      mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
      return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
    };
    const info = { width, height, random, seed };
    const slots = new Uint8Array(width * height);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const slot = Math.round(Number(cell(x, y, info)));
        slots[y * width + x] = slot >= 0 && slot <= 4 ? slot : slot === 7 ? 7 : 0;
      }
    }
    self.postMessage({ slots }, [slots.buffer]);
  } catch (error) {
    self.postMessage({ error: String((error && error.message) || error) });
  }
};
`;

let workerUrl: string | null = null;
const results = new Map<string, RunState>();
const trustedCode = new Set<string>();
const resultChanged = createChangeSignal();
const notify = resultChanged.notify;

/** Called when a run finishes or code becomes trusted. */
export const onCodeResult = resultChanged.subscribe;

export function isTrusted(code: string): boolean {
  return trustedCode.has(code);
}

/** Mark code as approved by the user (typed here, or reviewed after opening a link). */
export function trustCode(code: string): void {
  if (trustedCode.has(code)) return;
  trustedCode.add(code);
  notify();
}

function cacheKey(code: string, width: number, height: number, seed: number): string {
  return `${width}x${height}:${seed}:${code}`;
}

function remember(key: string, state: RunState): void {
  results.delete(key);
  results.set(key, state);
  while (results.size > MAX_CACHED_RESULTS) results.delete(results.keys().next().value!);
}

function start(key: string, code: string, width: number, height: number, seed: number): void {
  if (typeof Worker === 'undefined') {
    remember(key, { status: 'error', message: 'This browser cannot run custom code (no Web Workers).' });
    return;
  }
  workerUrl ??= URL.createObjectURL(new Blob([WORKER_SOURCE], { type: 'text/javascript' }));
  const worker = new Worker(workerUrl);
  remember(key, { status: 'running' });

  const finish = (state: RunState) => {
    clearTimeout(timer);
    worker.terminate();
    remember(key, state);
    notify();
  };
  const timer = setTimeout(
    () => finish({ status: 'error', message: `Stopped: the code took longer than ${TIME_LIMIT_MS / 1000} s.` }),
    TIME_LIMIT_MS,
  );
  worker.onmessage = (event: MessageEvent<{ slots?: Uint8Array; error?: string }>) =>
    finish(
      event.data.slots
        ? { status: 'done', slots: event.data.slots }
        : { status: 'error', message: event.data.error ?? 'Unknown error' },
    );
  worker.onerror = (event) => {
    event.preventDefault();
    finish({ status: 'error', message: event.message || 'The code could not be run.' });
  };
  worker.postMessage({ code, width, height, seed });
}

/** Current state for this code and size; starts a run if needed (and allowed). */
export function requestRun(code: string, width: number, height: number, seed: number): RunState {
  if (!isTrusted(code)) return { status: 'untrusted' };
  const key = cacheKey(code, width, height, seed);
  const known = results.get(key);
  if (known) return known;
  start(key, code, width, height, seed);
  return results.get(key)!;
}

/** The most recent outcome for this code at any size, for messages in the UI. */
export function latestState(code: string): RunState | null {
  if (!isTrusted(code)) return { status: 'untrusted' };
  let latest: RunState | null = null;
  for (const [key, state] of results) if (key.endsWith(`:${code}`)) latest = state;
  return latest;
}
