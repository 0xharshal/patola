# Development

Static Vite + TypeScript + Svelte 5 app with WebGL2 rendering. Roadmap and design
decisions: [PLAN.md](../PLAN.md); code map and conventions: [CLAUDE.md](../CLAUDE.md).

## Building (container, nothing installed on the host)

All Node tooling runs in a container via [`scripts/node.sh`](../scripts/node.sh)
(Podman, or Docker if Podman isn't installed).

```bash
scripts/node.sh npm install      # once
scripts/node.sh npm run dev      # dev server on http://localhost:5173
scripts/node.sh npm test         # unit tests
scripts/node.sh npm run lint     # formatting (Prettier) and lint rules (ESLint)
scripts/node.sh npm run format   # fix formatting
scripts/node.sh npm run build    # type-check + build into dist/
scripts/node.sh npm run preview  # serve the build on http://localhost:4173 (offline/PWA testing)
```

Both servers listen on all network interfaces, so a phone, tablet or big screen on
the same network can open `http://<this computer's IP>:5173`. Set
`PUBLISH_ADDRESS=127.0.0.1` to keep them on this computer. Over plain `http` from
another device the browser allows neither keeping the screen on nor offline use;
for those, start the dev server with HTTPS (a self-signed certificate: accept the
browser's warning once):

```bash
scripts/node.sh npm run dev:https  # https://<this computer's IP>:5173
```

Production image (nginx):

```bash
podman build -t patola-playground -f Containerfile .
podman run --rm -p 8080:80 patola-playground   # http://localhost:8080
```

Or copy `dist/` to any static host (nginx, …). Asset paths are relative, so it
works from a sub-folder too.

## Releases on GitHub Pages

Only tagged releases are published. Pushes to `main` and pull requests are
checked (lint, tests, build) by [`ci.yml`](../.github/workflows/ci.yml); a version
tag runs [`release.yml`](../.github/workflows/release.yml):

```bash
git tag v1.2.0
git push origin v1.2.0
```

Every release stays online in its own folder, so a version can be pinned:

| Address                                         | Serves                    |
| ----------------------------------------------- | ------------------------- |
| `https://<user>.github.io/<repo>/`              | the newest stable release |
| `https://<user>.github.io/<repo>/v1.2.0/`       | exactly v1.2.0, forever   |
| `https://<user>.github.io/<repo>/versions.json` | the list of releases      |

Pre-releases (`v1.3.0-rc.1`) get a folder but don't replace the newest release,
and a published version is never overwritten. Publishing is done by
[`scripts/publish-pages.sh`](../scripts/publish-pages.sh) on the `gh-pages` branch.
One-time setup: repository _Settings → Pages → Source: Deploy from a branch_,
branch `gh-pages`, folder `/ (root)` (the branch appears after the first release).

## Choosing the graphics card

The app's _Advanced → Graphics card_ setting can only ask the browser; it shows
the card actually drawing. If the browser ignores the choice, pick the card for
the browser in the system settings (Windows: _Settings → Display → Graphics_).
On Linux, start the browser on the card you want, e.g. by its PCI address:

```bash
DRI_PRIME=pci-0000_04_00_0 chromium
```

## Kiosks

A page can't enter full screen by itself: click _Full screen_ once, or start the
browser in kiosk mode with an exhibition link (see [LINKS.md](LINKS.md)):

```bash
chromium --kiosk 'https://0xharshal.github.io/patola/?view=exhibition&x.style=fabric'
```
