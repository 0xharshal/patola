/** Linear light to sRGB for the screen; shared by the shaders below. */
const LINEAR_TO_SRGB = /* glsl */ `
vec3 linearToSrgb(vec3 linear) {
  linear = clamp(linear, 0.0, 1.0);
  return mix(linear * 12.92, 1.055 * pow(linear, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, linear));
}
`;

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
 * colour it was dyed before weaving, looked up in the design grid.
 *
 * Realistic mode adds what the dyer and the loom do to that colour:
 * - Ikat shift: threads were tied and dyed in bundles (one design cell wide), so
 *   a bundle is displaced along its length as a whole, every thread in it a bit
 *   more, and the displacement wanders along the thread. Warp threads blur the
 *   design lengthwise and weft threads crosswise, so neighbouring threads end at
 *   different places: the feathered double-ikat edge.
 * - Wicking: dye creeps along the yarn past the resist ties, so colour edges fade
 *   over a short, uneven stretch of each thread.
 * - Yarn: twisted silk filaments, uneven thickness and dye uptake, gaps between
 *   threads, and an anisotropic silk sheen that follows each thread over and
 *   under its crossings. Zari (gold) is not dyed, so it is never displaced; it
 *   is lit as metal.
 *
 * Colours are mixed and lit in linear light and written as sRGB. Every effect
 * depends on the position in the piece, never on screen pixels, so tiled exports
 * have no seams and slow camera moves don't shimmer. Detail finer than a pixel
 * fades out instead of aliasing.
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
uniform vec3 uPalette[8];     // linear RGB
uniform vec3 uBackground;     // outside the piece, linear RGB
uniform vec2 uViewSize;       // render target, px
uniform vec2 uOrigin;         // piece position (threads) at the top-left pixel
uniform float uScale;         // pixels per thread
uniform int uSamples;         // samples per pixel along each axis
uniform float uThreadsPerCell;
uniform bool uWarpHorizontal;
uniform int uMode;            // 0 flat, 1 woven, 2 realistic
uniform int uThreadView;      // 0 both (the cloth), 1 warp only, 2 weft only
uniform float uBleed;
uniform float uWarpJitter;
uniform float uWeftJitter;
uniform float uSheen;
uniform float uTexture;       // yarn texture strength
uniform vec3 uLight;          // lamp position: piece position (threads) and height above the cloth
uniform bool uLinearOutput;   // write linear light (into an sRGB image, which encodes it) instead of sRGB
uniform uint uSeed;

out vec4 outColor;

const uint ZARI = 7u;
const float TAU = 6.2831853;
const vec3 GAP = vec3(0.01);  // looking through the cloth between threads
const float THREAD_HALF_WIDTH = 0.43;
const float CRIMP = 0.35;     // how steeply threads rise over and dive under each other
const float FILAMENTS = 9.0;  // silk filaments visible across one thread
const float TWISTS = 1.6;     // twist stripes per thread width, along the thread
const float TWIST_ANGLE = 0.3; // radians the surface fibres lean from the thread axis
// Mean brightness of the lit weave, so far-away cloth (threads smaller than a pixel) matches it.
const float MEAN_SHADE = 0.73;

uint pcgHash(uint value) {
  uint state = value * 747796405u + 2891336453u;
  uint word = ((state >> ((state >> 28u) + 4u)) ^ state) * 277803737u;
  return (word >> 22u) ^ word;
}

// One hash of both inputs, the seed and a salt (cheap: this runs dozens of times per pixel).
float random(int a, int b, uint salt) {
  uint hash = pcgHash(uint(a) * 0x8da6b343u ^ uint(b) * 0xd8163841u ^ (uSeed + salt * 0x9e3779b9u));
  return float(hash) / 4294967295.0;
}

// Smooth noise along one thread: the thread index picks the row, position runs along it.
float threadNoise(int thread, float position, uint salt) {
  float index = floor(position);
  float fraction = fract(position);
  fraction = fraction * fraction * (3.0 - 2.0 * fraction);
  return mix(random(thread, int(index), salt), random(thread, int(index) + 1, salt), fraction);
}

// 1 where a detail of this many cycles per thread is larger than a pixel, fading to 0 where it isn't.
float resolved(float cyclesPerThread) {
  float cyclesPerPixel = cyclesPerThread / (uScale * float(uSamples));
  return 1.0 - smoothstep(0.2, 0.5, cyclesPerPixel);
}

uint slotAt(vec2 pieceThreads) {
  ivec2 cell = clamp(ivec2(floor(pieceThreads / uThreadsPerCell)), ivec2(0), uGridSize - 1);
  return texelFetch(uGrid, cell, 0).r;
}

uint slotAtLoom(vec2 loom) {
  return slotAt(uWarpHorizontal ? loom.yx : loom);
}

