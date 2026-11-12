# Patola Playground — Plan

An educational, browser-based playground for **Patan double-ikat patola** designs,
also usable for design inspiration. Fully client-side, static hosting
(GitHub Pages / nginx), GPU rendering, phone + tablet + desktop.
License: **GPL-3.0-or-later**.

How to use and build it, and the URL parameter reference: [README.md](README.md).
Code map and working conventions: [CLAUDE.md](CLAUDE.md). This file holds the
decisions, the core idea and the roadmap.

## 1. Decisions

| Topic          | Decision                                                                                   |
| -------------- | ------------------------------------------------------------------------------------------ |
| Purpose        | Educational first, design inspiration second                                               |
| Technique      | Patan **double ikat** (warp _and_ weft resist-dyed)                                        |
| Realism        | Render modes Flat / Woven / Realistic, with an ikat bleed slider                           |
| Gharchola      | Gharchola-style zari grid whose squares hold patola motifs                                 |
| Assets         | Fixed motifs (elephant, parrot, dancer, …) as palette-slot grids; public-domain folk forms |
| Custom content | Users can run their own pattern code and upload their own motif images                     |
| Size           | Default = device resolution; custom sizes; export size chosen by the user                  |
| Views          | Whole-piece overview and zoom into any zone; pan, pinch, wheel zoom                        |
| Devices        | Phone and tablet required                                                                  |
| Sharing        | Whole design in the URL: share links and a wallpaper generator                             |
| Out of scope   | Gujarati UI labels, animation, server-side rendering                                       |
| Stack          | Vite + TypeScript + Svelte 5, raw WebGL2, Vitest; tooling runs in a container              |

## 2. Core idea: threads, not pixels

Double ikat is woven from threads tie-dyed _before_ weaving, so every motif lives
on a grid of thread bundles (hence the stepped geometry), and the soft edges come
from dyed threads not lining up perfectly.

```
Layout (zones)  ─►  Generators per zone  ─►  Design grid      ─►  Weave / ikat shader  ─►  Screen / image
                    (seeded, CPU / worker)   (palette slots)      (warp/weft, shifts, bleed, zari)
```

- The **design grid** stores palette slot indices, so recolouring is instant.
- The **shader** decides per pixel which warp and weft thread it shows, which is
  on top (plain weave), and looks up each thread's dye with its own displacement
  _along that thread_. Warp and weft blur in different directions: the double-ikat
  look, without any image blur. Zari (gold) is never displaced.

## 3. Milestones

| #   | Milestone                                                                                           | Status |
| --- | --------------------------------------------------------------------------------------------------- | ------ |
| 1   | Foundation: renderer with three modes, first generator, auto-built controls, URL basics             | Done   |
| 2   | Generators + palettes: 8 generators, presets, palette editor, photo colours, randomise, undo/redo   | Done   |
| 3   | Layouts: saree, dupatta, gharchola, rug; zones with own patterns; camera; custom code; image motifs | Done   |
| 4   | Built-in motifs, Nari Kunjar, motif grid editor (draw, mirror, import / export)                     | Done   |
| 5   | Export (tiled streaming PNG, JPG, SVG, design files), `download=` / `random=` / compact `d=` links  | Done   |
| 6   | Thread views, Learn guide, mobile pass, lazy-loaded dialogs, GitHub Pages workflow                  | Done   |

Each milestone ends in a working, deployable build. All six planned milestones are done.

## 4. Open items and ideas

- Verify motif names and traditional zone proportions against references before
  finalising labels and info text (e.g. "chhabadi", "kinar").
- Refine the built-in motifs with references (more figures: horses, peacocks, women with pots).
- Printable weaving chart (grid + colour key): fits the educational goal; not planned yet.
- A static site can't serve a raw PNG for a URL (`<img src=…>`, `curl`): that
  would need a server-side renderer.
