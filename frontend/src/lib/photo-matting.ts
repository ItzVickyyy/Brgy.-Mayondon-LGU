/**
 * Edge refinement for the background remover. Pure functions on pixel arrays (no canvas), so they
 * can be tested with synthetic images.
 *
 * Why: the segmentation model answers at low resolution, so its mask is blocky once stretched to
 * the photo size, and the background colour is still mixed into the edge pixels (a halo). Three
 * steps fix this on this computer, without any online service (docs/08 D-18):
 *  1. a guided filter makes the mask follow the real edges of the photo,
 *  2. the edge is pulled in a little so no strip of background is kept,
 *  3. edge pixels get the colour of the person nearby instead of the background colour.
 */

/** Box average of `src` (width x height) with the given radius, in O(n). */
function boxFilter(
  src: Float32Array,
  width: number,
  height: number,
  radius: number,
): Float32Array {
  const horizontal = new Float32Array(src.length)
  for (let y = 0; y < height; y++) {
    const row = y * width
    let sum = 0
    // Edge pixels repeat the nearest value so the window is always full.
    for (let x = -radius; x <= radius; x++)
      sum += src[row + Math.min(width - 1, Math.max(0, x))]
    const size = radius * 2 + 1
    for (let x = 0; x < width; x++) {
      horizontal[row + x] = sum / size
      sum +=
        src[row + Math.min(width - 1, x + radius + 1)] -
        src[row + Math.max(0, x - radius)]
    }
  }
  const result = new Float32Array(src.length)
  const size = radius * 2 + 1
  for (let x = 0; x < width; x++) {
    let sum = 0
    for (let y = -radius; y <= radius; y++)
      sum += horizontal[Math.min(height - 1, Math.max(0, y)) * width + x]
    for (let y = 0; y < height; y++) {
      result[y * width + x] = sum / size
      sum +=
        horizontal[Math.min(height - 1, y + radius + 1) * width + x] -
        horizontal[Math.max(0, y - radius) * width + x]
    }
  }
  return result
}

function smoothstep(low: number, high: number, value: number) {
  const t = Math.min(1, Math.max(0, (value - low) / (high - low)))
  return t * t * (3 - 2 * t)
}

/**
 * Guided filter (He et al.): smooths `input` but keeps it aligned with the edges of `guide`.
 * Both are 0..1 arrays of the same size.
 */
export function guidedFilter(
  guide: Float32Array,
  input: Float32Array,
  width: number,
  height: number,
  radius: number,
  epsilon: number,
): Float32Array {
  const count = guide.length
  const meanGuide = boxFilter(guide, width, height, radius)
  const meanInput = boxFilter(input, width, height, radius)
  const guideTimesGuide = new Float32Array(count)
  const guideTimesInput = new Float32Array(count)
  for (let index = 0; index < count; index++) {
    guideTimesGuide[index] = guide[index] * guide[index]
    guideTimesInput[index] = guide[index] * input[index]
  }
  const meanGuideGuide = boxFilter(guideTimesGuide, width, height, radius)
  const meanGuideInput = boxFilter(guideTimesInput, width, height, radius)
  const slope = new Float32Array(count)
  const offset = new Float32Array(count)
  for (let index = 0; index < count; index++) {
    const variance = meanGuideGuide[index] - meanGuide[index] * meanGuide[index]
    const covariance =
      meanGuideInput[index] - meanGuide[index] * meanInput[index]
    slope[index] = covariance / (variance + epsilon)
    offset[index] = meanInput[index] - slope[index] * meanGuide[index]
  }
  const meanSlope = boxFilter(slope, width, height, radius)
  const meanOffset = boxFilter(offset, width, height, radius)
  const output = new Float32Array(count)
  for (let index = 0; index < count; index++) {
    output[index] = Math.min(
      1,
      Math.max(0, meanSlope[index] * guide[index] + meanOffset[index]),
    )
  }
  return output
}

