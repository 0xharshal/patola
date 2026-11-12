# Patola Playground

An educational, browser-based playground for **Patan double-ikat patola**, the
traditional silk textile of Gujarat. Generate patterns, lay them out as a saree,
dupatta, gharchola grid or rug, recolour them, and see how tie-dyed warp and weft
threads produce patola's soft, feathered edges.

Everything renders in your browser with WebGL2. There is no server-side code;
the build is a static folder you can host anywhere. Roadmap and design
decisions: [PLAN.md](PLAN.md).

## Using it

- **Layout**: pick a piece (pattern only, saree, dupatta, gharchola grid, rug).
  Each part of the piece (body, borders, pallu, …) has its own pattern: choose
  a part to edit it, or use its zoom button to look at it.
- **Rotation**: every pattern has a Rotation setting. At 45° a square grid becomes a
  diagonal grid; edges stay stepped, as they would be when tied on the threads.
- **Viewing**: drag to move, scroll or pinch to zoom, double-click to see everything.
- **Weave**: _Flat_ shows the design grid, _Woven_ the threads, _Realistic_ adds
  what dyeing and weaving do: bundles of threads shifted along their length, dye
  wicking past the ties (the feathered ikat edges), and the yarn itself (twisted
  silk filaments, uneven threads, sheen). Zoom in close to see the threads.
  _Light from_ places the lamp; the silk reflects it, so the sheen moves with it
  and slides over the threads as you move around the cloth.
- **Exhibition** (panel section): a full-screen slideshow for a large screen. The
  camera glides from the whole piece to the motifs and down to single threads, then
  the next design fades in, with a caption about it. Choose what changes between
  designs, the time per design, close-ups and captions. Space pauses, arrow keys
  skip, F toggles full screen, Esc ends it; the screen stays on while it runs. It
  draws every screen pixel, so a 4K screen shows a 4K picture.
- **Colours**: presets, your own colours (lock, reorder, shuffle), colours from
  a photo, and palettes saved in your browser.
- **Advanced** (panel section, kept in this browser, not in links): which graphics
  card to ask for (fastest or power saving; the browser and system decide, so the
  section shows the card actually drawing) and the exhibition frame rate (30 per
  second by default, which halves the work on slower graphics). If the browser
  ignores the choice, pick the card for the browser in the system settings; on
  Linux, e.g. start it with `DRI_PRIME=1`.
- **Learn**: a short guide to patola and double ikat. Its buttons show what it
  describes, e.g. the warp or weft threads on their own.
- **Show threads** (Weave section): the woven cloth, or only the dyed warp or
  weft threads, to see how each set carries part of the pattern.
- **Undo / redo**: buttons in the panel, or Ctrl+Z / Ctrl+Shift+Z.
- **Phones**: the controls are a bottom sheet; tap its handle for full height.
- **Versions**: at the bottom of the panel, pick any released version; your current
  design opens in it. Each version has its own address (`…/v1.2.0/`), can be
  installed on its own and keeps working offline.
- **Install / offline**: it's an installable web app. Use _Install app_ in the
  panel (Chrome, Edge, Android) or _Share → Add to Home Screen_ (Safari, iOS).
  Once loaded it works offline; new versions are offered with a _Reload_ button.
- **Export…**: PNG or JPG at any size (screen, 4K, A4 / A3 / A2 at 300 dpi, or a
  custom long side up to 30,000 px; PNG is streamed, so it isn't limited by canvas
  size), SVG of the flat design, or a **design file** (`.patola.json`).
- **Open design file…**: reopens a design file, including the motifs and code
  it carries (code still waits for _Run_).
- **Copy link**: the current design as a link. Long links (e.g. with code)
  are copied in compact form (`?d=…`).

### Your own patterns and motifs

- **Custom code** (motif list → _Custom code_): write a JavaScript function
  `cell(x, y, info)` that returns a palette slot (0 ground, 1 primary,
  2 secondary, 3 accent, 4 outline, 7 zari gold) for every cell. `info` has
  `width`, `height`, `seed` and a seeded `random()`. It runs in a separate worker
  and is stopped after 4 seconds. Code that arrives in a shared link is shown
  but **not run until you press Run**.
- **Picture motifs** (motif list → _Picture motif_): repeat a built-in motif
  (elephant, parrot, dancer, flower vase, tree) or your own. _Nari Kunjar_ puts
  the built-in figures together in the classic lattice of squares.
  - _Upload image…_: a picture is reduced to the palette slots so it recolours
    and weaves like everything else; a transparent background stays ground.
  - _Draw new_ / _Edit_: the grid editor (paint, fill, pick, mirror while
    drawing, flip, resize, undo). Built-in motifs are edited as a copy.
  - _Export file_ / _Import file_ in the editor: motifs as readable JSON, one
    character per cell (`.` ground, `1` primary, `2` secondary, `3` accent,
    `#` outline, `Z` zari).
  - Your motifs stay in your browser (localStorage): a shared link names the
    motif but can't carry it; export a file to share it.

## Building (container, nothing installed on the host)

All Node tooling runs in a container via [`scripts/node.sh`](scripts/node.sh)
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

Production image (nginx):

```bash
podman build -t patola-playground -f Containerfile .
podman run --rm -p 8080:80 patola-playground   # http://localhost:8080
```