vec3 colourOf(uint slot) {
  return uPalette[min(slot, 7u)];
}

// Displaced dye never lands on zari: gold thread is woven in, never dyed.
uint dyedSlot(uint intended, vec2 loomShifted) {
  uint shifted = slotAtLoom(loomShifted);
  return shifted == ZARI ? intended : shifted;
}

// How far the dye of one thread is displaced along it, in threads.
float ikatShift(int thread, float along, float jitter, uint salt) {
  float reach = max(uThreadsPerCell, 2.0) * 1.5;
  int bundle = int(floor(float(thread) / max(uThreadsPerCell, 1.0)));
  float bundleOffset = (random(bundle, 0, salt) - 0.5) * 2.0 * jitter * reach;
  float threadOffset = (random(thread, 0, salt + 1u) - 0.5) * 0.8 * jitter * reach;
  // The bundle's wave is shared (the threads were tied together); each thread also wanders on its own.
  float bundleWave = threadNoise(bundle, along / (reach * 2.5), salt + 2u) - 0.5;
  float ownWave = threadNoise(thread, along / reach, salt + 3u) - 0.5
                + 0.5 * (threadNoise(thread, along / (reach * 0.3), salt + 4u) - 0.5);
  return bundleOffset + threadOffset + (1.1 * bundleWave + 1.5 * ownWave) * uBleed * reach;
}

struct Dye {
  vec3 colour;
  bool zari;
};

// The colour a thread carries at a point: the design under its displaced dye,
// softened where dye wicked along the yarn (sampled a little before and after).
Dye threadDye(vec2 centre, vec2 direction, float shift, float wick, float wickMix) {
  uint intended = slotAtLoom(centre);
  if (intended == ZARI) return Dye(colourOf(ZARI), true);
  vec3 colour = colourOf(dyedSlot(intended, centre + direction * shift));
  if (wickMix > 0.0) {
    vec3 before = colourOf(dyedSlot(intended, centre + direction * (shift - wick)));
    vec3 after = colourOf(dyedSlot(intended, centre + direction * (shift + wick)));
    colour = mix(colour, 0.5 * (before + after), wickMix);
  }
  return Dye(colour, false);
}

struct Yarn {
  Dye dye;
  int thread;
  float across;    // -0.5…0.5 across the thread
  float along;     // -0.5…0.5 along this crossing, 0 where it crosses the other thread
  float position;  // along the whole thread, in threads
  bool isWarp;
  float lift;      // +1 floating on top, -1 passing underneath, 0 straight (thread views)
};

float halfWidth(Yarn yarn) {
  if (uMode != 2) return THREAD_HALF_WIDTH;
  // Slubs: silk is not perfectly even.
  float slub = threadNoise(yarn.thread, yarn.position * 0.6, yarn.isWarp ? 61u : 62u) - 0.5;
  return THREAD_HALF_WIDTH * (1.0 + 0.16 * uTexture * slub);
}

// One thread at one point: rounded, crimped over and under, twisted, lit in linear light.
// The lamp seen from a point of the cloth (piece space: x right, y down, z towards the viewer),
// and the half vector between it and the viewer straight above.
struct Lighting {
  vec3 light;
  vec3 halfVector;
};

Lighting lightingAt(vec2 piece) {
  vec3 light = normalize(uLight - vec3(piece, 0.0));
  return Lighting(light, normalize(light + vec3(0.0, 0.0, 1.0)));
}