/**
 * The model sometimes keeps a strip of wall around the person. Starting from the pixels that are
 * clearly outside, this peels the mask inward one ring at a time while the next pixel still has the
 * colour of the background nearby, and stops at the first pixel that looks different. So only a
 * band of background colour that touches the real outside is removed, never a part of the person
 * that happens to be surrounded by other colours.
 */
export function trimBackgroundLeak(
  rgba: Uint8ClampedArray,
  alpha: Float32Array,
  width: number,
  height: number,
  maxRing: number,
  tolerance: number,
): void {
  const count = width * height
  const removed = new Uint8Array(count)
  const peeled = new Float32Array(count)
  const outside = new Float32Array(count)
  const red = new Float32Array(count)
  const green = new Float32Array(count)
  const blue = new Float32Array(count)
  for (let index = 0; index < count; index++) {
    if (alpha[index] < 0.05) {
      removed[index] = 1
      outside[index] = 1
      red[index] = rgba[index * 4]
      green[index] = rgba[index * 4 + 1]
      blue[index] = rgba[index * 4 + 2]
    }
  }
  // Background colour near each pixel, from the outside pixels around it.
  const reach = maxRing + 2
  const outsideBlur = boxFilter(outside, width, height, reach)
  const redBlur = boxFilter(red, width, height, reach)
  const greenBlur = boxFilter(green, width, height, reach)
  const blueBlur = boxFilter(blue, width, height, reach)

  // Person colour near each pixel, from pixels that are surely the person and away from the
  // outside. Where it is close to the background colour (a white shirt in front of a white wall)
  // the two cannot be told apart, so nothing is peeled there.
  const deep = new Float32Array(count)
  const deepRed = new Float32Array(count)
  const deepGreen = new Float32Array(count)
  const deepBlue = new Float32Array(count)
  for (let index = 0; index < count; index++) {
    if (alpha[index] > 0.97 && outsideBlur[index] === 0) {
      deep[index] = 1
      deepRed[index] = rgba[index * 4]
      deepGreen[index] = rgba[index * 4 + 1]
      deepBlue[index] = rgba[index * 4 + 2]
    }
  }
  const similarReach = 25
  const deepBlur = boxFilter(deep, width, height, similarReach)
  const deepRedBlur = boxFilter(deepRed, width, height, similarReach)
  const deepGreenBlur = boxFilter(deepGreen, width, height, similarReach)
  const deepBlueBlur = boxFilter(deepBlue, width, height, similarReach)

  for (let ring = 0; ring < maxRing; ring++) {
    const found: number[] = []
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const index = y * width + x
        if (removed[index] || alpha[index] === 0 || outsideBlur[index] < 0.02)
          continue
        const touches =
          (x > 0 && removed[index - 1]) ||
          (x < width - 1 && removed[index + 1]) ||
          (y > 0 && removed[index - width]) ||
          (y < height - 1 && removed[index + width])
        if (!touches) continue
        const weight = outsideBlur[index]
        const offset = index * 4
        const difference = Math.max(
          Math.abs(rgba[offset] - redBlur[index] / weight),
          Math.abs(rgba[offset + 1] - greenBlur[index] / weight),
          Math.abs(rgba[offset + 2] - blueBlur[index] / weight),
        )
        if (difference > tolerance) continue
        const personWeight = deepBlur[index]
        if (personWeight < 0.01) continue
        const personGap = Math.max(
          Math.abs(deepRedBlur[index] / personWeight - redBlur[index] / weight),
          Math.abs(
            deepGreenBlur[index] / personWeight - greenBlur[index] / weight,
          ),
          Math.abs(
            deepBlueBlur[index] / personWeight - blueBlur[index] / weight,
          ),
        )
        if (personGap > 40) found.push(index)
      }
    }
    if (found.length === 0) break
    for (const index of found) {
      removed[index] = 1
      peeled[index] = 1
    }
  }

  // Soften the new edge by about a pixel, only around the pixels that were peeled.
  const soft = boxFilter(peeled, width, height, 1)
  for (let index = 0; index < count; index++) {
    if (peeled[index]) alpha[index] = 0
    else alpha[index] *= 1 - soft[index]
  }
}

