# Your own patterns and motifs

- **Custom code** (motif list → _Custom code_): write a JavaScript function
  `cell(x, y, info)` that returns a palette slot (0 ground, 1 primary,
  2 secondary, 3 accent, 4 outline, 7 zari gold) for every cell. `info` has
  `width`, `height`, `seed` and a seeded `random()`. It runs in a separate worker
  and is stopped after 4 seconds. Code that arrives in a shared link is shown
  but **not run until you press Run**.
- **Picture motifs** (motif list → _Picture motif_): repeat a built-in motif
  (elephant, parrot, dancer, flower vase, tree, and the drawn symbols) or your own. _Nari Kunjar_ puts
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
