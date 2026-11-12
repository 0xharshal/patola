import { afterEach, describe, expect, it } from 'vitest';
import { loadDeviceSettings, saveDeviceSettings } from '../src/core/deviceSettings';

const store = new Map<string, string>();
const memoryStorage = {
  getItem: (key: string) => store.get(key) ?? null,
  setItem: (key: string, value: string) => void store.set(key, value),
};

describe('device settings', () => {
  afterEach(() => {
    store.clear();
    Reflect.deleteProperty(globalThis, 'localStorage');
  });

  it('fall back to defaults without storage', () => {
    expect(loadDeviceSettings()).toEqual({ gpu: 'default', fps: '30' });
  });

  it('are kept, and bad stored values are replaced by defaults', () => {
    Object.assign(globalThis, { localStorage: memoryStorage });
    saveDeviceSettings({ gpu: 'high-performance', fps: '60' });
    expect(loadDeviceSettings()).toEqual({ gpu: 'high-performance', fps: '60' });
    store.set('patola.device.v1', JSON.stringify({ gpu: 'nvidia-only', fps: 1000 }));
    expect(loadDeviceSettings()).toEqual({ gpu: 'default', fps: '30' });
  });
});
