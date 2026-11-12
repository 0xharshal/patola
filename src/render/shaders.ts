/** Full-screen triangle, no vertex buffers needed. */
export const VERTEX_SHADER = /* glsl */ `#version 300 es
void main() {
  vec2 corner = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  gl_Position = vec4(corner * 2.0 - 1.0, 0.0, 1.0);
}
`;

/**
 * Double-ikat weave.
 *
 * Every pixel belongs to one warp thread and one weft thread. In plain weave the
 * warp is on top where (warp index + weft index) is even. Each thread carries the
 * colour it was dyed before weaving, looked up in the design grid. In
 * "realistic" mode each thread's dye pattern is displaced along its own length,
 * so warp threads blur designs along the warp and weft threads across it: the
 * feathered double-ikat edge. Zari (gold) is not dyed, so it is never displaced.
 *
 * "Loom space" is piece space with axes swapped when the warp runs horizontally,
 * so x always counts warp threads.
 */
export const FRAGMENT_SHADER = /* glsl */ `#version 300 es
precision highp float;
precision highp int;
precision highp usampler2D;

uniform usampler2D uGrid;
uniform ivec2 uGridSize;      // design cells
uniform vec3 uPalette[8];
uniform vec3 uBackground;     // outside the piece
uniform vec2 uViewSize;       // render target, px
uniform vec2 uOrigin;         // piece position (threads) at the top-left pixel
uniform float uScale;         // pixels per thread
uniform float uThreadsPerCell;
uniform bool uWarpHorizontal;
uniform int uMode;            // 0 flat, 1 woven, 2 realistic
uniform int uThreadView;      // 0 both (the cloth), 1 warp only, 2 weft only
uniform float uBleed;
uniform float uWarpJitter;
uniform float uWeftJitter;
uniform float uSheen;
uniform uint uSeed;

out vec4 outColor;

const uint ZARI = 7u;

uint pcgHash(uint value) {
  uint state = value * 747796405u + 2891336453u;
  uint word = ((state >> ((state >> 28u) + 4u)) ^ state) * 277803737u;
  return (word >> 22u) ^ word;
}

float random(int a, int b, uint salt) {
  uint hash = pcgHash(uint(a) ^ pcgHash(uint(b) ^ pcgHash(uSeed ^ salt)));
  return float(hash) / 4294967295.0;
}

// Smooth noise along one thread: the thread index picks the row, position runs along it.
float threadNoise(int thread, float position, uint salt) {
  float index = floor(position);
  float fraction = fract(position);
  fraction = fraction * fraction * (3.0 - 2.0 * fraction);
  return mix(random(thread, int(index), salt), random(thread, int(index) + 1, salt), fraction);
}

vec2 loomToPiece(vec2 loom) {
  return uWarpHorizontal ? loom.yx : loom;
}

uint slotAt(vec2 pieceThreads) {
  ivec2 cell = clamp(ivec2(floor(pieceThreads / uThreadsPerCell)), ivec2(0), uGridSize - 1);
  return texelFetch(uGrid, cell, 0).r;
}

uint slotAtLoom(vec2 loom) {
  return slotAt(loomToPiece(loom));
}

vec3 colourOf(uint slot) {
  return uPalette[min(slot, 7u)];
}

// The slot a thread shows at a position: its displaced dye, unless the cell is
// zari or the dye would land on zari (gold thread is woven in, never dyed).
uint dyedSlot(vec2 loomExact, vec2 loomShifted) {
  uint intended = slotAtLoom(loomExact);
  if (intended == ZARI) return ZARI;
  uint shifted = slotAtLoom(loomShifted);
  return shifted == ZARI ? intended : shifted;
}

void main() {
  vec2 pixel = vec2(gl_FragCoord.x, uViewSize.y - gl_FragCoord.y);
  vec2 piece = uOrigin + pixel / uScale;
  vec2 pieceSize = vec2(uGridSize) * uThreadsPerCell;
  if (any(lessThan(piece, vec2(0.0))) || any(greaterThanEqual(piece, pieceSize))) {
    outColor = vec4(uBackground, 1.0);
    return;
  }
  if (uMode == 0) {
    outColor = vec4(colourOf(slotAt(piece)), 1.0);
    return;
  }

  vec2 loom = uWarpHorizontal ? piece.yx : piece;
  int warpIndex = int(floor(loom.x));
  int weftIndex = int(floor(loom.y));
  vec2 withinThread = fract(loom);
  // Plain weave; the thread views show one set of dyed threads as if the other were absent.
  bool warpOnTop = uThreadView == 1 || (uThreadView == 0 && ((warpIndex + weftIndex) & 1) == 0);

  float warpShift = 0.0;
  float weftShift = 0.0;
  if (uMode == 2) {
    float reach = max(uThreadsPerCell, 2.0) * 1.5;
    // Whole-thread misregistration + wavy dye bleed that varies along the thread.
    warpShift = (random(warpIndex, 0, 11u) - 0.5) * 2.0 * uWarpJitter * reach
              + (threadNoise(warpIndex, loom.y / reach, 12u) - 0.5) * 2.0 * uBleed * reach;
    weftShift = (random(weftIndex, 0, 21u) - 0.5) * 2.0 * uWeftJitter * reach
              + (threadNoise(weftIndex, loom.x / reach, 22u) - 0.5) * 2.0 * uBleed * reach;
  }

  vec2 warpCentre = vec2(float(warpIndex) + 0.5, loom.y);
  vec2 weftCentre = vec2(loom.x, float(weftIndex) + 0.5);
  uint warpSlot = dyedSlot(warpCentre, warpCentre + vec2(0.0, warpShift));
  uint weftSlot = dyedSlot(weftCentre, weftCentre + vec2(weftShift, 0.0));
  uint topSlot = warpOnTop ? warpSlot : weftSlot;
  bool zari = topSlot == ZARI;

  // Thread shading: rounded cross-section, darker where the thread dives under.
  float across = abs((warpOnTop ? withinThread.x : withinThread.y) - 0.5) * 2.0;
  float along = abs((warpOnTop ? withinThread.y : withinThread.x) - 0.5) * 2.0;
  // Threads darken where they dive under the other set; alone (thread views) they run straight.
  float dive = uThreadView == 0 ? 0.3 : 0.0;
  float shade = (1.0 - 0.45 * across * across) * (1.0 - dive * along * along * along);
  float highlight = zari
    ? pow(1.0 - across, 3.0) * (1.0 - along * along) * 0.55
    : pow(1.0 - across, 6.0) * (1.0 - along * along) * uSheen * 0.3;
  vec3 woven = colourOf(topSlot) * shade + highlight;

  if (uMode == 2) {
    int topThread = warpOnTop ? warpIndex : weftIndex;
    // Yarn-to-yarn tone variation, fibre noise, and the odd glint on zari.
    float yarn = (random(topThread, warpOnTop ? 1 : 2, 31u) - 0.5) * 0.08;
    // Fibre noise follows the piece, not the screen, so tiled exports have no seams.
    vec2 piecePixel = floor(piece * uScale);
    float fibre = (random(int(piecePixel.x), int(piecePixel.y), 41u) - 0.5) * 0.04;
    woven *= 1.0 + yarn + fibre;
    if (zari && random(warpIndex, weftIndex, 51u) > 0.96) woven += 0.18;
  }

  // When threads are smaller than a few pixels, fade thread detail into the
  // average of both threads instead of aliasing.
  float detail = smoothstep(1.5, 4.0, uScale);
  float warpShare = uThreadView == 1 ? 1.0 : uThreadView == 2 ? 0.0 : 0.5;
  vec3 average = mix(colourOf(weftSlot), colourOf(warpSlot), warpShare);
  outColor = vec4(mix(average, woven, detail), 1.0);
}
`;
