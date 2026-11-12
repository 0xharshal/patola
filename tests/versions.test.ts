import { describe, expect, it } from 'vitest';
import { parseVersionIndex, releaseUrl, siteLocation } from '../src/app/versions';

describe('release versions', () => {
  it('knows whether a page is the site root or a release folder', () => {
    expect(siteLocation('/patola-playground/')).toEqual({ root: '/patola-playground/', release: null });
    expect(siteLocation('/patola-playground/index.html')).toEqual({ root: '/patola-playground/', release: null });
    expect(siteLocation('/patola-playground/v1.2.0/')).toEqual({ root: '/patola-playground/', release: 'v1.2.0' });
    expect(siteLocation('/v2.0.0-rc.1/index.html')).toEqual({ root: '/', release: 'v2.0.0-rc.1' });
    expect(siteLocation('/v1/')).toEqual({ root: '/v1/', release: null }); // not a release tag
  });

  it('opens another release with the same design', () => {
    const inRelease = siteLocation('/site/v1.2.0/');
    expect(releaseUrl(inRelease, 'v1.0.0', '?gen=phool&seed=3')).toBe('/site/v1.0.0/?gen=phool&seed=3');
    expect(releaseUrl(inRelease, null, '?gen=phool')).toBe('/site/?gen=phool');
  });

  it('reads versions.json and drops anything that is not a release tag', () => {
    expect(parseVersionIndex({ latest: 'v1.1.0', versions: ['v1.1.0', '../evil', 'v1.0.0', 3] })).toEqual({
      latest: 'v1.1.0',
      versions: ['v1.1.0', 'v1.0.0'],
    });
    expect(parseVersionIndex({ latest: '', versions: ['v1.0.0-rc.1'] })).toEqual({
      latest: '',
      versions: ['v1.0.0-rc.1'],
    });
    expect(parseVersionIndex({ nope: true })).toBeNull();
  });
});