export type MattingOptions = {
  /** Window of the guided filter, in pixels of the final photo. */
  radius?: number
  /** Smaller sticks to photo edges more strongly. */
  epsilon?: number
  /** Mask values below `low` become fully transparent, above `high` fully opaque. */
  low?: number
  high?: number
  /** Window used to find the person's own colour next to the edge. */
  colorRadius?: number
  /** Most pixels (from the outside in) that may be removed because they still look like the background. */
  leakRadius?: number
  /** How close (largest difference in one colour channel, 0..255) a pixel must be to the background to count as background. */
  leakTolerance?: number
}

const DEFAULTS: Required<MattingOptions> = {
  radius: 14,
  epsilon: 0.0002,
  low: 0.4,
  high: 0.7,
  colorRadius: 5,
  leakRadius: 8,
  leakTolerance: 28,
}

/**
 * `rgba` is the photo (RGBA bytes), `mask` the model's 0..1 "how much is the person" at the same
 * size. Returns a new RGBA array: alpha is the refined mask, and the colour of every partly
 * transparent pixel is replaced by the colour of the person next to it, so no background colour
 * stays in the outline.
 */
export function refineCutout(
  rgba: Uint8ClampedArray,
  mask: Float32Array,
  width: number,
  height: number,
  options: MattingOptions = {},
): Uint8ClampedArray<ArrayBuffer> {
  const { radius, epsilon, low, high, colorRadius, leakRadius, leakTolerance } =
    {
      ...DEFAULTS,
      ...options,
    }
  const count = width * height

  const guide = new Float32Array(count)
  for (let index = 0; index < count; index++) {
    const offset = index * 4
    guide[index] =
      (0.299 * rgba[offset] +
        0.587 * rgba[offset + 1] +
        0.114 * rgba[offset + 2]) /
      255
  }

  const filtered = guidedFilter(guide, mask, width, height, radius, epsilon)
  const alpha = new Float32Array(count)
  for (let index = 0; index < count; index++)
    alpha[index] = smoothstep(low, high, filtered[index])
  if (leakRadius > 0)
    trimBackgroundLeak(rgba, alpha, width, height, leakRadius, leakTolerance)

  // Colour of the person, measured only where the pixel is surely the person.
  const weight = new Float32Array(count)
  const red = new Float32Array(count)
  const green = new Float32Array(count)
  const blue = new Float32Array(count)
  for (let index = 0; index < count; index++) {
    const core = alpha[index] > 0.97 ? 1 : 0
    weight[index] = core
    red[index] = rgba[index * 4] * core
    green[index] = rgba[index * 4 + 1] * core
    blue[index] = rgba[index * 4 + 2] * core
  }
  const weightBlur = boxFilter(weight, width, height, colorRadius)
  const redBlur = boxFilter(red, width, height, colorRadius)
  const greenBlur = boxFilter(green, width, height, colorRadius)
  const blueBlur = boxFilter(blue, width, height, colorRadius)

  const output = new Uint8ClampedArray(count * 4)
  for (let index = 0; index < count; index++) {
    const offset = index * 4
    const own = alpha[index]
    let r = rgba[offset]
    let g = rgba[offset + 1]
    let b = rgba[offset + 2]
    if (own < 0.97 && weightBlur[index] > 0.02) {
      const keep = smoothstep(0.2, 0.97, own) * 0.5 // keep a little of the real pixel for texture
      r = (redBlur[index] / weightBlur[index]) * (1 - keep) + r * keep
      g = (greenBlur[index] / weightBlur[index]) * (1 - keep) + g * keep
      b = (blueBlur[index] / weightBlur[index]) * (1 - keep) + b * keep
    }
    output[offset] = r
    output[offset + 1] = g
    output[offset + 2] = b
    output[offset + 3] = Math.round(own * 255)
  }
  return output
}