vec3 shadeYarn(Yarn yarn, float width, Lighting lighting) {
  float q = clamp(yarn.across / width, -1.0, 1.0);   // -1…1 across the round thread
  float bulge = sqrt(1.0 - q * q);
  // Crimp: height follows cos along the crossing, so the slope is -sin.
  float slope = -yarn.lift * CRIMP * 3.14159 * sin(3.14159 * yarn.along);
  vec3 acrossDir = yarn.isWarp ? vec3(1.0, 0.0, 0.0) : vec3(0.0, 1.0, 0.0);
  vec3 alongDir = yarn.isWarp ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0);
  if (uWarpHorizontal) {
    acrossDir = acrossDir.yxz;
    alongDir = alongDir.yxz;
  }
  vec3 up = vec3(0.0, 0.0, 1.0);
  vec3 normal = normalize(acrossDir * q + up * bulge - alongDir * slope * bulge);

  bool realistic = uMode == 2;
  float yarnTexture = realistic ? uTexture : 0.0;
  // Twisted yarn: surface fibres lean from the axis, giving diagonal bands of light.
  float twistPhase = yarn.position * TWISTS + q * 0.5;
  float twist = sin(TAU * twistPhase) * resolved(TWISTS);

  // Relative to flat cloth at this point, so the palette colour shows where a thread faces the lamp.
  float diffuse = max(dot(normal, lighting.light), 0.0) / max(lighting.light.z, 0.2);
  // Threads passing underneath, and the ends where a thread dives, get less light.
  float occlusion = yarn.lift < 0.0 ? 0.5 + 0.25 * abs(2.0 * yarn.along) : 1.0 - 0.3 * pow(abs(2.0 * yarn.along), 4.0);
  // Sheen: a narrow streak along the thread where its round side mirrors the lamp (across),
  // long and soft along it, fading where the thread dives (crimp). The lamp is at one place,
  // so the streak slides across the threads from one part of the cloth to the next.
  vec3 crossNormal = normalize(acrossDir * q + up * bulge);
  vec3 crimpNormal = normalize(up - alongDir * slope);
  float acrossFacing = max(dot(crossNormal, lighting.halfVector), 0.0);
  float alongFacing = max(dot(crimpNormal, lighting.halfVector), 0.0);
  float twistGlint = 1.0 + 0.6 * twist * yarnTexture; // twisted fibres catch the light in diagonal bands
  if (yarn.dye.zari) {
    // Flat metal strip wrapped round a silk core: bright, coloured reflections in bands.
    float glint = pow(acrossFacing, 6.0) * pow(alongFacing, 2.0) * (0.75 + 0.25 * twist);
    vec3 metal = yarn.dye.colour * (0.3 + 0.35 * diffuse + 1.4 * glint) * occlusion;
    if (realistic && random(yarn.thread, int(floor(yarn.position)), 51u) > 0.96) metal *= 1.5;
    return metal;
  }

  vec3 colour = yarn.dye.colour * (0.32 + 0.68 * diffuse) * occlusion;
  if (realistic) {
    // Filaments: each reeled silk filament takes the light and the dye a little differently.
    float filamentCoord = (q * 0.5 + 0.5) * FILAMENTS + yarn.position * FILAMENTS * TWIST_ANGLE * 0.5;
    int filamentId = yarn.thread * 32 + int(floor(filamentCoord));
    // Fine dark lines between neighbouring filaments.
    float groove = pow(abs(2.0 * fract(filamentCoord) - 1.0), 6.0) * resolved(2.0 * FILAMENTS / (2.0 * THREAD_HALF_WIDTH));
    float strand = (random(filamentId, 7, yarn.isWarp ? 71u : 72u) - 0.5) * 0.3
                 + (threadNoise(filamentId, yarn.position * 5.0, 73u) - 0.5) * 0.15
                 - 0.3 * groove;
    // Dye uptake differs from thread to thread and drifts slowly along each one.
    float uptake = (random(yarn.thread, yarn.isWarp ? 1 : 2, 31u) - 0.5) * 0.1
                 + (threadNoise(yarn.thread, yarn.position * 0.08, yarn.isWarp ? 32u : 33u) - 0.5) * 0.08;
    colour *= 1.0 + yarnTexture * (strand * resolved(FILAMENTS / (2.0 * THREAD_HALF_WIDTH)) + 0.12 * twist) + uptake;
  }
  float sheen = pow(acrossFacing, 18.0) * pow(alongFacing, 6.0) * twistGlint;
  // Silk reflects mostly white with a hint of its dye.
  colour += (0.75 * vec3(1.0) + 0.25 * yarn.dye.colour) * sheen * uSheen * 0.55 * occlusion;
  return colour;
}

