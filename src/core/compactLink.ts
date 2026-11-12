/**
 * Compact links: `?d=<data>` holds the whole readable query, deflated and
 * base64url-encoded. Useful when a design carries custom code. Any readable
 * parameters next to `d` override what is inside it (e.g. `&view=wallpaper`).
 */

import { base64UrlToBytes, bytesToBase64Url } from './base64';

const COMPACT_PARAM = 'd';

async function transform(
  bytes: Uint8Array<ArrayBuffer>,
  stream: CompressionStream | DecompressionStream,
): Promise<Uint8Array> {
  const output = new Blob([bytes]).stream().pipeThrough(stream);
  return new Uint8Array(await new Response(output).arrayBuffer());
}

/** The compact query (`d=…`) for a readable query string (without '?'). */
export async function compactQuery(query: string): Promise<string> {
  const compressed = await transform(new TextEncoder().encode(query), new CompressionStream('deflate-raw'));
  return `${COMPACT_PARAM}=${bytesToBase64Url(compressed)}`;
}

/**
 * Expand `?d=…` into the readable query it holds; parameters given next to it win.
 * Returns the search string unchanged if there is no (valid) compact data.
 */
export async function expandCompactSearch(search: string): Promise<string> {
  const outer = new URLSearchParams(search);
  const data = outer.get(COMPACT_PARAM);
  if (!data) return search;
  try {
    const inner = new URLSearchParams(
      new TextDecoder().decode(await transform(base64UrlToBytes(data), new DecompressionStream('deflate-raw'))),
    );
    outer.delete(COMPACT_PARAM);
    for (const [name, value] of outer) inner.set(name, value);
    return `?${inner}`;
  } catch {
    outer.delete(COMPACT_PARAM); // unreadable data: ignore it, keep the rest
    return `?${outer}`;
  }
}
