# Patola Playground

A playground for **Patan double-ikat patola**, the silk textile of Gujarat in which
both the lengthwise (warp) and crosswise (weft) threads are tie-dyed before
weaving. Create patola designs, lay them out as a saree, dupatta, gharchola or
rug, recolour them, and see how the dyed threads produce patola's soft,
feathered edges, right down to the single silk thread.

It is made for learning and for design inspiration, and runs entirely in your
browser: no sign-up, nothing to install, and it works offline once opened.

**Open it:** <https://0xharshal.github.io/patola/> · Source: <https://github.com/0xharshal/patola>

## Features

- **Patterns made by algorithms**, each with its own settings: navratna, phool
  (flowers), pan (leaves), chhabadi, ratan chowk, concentric diamonds, chowkdi,
  stripes, borders, the figurative Nari Kunjar (women and elephants), wheels
  (Ashoka chakra, charkha, concentric circles) and symbols.
- **Symbols and figures**: diya, saathiya, peacock, mango, kite, dandiya, Om,
  trishul, bow and arrow, swan, charkha, plus elephants, parrots, dancers, vases
  and trees. They are drawn from shapes, so they stay crisp at any size.
- **Whole pieces**: a single pattern, saree, dupatta, gharchola grid or rug, each
  part (body, borders, pallu, …) with its own pattern.
- **Any canvas size** for a single pattern: your screen, ready-made sizes (Full HD
  to 8K, phone and tablet wallpapers, square, social posts, banners, A4 to A2
  print) or your own width and height, portrait or landscape.
- **Realistic cloth**: threads crossing over and under, shifted bundles of dyed
  threads, dye creeping past the ties, twisted silk filaments and a sheen that
  moves with the light. Look at the warp or weft threads on their own to see how
  each carries half the design.
- **Colours**: eleven traditional palettes, your own colours, colours taken from a
  photo, and palettes saved for later.
- **Exhibition**: a full-screen slideshow for a big screen or a phone, either one
  design at a time, toured from the whole piece down to single threads, or an
  endless fabric of many designs gliding past.
- **Save and share**: PNG or JPG at any size (up to 30,000 pixels and print sizes),
  SVG, design files, and links that open exactly the same design.
- **Your own designs**: draw motifs, turn your own images into motifs, or write a
  little code for a new pattern.
- **Learn**: a short guide to patola and double ikat, with buttons that show what
  it explains.
- **Installable**: works like an app on phones, tablets and computers, also offline.

## How to use it

1. **Start**: open the page. A design is shown; _Surprise me_ makes a new one,
   _Shuffle pattern_ and _Shuffle colours_ change one part.
2. **Choose a piece** under _Layout_: pick a part of the piece (body, border,
   pallu, …) to change its pattern, or its zoom button to look at it.
3. **Change the pattern**: pick a motif and move its sliders. Every pattern can
   be turned (_Rotation_); at 45° a square grid becomes a diagonal one.
4. **Colours**: pick a palette, change single colours (lock the ones you like
   before shuffling), or take colours from a photo.
5. **Weave**: _Flat_ shows the design, _Woven_ the threads, _Realistic_ the cloth
   as it comes off the loom. Drag to move, scroll or pinch to zoom, double-click
   to see everything; zoom in close to see the silk.
6. **Canvas size** (single patterns): pick a size under _Canvas size_, or type your
   own; ⇄ switches between portrait and landscape.
7. **Keep it**: _Export…_ saves an image or a design file; _Copy link_ copies a
   link to share. _Undo_ and _Redo_ (Ctrl+Z, Ctrl+Shift+Z) are at the top.

### Exhibition

Under _Exhibition_, choose a style and press _Start exhibition_:

- **One design at a time**: the camera drifts calmly over each design and zooms
  in to the threads, then the next design fades in, with a short caption.
- **Endless fabric**: a patchwork of designs glides past, now left, now right, up
  or down; each design fills the whole screen for a while.

Choose what changes from one design to the next and how long each stays. Space
pauses, the arrow keys skip, F switches full screen and Esc ends the exhibition;
_Edit this design_ takes the design on show back to the editor. The screen stays
on while it runs (on `https://` pages). _Copy exhibition link_ makes a link that
opens straight into it, e.g. for a kiosk or a lobby screen.

### Your own motifs and patterns

In the motif list, _Picture motif_ repeats a built-in motif or your own: upload
an image (it is reduced to the palette colours, so it recolours like everything
else) or draw one in the grid editor. _Custom code_ runs a small function of
yours for every cell; code from a shared link only runs after you press _Run_.
Details: [docs/CUSTOM-CONTENT.md](docs/CUSTOM-CONTENT.md).

### Phones, tablets and the app

On phones the controls are a sheet at the bottom; tap its handle to make it
larger. To install the app, use _Install app_ in the panel (Chrome, Edge,
Android) or _Share → Add to Home Screen_ (Safari on iPhone and iPad). New
versions are offered with a _Reload_ button, and every earlier version stays
available under _Version_ at the bottom of the panel.

_Advanced_ (bottom of the panel) has settings for this device only: which
graphics card to use, how the exhibition draws, and its frame rate.

## Browsers

Current Chrome, Edge, Firefox and Safari (15 or later), on computers, phones and
tablets. The browser needs WebGL2, which all of these have.

## More

- [docs/LINKS.md](docs/LINKS.md): everything a link can say, for wallpapers,
  kiosks and downloads.
- [docs/CUSTOM-CONTENT.md](docs/CUSTOM-CONTENT.md): custom code and motif files.
- [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md): building, running and releasing.
- [PLAN.md](PLAN.md): roadmap and design decisions.

## License

[GPL-3.0-or-later](LICENSE).