vec3 weave(vec2 piece) {
  if (uMode == 0) return colourOf(slotAt(piece));

  vec2 loom = uWarpHorizontal ? piece.yx : piece;
  int warpIndex = int(floor(loom.x));
  int weftIndex = int(floor(loom.y));
  vec2 within = fract(loom) - 0.5;
  // Plain weave; the thread views show one set of dyed threads as if the other were absent.
  bool warpOnTop = uThreadView == 1 || (uThreadView == 0 && ((warpIndex + weftIndex) & 1) == 0);

  float warpShift = 0.0, weftShift = 0.0, warpWick = 0.0, weftWick = 0.0, wickMix = 0.0;
  if (uMode == 2) {
    float reach = max(uThreadsPerCell, 2.0) * 1.5;
    warpShift = ikatShift(warpIndex, loom.y, uWarpJitter, 11u);
    weftShift = ikatShift(weftIndex, loom.x, uWeftJitter, 21u);
    warpWick = reach * (0.15 + 0.7 * threadNoise(warpIndex, loom.y / reach, 15u)) * uBleed;
    weftWick = reach * (0.15 + 0.7 * threadNoise(weftIndex, loom.x / reach, 25u)) * uBleed;
    wickMix = min(0.5, uBleed);
  }
  Dye warp = threadDye(vec2(float(warpIndex) + 0.5, loom.y), vec2(0.0, 1.0), warpShift, warpWick, wickMix);
  Dye weft = threadDye(vec2(loom.x, float(weftIndex) + 0.5), vec2(1.0, 0.0), weftShift, weftWick, wickMix);

  // Threads smaller than a few pixels: show the colour they average to instead of aliasing.
  float warpShare = uThreadView == 1 ? 1.0 : uThreadView == 2 ? 0.0 : 0.5;
  vec3 average = mix(weft.colour, warp.colour, warpShare) * MEAN_SHADE;
  float detail = smoothstep(1.5, 4.0, uScale * float(uSamples));
  if (detail <= 0.0) return average;

  bool alone = uThreadView != 0;
  float lift = alone ? 0.0 : 1.0;
  // The other thread of this crossing passes underneath; it shows in the gaps beside the top one.
  // (WebGL allows no ?: on structs.)
  Yarn warpYarn = Yarn(warp, warpIndex, within.x, within.y, loom.y, true, warpOnTop ? lift : -lift);
  Yarn weftYarn = Yarn(weft, weftIndex, within.y, within.x, loom.x, false, warpOnTop ? -lift : lift);
  Yarn top = weftYarn;
  Yarn under = warpYarn;
  if (warpOnTop) {
    top = warpYarn;
    under = weftYarn;
  }

  float edge = 0.75 / (uScale * float(uSamples)); // a pixel, in threads: soft, alias-free thread edges
  float topWidth = halfWidth(top);
  float underWidth = halfWidth(under);
  float topCover = 1.0 - smoothstep(topWidth - edge, topWidth + edge, abs(top.across));
  float underCover = alone ? 0.0 : 1.0 - smoothstep(underWidth - edge, underWidth + edge, abs(under.across));
  Lighting lighting = lightingAt(piece);
  vec3 woven = shadeYarn(top, topWidth, lighting);
  // Most pixels lie on the top thread: shade the one underneath only where it can show.
  if (topCover < 1.0) {
    vec3 below = mix(GAP, shadeYarn(under, underWidth, lighting), underCover);
    woven = mix(below, woven, topCover);
  }
  return mix(average, woven, detail);
}

${LINEAR_TO_SRGB}
void main() {
  vec2 pixel = vec2(gl_FragCoord.x, uViewSize.y - gl_FragCoord.y);
  vec2 pieceSize = vec2(uGridSize) * uThreadsPerCell;
  vec3 sum = vec3(0.0);
  for (int row = 0; row < 4; row++) {
    if (row >= uSamples) break;
    for (int column = 0; column < 4; column++) {
      if (column >= uSamples) break;
      vec2 offset = (vec2(column, row) + 0.5) / float(uSamples) - 0.5;
      vec2 piece = uOrigin + (pixel + offset) / uScale;
      bool inside = all(greaterThanEqual(piece, vec2(0.0))) && all(lessThan(piece, pieceSize));
      sum += inside ? weave(piece) : uBackground;
    }
  }
  vec3 linear = sum / float(uSamples * uSamples);
  if (uLinearOutput) {
    outColor = vec4(linear, 1.0);
    return;
  }
  vec3 colour = linearToSrgb(linear);
  if (uMode != 0) {
    // Dither by half a step so smooth shading doesn't band on 8-bit output (tied to the piece, not the screen).
    vec2 piecePixel = floor((uOrigin + pixel / uScale) * uScale);
    colour += (random(int(piecePixel.x), int(piecePixel.y), 81u) - 0.5) / 255.0;
  }
  outColor = vec4(colour, 1.0);
}
`;

/**
 * Shows a prerendered image of part of the piece (exhibition image mode): maps
 * each pixel to the piece like the weave shader does and looks it up in the
 * image. The image is sRGB, so sampling and mipmaps blend in linear light.
 */
export const IMAGE_FRAGMENT_SHADER = /* glsl */ `#version 300 es
precision highp float;

uniform sampler2D uImage;
uniform vec4 uArea;       // part of the piece the image shows: x, y, width, height (threads)
uniform vec2 uViewSize;   // render target, px
uniform vec2 uOrigin;     // piece position (threads) at the top-left pixel
uniform float uScale;     // pixels per thread
uniform float uOpacity;

out vec4 outColor;

${LINEAR_TO_SRGB}
void main() {
  vec2 pixel = vec2(gl_FragCoord.x, uViewSize.y - gl_FragCoord.y);
  vec2 position = (uOrigin + pixel / uScale - uArea.xy) / uArea.zw;
  if (any(lessThan(position, vec2(0.0))) || any(greaterThan(position, vec2(1.0)))) discard;
  // The image's first row is the top of its area, stored last (images are bottom-up).
  vec3 linear = texture(uImage, vec2(position.x, 1.0 - position.y)).rgb;
  outColor = vec4(linearToSrgb(linear), uOpacity);
}
`;
