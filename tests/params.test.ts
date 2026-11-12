import { describe, expect, it } from 'vitest';
import { sanitizeParams, sanitizeValue, type ParamDef } from '../src/core/params';
import { mulberry32 } from '../src/core/rng';
import { History } from '../src/core/history';
import { createChangeSignal } from '../src/core/changeSignal';

describe('rng', () => {
  it('is deterministic for a seed', () => {
    const first = mulberry32(42);
    const second = mulberry32(42);
    expect([first(), first(), first()]).toEqual([second(), second(), second()]);
  });
});

describe('params', () => {
  const count: ParamDef = { key: 'count', type: 'int', label: 'Count', min: 1, max: 10, default: 5 };
  const toggle: ParamDef = { key: 'toggle', type: 'bool', label: 'Toggle', default: false };
  const choice: ParamDef = {
    key: 'choice',
    type: 'select',
    label: 'Choice',
    default: 'a',
    options: [
      { value: 'a', label: 'A' },
      { value: 'b', label: 'B' },
    ],
  };
  const code: ParamDef = { key: 'code', type: 'code', label: 'Code', default: 'x' };
  const asset: ParamDef = { key: 'asset', type: 'asset', label: 'Image', default: '' };

  it('clamps and rounds numbers, including URL strings', () => {
    expect(sanitizeValue(count, '99')).toBe(10);
    expect(sanitizeValue(count, '3.6')).toBe(4);
    expect(sanitizeValue(count, 'abc')).toBe(5);
    expect(sanitizeValue(count, '')).toBe(5);
  });

  it('parses booleans and rejects unknown choices', () => {
    expect(sanitizeValue(toggle, '1')).toBe(true);
    expect(sanitizeValue(toggle, 'yes')).toBe(false);
    expect(sanitizeValue(choice, 'b')).toBe('b');
    expect(sanitizeValue(choice, 'zzz')).toBe('a');
  });

  it('limits code length and asset ids', () => {
    expect(sanitizeValue(code, 'function cell(){}')).toBe('function cell(){}');
    expect(sanitizeValue(code, 'x'.repeat(30_000))).toBe('x');
    expect(sanitizeValue(asset, 'asset:abc123')).toBe('asset:abc123');
    expect(sanitizeValue(asset, '<script>')).toBe('');
  });

  it('drops unknown keys and fills defaults', () => {
    expect(sanitizeParams([count, toggle], { unknown: 1, count: 2 })).toEqual({ count: 2, toggle: false });
  });
});

describe('history', () => {
  it('undoes and redoes, ignoring duplicate snapshots', () => {
    const history = new History('a');
    expect(history.record('a')).toBe(false);
    history.record('b');
    history.record('c');
    expect(history.undo()).toBe('b');
    expect(history.undo()).toBe('a');
    expect(history.undo()).toBeNull();
    expect(history.redo()).toBe('b');
    // Re-applying the current state adds nothing; a new edit drops the redo branch.
    expect(history.record('b')).toBe(false);
    expect(history.canRedo).toBe(true);
    history.record('x');
    expect(history.canRedo).toBe(false);
  });

  it('caps its length', () => {
    const history = new History('0', 3);
    ['1', '2', '3', '4'].forEach((snapshot) => history.record(snapshot));
    expect(history.undo()).toBe('3');
    expect(history.undo()).toBe('2');
    expect(history.undo()).toBeNull();
  });
});

describe('change signal', () => {
  it('notifies subscribers until they unsubscribe', () => {
    const signal = createChangeSignal();
    let calls = 0;
    const stop = signal.subscribe(() => calls++);
    signal.notify();
    stop();
    signal.notify();
    expect(calls).toBe(1);
  });
});
