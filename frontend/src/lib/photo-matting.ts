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
}

const DEFAULTS: Required<MattingOptions> = {
  radius: 14,
  epsilon: 0.0002,
  low: 0.4,
  high: 0.7,
  colorRadius: 5,
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
  const { radius, epsilon, low, high, colorRadius } = {
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