Or copy `dist/` to any static host (nginx, …). Asset paths are relative, so it
works from a sub-folder too.

### Releases on GitHub Pages

Only tagged releases are published. Pushes to `main` and pull requests are
checked (lint, tests, build) by [`ci.yml`](.github/workflows/ci.yml); a version
tag runs [`release.yml`](.github/workflows/release.yml):

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
[`scripts/publish-pages.sh`](scripts/publish-pages.sh) on the `gh-pages` branch.
One-time setup: repository _Settings → Pages → Source: Deploy from a branch_,
branch `gh-pages`, folder `/ (root)` (the branch appears after the first release).

## URL parameters

Every design is a URL, so links can be shared and the page works as a wallpaper
generator. The address bar updates as you edit. Invalid values are ignored.

| Parameter                               | Example                                                                                                                                 | Meaning                                                                                                                                                                                                  |
| --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `layout`                                | `saree`, `dupatta`, `gharchola`, `rug`                                                                                                  | Piece layout (omit for a single pattern)                                                                                                                                                                 |
| `l.<setting>`                           | `l.across=180`                                                                                                                          | Layout setting (width, border share, …)                                                                                                                                                                  |
| `gen`                                   | `navratna`, `phool`, `pan`, `chhabadi`, `ratan-chowk`, `diamonds`, `chowkdi`, `stripes`, `kinar`, `nari-kunjar`, `image`, `custom-code` | Pattern of the body                                                                                                                                                                                      |
| `p.<param>`                             | `p.repeat=24`                                                                                                                           | Setting of the body pattern                                                                                                                                                                              |
| `z.<part>`                              | `z.pallu=phool`                                                                                                                         | Pattern of another part (`border`, `pallu`, `band`, `end`, `cellB`, `guard`, `corner`)                                                                                                                   |
| `z.<part>.<param>`                      | `z.pallu.repeat=30`                                                                                                                     | Setting of that part's pattern                                                                                                                                                                           |
| `seed`                                  | `42`, `random`                                                                                                                          | Randomness for thread drift; `random` = new on every load                                                                                                                                                |
| `palette`                               | `madder-indigo` or `8b1a1a,1f3a6b,e8b923`                                                                                               | Preset id or hex colours (no `#`). Presets: `madder-indigo`, `turmeric-black`, `parrot-green`, `ivory-maroon`, `jewel`, `vintage`, `pomegranate`, `saffron-purple`, `indigo-ivory`, `teal-coral`, `mono` |
| `mode`                                  | `flat`, `woven`, `realistic`                                                                                                            | Render mode                                                                                                                                                                                              |
| `w`, `h`                                | `1920`, `1080`                                                                                                                          | Image size in px for a single pattern (64–8192); omit to match the screen                                                                                                                                |
| `thread`                                | `3`                                                                                                                                     | Thread width in pixels                                                                                                                                                                                   |
| `step`                                  | `2`                                                                                                                                     | Threads per design cell                                                                                                                                                                                  |
| `bleed`, `warp`, `weft`, `sheen`        | `0.3`                                                                                                                                   | Ikat bleed, warp / weft shift, silk sheen (0–1)                                                                                                                                                          |
| `texture`                               | `0.6`                                                                                                                                   | Yarn texture (0–1)                                                                                                                                                                                       |
| `light`                                 | `315`                                                                                                                                   | Where the light comes from, in degrees (0 top, 90 right, …)                                                                                                                                              |
| `threads`                               | `both`, `warp`, `weft`                                                                                                                  | Show the woven cloth or one set of dyed threads                                                                                                                                                          |
| `view`                                  | `wallpaper`, `exhibition`                                                                                                               | Full-screen picture without controls, or the exhibition slideshow                                                                                                                                        |
| `x.vary`                                | `all`, `pattern`, `colours`, `none`                                                                                                     | Exhibition: what changes from one design to the next                                                                                                                                                     |
| `x.seconds`, `x.closeups`, `x.captions` | `60`, `1`, `1`                                                                                                                          | Exhibition: seconds per design (15–600), close-ups of the threads, captions                                                                                                                              |
| `random`                                | `pattern,colours,seed` or `all`                                                                                                         | Re-roll these on every load (great with `view=wallpaper`)                                                                                                                                                |
| `download`                              | `png`, `jpg`, `svg`, `design`                                                                                                           | Export as soon as the page has loaded                                                                                                                                                                    |
| `size`                                  | `4000`                                                                                                                                  | Long side in px for `download` (default: at thread size)                                                                                                                                                 |
| `d`                                     | `d=7dZN…`                                                                                                                               | Compact form of all the above; parameters next to it override it                                                                                                                                         |

A wallpaper that changes on every load, a link that downloads a 4000 px PNG, and an
exhibition for a kiosk that shows new sarees, rugs and patterns every 90 seconds:

```
?view=wallpaper&gen=navratna&palette=jewel&random=pattern,colours,seed
?layout=saree&download=png&size=4000
?view=exhibition&x.seconds=90&random=all
```

A page can't enter full screen by itself, so on a kiosk either click _Full screen_
once or start the browser in kiosk mode (e.g. `chromium --kiosk '<link>'`).

## Browser support

Needs WebGL2: current Chrome, Edge, Firefox, and Safari 15+ (desktop, iOS, Android).

## License

[GPL-3.0-or-later](LICENSE).
