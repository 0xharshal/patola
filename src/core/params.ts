/**
 * Parameter schemas. Generators, layouts and render settings describe their knobs
 * with a schema; the UI builds controls from it and the URL parser validates
 * against it, so adding a parameter never requires UI or URL code changes.
 */
export type ParamValue = number | boolean | string;
/** Stored values, keyed by parameter. Use `ParamValues<typeof schema>` for typed access. */
export type Params = Record<string, ParamValue>;

interface BaseParam<Key extends string> {
  readonly key: Key;
  readonly label: string;
  readonly help?: string;
}

export interface NumberParam<Key extends string = string> extends BaseParam<Key> {
  readonly type: 'int' | 'float';
  readonly min: number;
  readonly max: number;
  readonly step?: number;
  readonly default: number;
  /** Narrower range used by "randomise", to avoid extremes that look broken. */
  readonly random?: readonly [number, number];
}

export interface BoolParam<Key extends string = string> extends BaseParam<Key> {
  readonly type: 'bool';
  readonly default: boolean;
}

export interface SelectParam<Key extends string = string> extends BaseParam<Key> {
  readonly type: 'select';
  readonly options: readonly { readonly value: string; readonly label: string }[];
  readonly default: string;
}

/** User-written JavaScript (see the custom code generator). */
export interface CodeParam<Key extends string = string> extends BaseParam<Key> {
  readonly type: 'code';
  readonly default: string;
}

/** Id of a motif from the motif library. */
export interface AssetParam<Key extends string = string> extends BaseParam<Key> {
  readonly type: 'asset';
  readonly default: string;
}

export type ParamDef = NumberParam | BoolParam | SelectParam | CodeParam | AssetParam;
export type ParamSchema = readonly ParamDef[];

/** The value type of one parameter: numbers, booleans, or the exact choices of a select. */
type ValueOf<Def extends ParamDef> = Def extends NumberParam
  ? number
  : Def extends BoolParam
    ? boolean
    : Def extends { readonly options: readonly { readonly value: infer Choice }[] }
      ? Choice
      : string;

/** Typed values for a schema declared with literal keys (see defineGenerator / defineLayout). */
export type ParamValues<Schema extends ParamSchema> = {
  -readonly [Def in Schema[number] as Def['key']]: ValueOf<Def>;
};

/**
 * Read stored values with their precise types. Safe because stored values are
 * always sanitised against their schema (defaults, URL, UI controls).
 */
export function typedParams<const Schema extends ParamSchema>(_schema: Schema, values: Params): ParamValues<Schema> {
  return values as ParamValues<Schema>;
}

export const MAX_CODE_LENGTH = 20_000;
const ASSET_ID = /^[\w:.-]{1,80}$/;

export function defaultParams(schema: ParamSchema): Params {
  return Object.fromEntries(schema.map((def) => [def.key, def.default]));
}

/** Coerce any input (including URL strings) to a valid value; falls back to the default. */
export function sanitizeValue(def: ParamDef, raw: unknown): ParamValue {
  switch (def.type) {
    case 'int':
    case 'float': {
      const number = typeof raw === 'number' ? raw : typeof raw === 'string' && raw.trim() !== '' ? Number(raw) : NaN;
      if (!Number.isFinite(number)) return def.default;
      const clamped = Math.min(def.max, Math.max(def.min, number));
      return def.type === 'int' ? Math.round(clamped) : clamped;
    }
    case 'bool':
      if (raw === true || raw === 'true' || raw === '1') return true;
      if (raw === false || raw === 'false' || raw === '0') return false;
      return def.default;
    case 'select':
      return def.options.find((option) => option.value === raw)?.value ?? def.default;
    case 'code':
      return typeof raw === 'string' && raw.length <= MAX_CODE_LENGTH ? raw : def.default;
    case 'asset':
      return typeof raw === 'string' && (raw === '' || ASSET_ID.test(raw)) ? raw : def.default;
  }
}

/** Keep only known keys, fill missing ones with defaults, clamp everything. */
export function sanitizeParams(schema: ParamSchema, raw: Record<string, unknown>): Params {
  return Object.fromEntries(schema.map((def) => [def.key, sanitizeValue(def, raw[def.key])]));
}

/** Compact string form for URLs (floats rounded to 3 decimals, bools as 1/0). */
export function formatValue(def: ParamDef, value: ParamValue): string {
  if (def.type === 'bool') return value ? '1' : '0';
  if (def.type === 'float' && typeof value === 'number') return String(Math.round(value * 1000) / 1000);
  return String(value);
}
