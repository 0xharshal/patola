/**
 * Released versions. Releases are published side by side (see
 * scripts/publish-pages.sh): the site root serves the newest release, every
 * release also stays in its own folder (…/v1.2.0/), and versions.json lists them.
 */

/** This build's release tag, set by the release workflow; 'dev' for local builds. */
/** Where the source code lives (also in package.json). */
export const SOURCE_CODE_URL = 'https://github.com/0xharshal/patola';

export const APP_VERSION: string = import.meta.env.VITE_APP_VERSION || 'dev';

const RELEASE_TAG = /^v\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;
const IN_RELEASE_FOLDER = /^(.*\/)(v\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?)\/[^/]*$/;

export interface SiteLocation {
  /** Path of the site root, ending in '/'. */
  root: string;
  /** Release folder this page is served from, or null for the site root (the newest release). */
  release: string | null;
}

export function siteLocation(pathname: string): SiteLocation {
  const match = IN_RELEASE_FOLDER.exec(pathname);
  if (match) return { root: match[1], release: match[2] };
  return { root: pathname.slice(0, pathname.lastIndexOf('/') + 1), release: null };
}

/** Address of a release (null = newest, at the site root), keeping the design in the query. */
export function releaseUrl(site: SiteLocation, release: string | null, search: string): string {
  return `${site.root}${release ? `${release}/` : ''}${search}`;
}

export interface VersionIndex {
  /** Newest stable release, served at the site root ('' before the first stable release). */
  latest: string;
  /** All releases, newest first. */
  versions: string[];
}

export function parseVersionIndex(json: unknown): VersionIndex | null {
  const index = json as Partial<VersionIndex>;
  if (typeof index?.latest !== 'string' || !Array.isArray(index.versions)) return null;
  const versions = index.versions.filter(
    (version): version is string => typeof version === 'string' && RELEASE_TAG.test(version),
  );
  return { latest: RELEASE_TAG.test(index.latest) ? index.latest : '', versions };
}

/** The published versions, or null when there are none (local builds, offline). */
export async function loadVersionIndex(site: SiteLocation): Promise<VersionIndex | null> {
  try {
    const response = await fetch(`${site.root}versions.json`, { cache: 'no-cache' });
    return response.ok ? parseVersionIndex(await response.json()) : null;
  } catch {
    return null;
  }
}
