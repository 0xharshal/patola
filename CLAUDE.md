# Patola Playground — notes for Claude

Static Vite + TypeScript + Svelte 5 app, WebGL2 rendering, GPL-3.0-or-later.
Usage, build commands and URL parameters: README.md. Roadmap and decisions: PLAN.md.
Don't repeat those here; link to them.

## Working here

- Node is NOT installed on the host. Run every npm/node command through
  `scripts/node.sh` (see README "Building"). The dev server is `.claude/launch.json` "dev".
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
  shrink pictures), `changeSignal.ts` (subscribe/notify for non-Svelte modules).
- `src/generators/` — one file per pattern, registered in `registry.ts`; shared
  helpers in `shapes.ts` and `commonParams.ts`. A generator returns palette slot
  indices (`SLOT`, plus `ZARI_SLOT` = 7) for a zone of width × height cells.
- `src/layouts/` — pieces made of zones (`types.ts`); region helpers in `regions.ts`.
- `src/custom/` — user code: `codeRunner.ts` (worker sandbox, trust, cache),
  `storage.ts` (guarded localStorage, ids).
- `src/motifs/` — `format.ts` (motif text/JSON format), `builtin.ts` (built-in
  motifs as ASCII art), `library.ts` (built-in + user motifs), `editing.ts`
  (pure grid operations behind the editor).
- `src/education/guide.ts` — the Learn guide (technique texts; motif/layout texts come from their definitions) and its actions.
- `src/palettes/` — presets, random palettes, `extract.ts` (k-means quantising).
- `src/render/` — `renderer.ts` (WebGL2), `shaders.ts` (double-ikat weave), `camera.ts`.
- `src/export/` — `exporter.ts` (one entry for all formats), `raster.ts` (tiled
  rendering in bands), `png.ts` (streaming PNG via CompressionStream), `svg.ts`, `sizes.ts`.
  Shader effects must depend on piece position, never screen pixels, or tiles show seams.
- `src/app/` — Svelte components; shared control styles live in `src/app.css`.
  `Panel` is composed of `PanelSection`s (`LayoutSection`, `WeaveSection`, `SizeSection`);
  dialogs use `Modal`; file pickers use `FileButton`; `MotifCanvas` draws and paints the
  motif grid for `MotifEditor`; `pwa.ts` registers the service worker and install prompt.
  Dialogs (export, learn, motif editor) and the exporter are loaded on first use.
- `.github/workflows/deploy.yml` — test, build and publish to GitHub Pages.

## Conventions

- Readable names, no copy-paste: shared params, region helpers, CSS classes and
  docs each have one home.
- Designs store palette slot indices, never colours.
- Everything random uses the design seed (deterministic output).
- New knobs go into a schema (generator `params`, layout `settings`, `RENDER_SCHEMA`).
  Declare generators and layouts with `defineGenerator` / `defineLayout` so settings are
  typed; read render settings with `renderSettings()`. No `as number` casts on settings.
- URL parsing never throws; clamp or ignore bad input.
- Never mutate `$state` inside `$derived` (e.g. `zoneFill` is read-only; layouts
  create their zones in `applyLayout`).
- User code only runs once trusted (`trustCode`): typed here or approved after a link.
