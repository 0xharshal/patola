# Patola Playground — notes for Claude

Static Vite + TypeScript + Svelte 5 app, WebGL2 rendering, GPL-3.0-or-later.
Usage: README.md (user-facing only). Building and releases: docs/DEVELOPMENT.md. Link parameters:
docs/LINKS.md. Custom code and motif files: docs/CUSTOM-CONTENT.md. Roadmap and decisions: PLAN.md.
Don't repeat those here; link to them.

## Working here

- Node is NOT installed on the host. Run every npm/node command through
  `scripts/node.sh` (see docs/DEVELOPMENT.md). The dev server is `.claude/launch.json` "dev".
- `npm run lint` (Prettier + ESLint), `npm test` and `npm run build` (svelte-check:
  0 errors, 0 warnings) must all pass before committing. `npm run format` fixes formatting.
- The service worker only exists in production builds; test PWA/offline behaviour with
  `npm run preview` (port 4173), which can run next to the dev server.
- The built-in browser pane has no WebGL, so the canvas can't render there. For
  visual checks use headless Chromium + SwiftShader in the Playwright container
  (`mcr.microsoft.com/playwright:v1.49.0-noble`, `--network=host`, launch args
  `--use-angle=swiftshader --enable-unsafe-swiftshader`) against the dev server.

## Code map

- `src/core/` — `design.ts` (Design model, zones, typed render settings), `params.ts`
  (param schemas → UI + URL; `ParamValues<typeof schema>` types), `compose.ts` (layout regions + zone patterns → one
  grid), `url.ts`, `compactLink.ts` (`d=` links), `designFile.ts` (.patola.json),
  `randomize.ts`, `history.ts` (undo), `rng.ts`, `base64.ts`, `imageFile.ts` (decode and
  shrink pictures), `changeSignal.ts` (subscribe/notify for non-Svelte modules), `deviceSettings.ts`
  (graphics card, frame rate: per browser, never in links).
- `src/generators/` — one file per pattern, registered in `registry.ts`; shared
  helpers in `shapes.ts` and `commonParams.ts`; `rotation.ts` wraps every registered
  generator with a Rotation setting (generators themselves stay upright). A generator returns palette slot
  indices (`SLOT`, plus `ZARI_SLOT` = 7) for a zone of width × height cells. Patterns that
  repeat one motif share `repeatMotif` (imageMotif.ts) and its params (commonParams.ts).
- `src/layouts/` — pieces made of zones (`types.ts`); region helpers in `regions.ts`.
- `src/custom/` — user code: `codeRunner.ts` (worker sandbox, trust, cache),
  `storage.ts` (guarded localStorage, ids).
- `src/motifs/` — `format.ts` (motif text/JSON format), `builtin.ts` (built-in
  motifs as ASCII art, plus the drawn symbols), `sketch.ts` (draw shapes onto a cell grid
  at any size), `symbols.ts` (symbols drawn as shapes, used by the Symbols and Chakra
  patterns), `library.ts` (built-in + user motifs), `editing.ts` (pure grid operations
  behind the editor).
- `src/exhibition/` — the full-screen slideshow: `tour.ts` (camera stops, calm zoom moves
  that keep the screen full, and the plan of prerendered images; pure), `pictures.ts`
  (renders, prepares ahead and crossfades those images), `fabric.ts` (endless fabric: the
  gliding path, panel layout and designs; pure) and `fabricPanels.ts` (its panel images),
  `pacing.ts` (frame pacing for any refresh rate, per-second preparation budgets),
  `settings.ts` (`EXHIBITION_SCHEMA`,
  `x.` in URLs, and the next design); the UI is `src/app/Exhibition.svelte`.
- `src/education/guide.ts` — the Learn guide (technique texts; motif/layout texts come from their definitions) and its actions.
- `src/palettes/` — presets, random palettes, `extract.ts` (k-means quantising).
- `src/render/` — `renderer.ts` (WebGL2, linear-light palette, supersampling, render into
  sRGB images in bands and show them), `shaders.ts`
  (double-ikat weave: bundle shifts, wicking, yarn texture, sheen), `camera.ts`.
- `src/export/` — `exporter.ts` (one entry for all formats), `raster.ts` (tiled
  rendering in bands), `png.ts` (streaming PNG via CompressionStream), `svg.ts`, `sizes.ts`.
  Shader effects must depend on piece position, never screen pixels, or tiles show seams
  (and camera moves shimmer). Detail finer than a pixel must fade out (`resolved()`).
- `src/app/` — Svelte components; shared control styles live in `src/app.css`.
  `Panel` is composed of `PanelSection`s (`LayoutSection`, `WeaveSection`, `ExhibitionSection`,
  `AdvancedSection` with `CanvasSize` and `SeedField`); `Viewport` can be steered from outside (`camera` prop);
  dialogs use `Modal`; file pickers use `FileButton`; `MotifCanvas` draws and paints the
  motif grid for `MotifEditor`; `pwa.ts` registers the service worker and install prompt;
  `versions.ts` + `VersionPicker` find the published releases (`versions.json`) and switch
  between them. The service worker matches pages ignoring the query and has no navigation
  fallback, so the root's offline copy never answers for a release folder.
  Dialogs (export, learn, motif editor) and the exporter are loaded on first use.
- `.github/workflows/ci.yml` — lint, test and build on `main` and pull requests (no deploy).
- `.github/workflows/release.yml` + `scripts/publish-pages.sh` — on a `v*.*.*` tag, publish the
  build to the `gh-pages` branch: in `<tag>/` (never overwritten) and, for the newest stable
  release, at the root; `versions.json` lists them. The Node version comes from `.node-version`.

## Conventions

- Readable names, no copy-paste: shared params, region helpers, CSS classes and
  docs each have one home.
- Never mirror a saathiya (swastika) or Om: symbols that face a way set `faces`, library
  motifs `mirrorable`, and generators `keepsHandedness`, which layouts respect.
- Designs store palette slot indices, never colours.
- Everything random uses the design seed (deterministic output); exhibitions draw a fresh
  seed of their own each time they start (path, panels, next designs).
- New knobs go into a schema (generator `params`, layout `settings`, `RENDER_SCHEMA`).
  Declare generators and layouts with `defineGenerator` / `defineLayout` so settings are
  typed; read render settings with `renderSettings()`. No `as number` casts on settings.
- URL parsing never throws; clamp or ignore bad input.
- Never mutate `$state` inside `$derived` (e.g. `zoneFill` is read-only; layouts
  create their zones in `applyLayout`).
- User code only runs once trusted (`trustCode`): typed here or approved after a link.
