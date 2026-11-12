#!/usr/bin/env bash
# Publish a release build to the gh-pages branch, keeping every earlier release.
#
#   scripts/publish-pages.sh <release-tag> <build-dir>     e.g. v1.2.0 dist
#
# Layout of the gh-pages branch:
#   v1.0.0/, v1.1.0/, …   one folder per release, never changed afterwards
#   index.html, assets/…  a copy of the newest stable release (the site's root)
#   versions.json         {"latest": "v1.1.0", "versions": ["v1.1.0", "v1.0.0", …]}
#
# Pre-releases (v1.2.0-rc.1) get a folder but never become the root. Publishing
# an older patch (v1.0.1 after v1.1.0) also leaves the root on the newest one.
#
# Env: PAGES_REMOTE (default origin), PAGES_BRANCH (default gh-pages).
set -euo pipefail

version=${1:?usage: publish-pages.sh <release-tag> <build-dir>}
build=$(cd "${2:?usage: publish-pages.sh <release-tag> <build-dir>}" && pwd)
remote=${PAGES_REMOTE:-origin}
branch=${PAGES_BRANCH:-gh-pages}

release_pattern='^v[0-9]+\.[0-9]+\.[0-9]+(-[0-9A-Za-z.-]+)?$'
stable_pattern='^v[0-9]+\.[0-9]+\.[0-9]+$'
[[ $version =~ $release_pattern ]] || { echo "error: '$version' is not a release tag like v1.2.0" >&2; exit 1; }
[[ -f $build/index.html ]] || { echo "error: $build has no index.html; build first" >&2; exit 1; }

workdir=$(mktemp -d)
site=$workdir/site
cleanup() {
  git worktree remove --force "$site" >/dev/null 2>&1 || true
  rm -rf "$workdir"
}
trap cleanup EXIT

# Check out the current gh-pages branch, or start it empty on the first release.
if git fetch --quiet "$remote" "$branch" 2>/dev/null; then
  git worktree add --quiet --detach "$site" FETCH_HEAD
else
  git worktree add --quiet --detach "$site"
  git -C "$site" checkout --quiet --orphan "$branch"
  git -C "$site" rm -r --quiet --cached . >/dev/null
  find "$site" -mindepth 1 -maxdepth 1 ! -name .git -exec rm -rf {} +
fi

if [[ -e $site/$version ]]; then
  echo "error: $version is already published; releases are never overwritten" >&2
  exit 1
fi
mkdir "$site/$version"
cp -R "$build/." "$site/$version/"

# Published release folders, newest first.
mapfile -t releases < <(find "$site" -mindepth 1 -maxdepth 1 -type d -printf '%f\n' | grep -E "$release_pattern" | sort -Vr)
latest=$(printf '%s\n' "${releases[@]}" | grep -E "$stable_pattern" | head -n 1 || true)

# The root serves the newest stable release: replace everything except the release folders.
if [[ -n $latest ]]; then
  find "$site" -mindepth 1 -maxdepth 1 ! -name .git -regextype posix-extended ! -regex ".*/v[0-9]+\.[0-9]+\.[0-9]+(-[0-9A-Za-z.-]+)?" -exec rm -rf {} +
  cp -R "$site/$latest/." "$site/"
fi

{
  printf '{\n  "latest": "%s",\n  "versions": [' "$latest"
  separator=''
  for release in "${releases[@]}"; do
    printf '%s"%s"' "$separator" "$release"
    separator=', '
  done
  printf ']\n}\n'
} >"$site/versions.json"
touch "$site/.nojekyll" # serve files as they are; GitHub Pages would otherwise run Jekyll

git -C "$site" add -A
git -C "$site" commit --quiet -m "Publish $version"
git -C "$site" push --quiet "$remote" "HEAD:refs/heads/$branch"
echo "Published $version (site root: ${latest:-none yet})"
