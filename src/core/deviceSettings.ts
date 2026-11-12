/**
 * Settings that belong to this device rather than to a design (which graphics
 * card to ask for, frame rate). Kept in this browser, never in links.
 */
import { sanitizeParams, typedParams, type ParamSchema, type ParamValues, type Params } from './params';
import { readStoredObject, writeStored } from '../custom/storage';

export const DEVICE_SCHEMA = [
  {
    key: 'gpu',
    type: 'select',
    label: 'Graphics card',
    default: 'default',
    options: [
      { value: 'default', label: "The browser's choice" },
      { value: 'high-performance', label: 'Fastest (usually a separate graphics card)' },
      { value: 'low-power', label: 'Power saving (usually the built-in graphics)' },
    ],
    help: 'Web pages can only ask; the browser and system decide which card draws.',
  },
  {
    key: 'fps',
    type: 'select',
    label: 'Exhibition frame rate',
    default: '30',
    options: [
      { value: '30', label: '30 per second (smooth on most computers)' },
      { value: '60', label: '60 per second (needs fast graphics)' },
    ],
    help: 'How often the moving exhibition picture is redrawn. The camera moves slowly, so 30 looks smooth and halves the work.',
  },
] as const satisfies ParamSchema;

export type DeviceSettings = ParamValues<typeof DEVICE_SCHEMA>;

const STORAGE_KEY = 'patola.device.v1';

export function loadDeviceSettings(): DeviceSettings {
  return typedParams(DEVICE_SCHEMA, sanitizeParams(DEVICE_SCHEMA, readStoredObject(STORAGE_KEY)));
}

export function saveDeviceSettings(settings: Params): void {
  writeStored(STORAGE_KEY, settings);
}
