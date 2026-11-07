/**
 * Resident photo helpers: crop a camera frame to an ID-style portrait and remove the background
 * on this computer.
 *
 * Privacy rule (docs/08 D-18): resident photos are never sent to an online service. The model and
 * its WebAssembly runtime come from our own server (see `selfieSegmentationAssets` in vite.config.ts).
 */

export const PHOTO_WIDTH = 600
export const PHOTO_HEIGHT = 800 // 3:4 portrait, the shape of the photo boxes on the clearance and the ID

const ASSET_PATH = "/vision/selfie-segmentation/"

type SegmentationResults = { image: CanvasImageSource; segmentationMask: CanvasImageSource }
type Segmenter = {
  setOptions(options: { modelSelection: number }): void
  onResults(listener: (results: SegmentationResults) => void): void
  initialize(): Promise<void>
  send(inputs: { image: HTMLCanvasElement }): Promise<void>
}
type SegmenterConstructor = new (config: { locateFile: (file: string) => string }) => Segmenter

declare global {
  interface Window {
    SelfieSegmentation?: SegmenterConstructor
  }
}

let segmenterPromise: Promise<Segmenter> | null = null
let queue: Promise<unknown> = Promise.resolve()

function loadScript(src: string) {
  return new Promise<void>((resolve, reject) => {
    const script = document.createElement("script")
    script.src = src
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error("The background remover could not be loaded."))
    document.head.appendChild(script)
  })
}

/** Loads the model once (about 12 MB, from our own server) and keeps it for later photos. */
export function loadBackgroundRemover(): Promise<Segmenter> {
  if (!segmenterPromise) {
    segmenterPromise = (async () => {
      if (!window.SelfieSegmentation) await loadScript(`${ASSET_PATH}selfie_segmentation.js`)
      const Segmentation = window.SelfieSegmentation
      if (!Segmentation) throw new Error("The background remover could not be loaded.")
      const segmenter = new Segmentation({ locateFile: (file) => `${ASSET_PATH}${file}` })
      segmenter.setOptions({ modelSelection: 0 })
      await segmenter.initialize()
      return segmenter
    })().catch((error) => {
      segmenterPromise = null // allow a retry
      throw error
    })
  }
  return segmenterPromise
}

function createCanvas(width: number, height: number) {
  const canvas = document.createElement("canvas")
  canvas.width = width
  canvas.height = height
  return canvas
}

/** Centre-crops any image or video frame to the 3:4 portrait used for photos. */
export function cropToPortrait(source: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement): HTMLCanvasElement {
  const sourceWidth = source instanceof HTMLVideoElement ? source.videoWidth : source instanceof HTMLImageElement ? source.naturalWidth : source.width
  const sourceHeight = source instanceof HTMLVideoElement ? source.videoHeight : source instanceof HTMLImageElement ? source.naturalHeight : source.height
  const targetRatio = PHOTO_WIDTH / PHOTO_HEIGHT
  let cropWidth = sourceHeight * targetRatio
  let cropHeight = sourceHeight
  if (cropWidth > sourceWidth) {
    cropWidth = sourceWidth
    cropHeight = sourceWidth / targetRatio
  }
  const canvas = createCanvas(PHOTO_WIDTH, PHOTO_HEIGHT)
  const context = canvas.getContext("2d")
  if (!context) throw new Error("This browser cannot process photos.")
  context.drawImage(source, (sourceWidth - cropWidth) / 2, (sourceHeight - cropHeight) / 2, cropWidth, cropHeight, 0, 0, PHOTO_WIDTH, PHOTO_HEIGHT)
  return canvas
}

function smoothstep(low: number, high: number, value: number) {
  const t = Math.min(1, Math.max(0, (value - low) / (high - low)))
  return t * t * (3 - 2 * t)
}

/**
 * Returns a copy of the photo with everything except the person made transparent.
 * The model gives a soft 0..1 "how much is the person" mask. It is sharpened a little and then
 * blurred about one pixel so the outline is clean but not jagged.
 */
export async function removeBackground(photo: HTMLCanvasElement): Promise<HTMLCanvasElement> {
  const segmenter = await loadBackgroundRemover()
  const run = queue.then(() => new Promise<CanvasImageSource>((resolve, reject) => {
    segmenter.onResults((results) => resolve(results.segmentationMask))
    segmenter.send({ image: photo }).catch(reject)
  }))
  queue = run.catch(() => undefined)
  const rawMask = await run

  const { width, height } = photo
  const maskCanvas = createCanvas(width, height)
  const maskContext = maskCanvas.getContext("2d", { willReadFrequently: true })
  if (!maskContext) throw new Error("This browser cannot process photos.")
  maskContext.drawImage(rawMask, 0, 0, width, height)
  const pixels = maskContext.getImageData(0, 0, width, height)
  for (let index = 0; index < pixels.data.length; index += 4) {
    // The confidence is stored in the red channel; the alpha channel is always opaque.
    const confidence = pixels.data[index] / 255
    pixels.data[index] = 255
    pixels.data[index + 1] = 255
    pixels.data[index + 2] = 255
    pixels.data[index + 3] = Math.round(smoothstep(0.35, 0.65, confidence) * 255)
  }
  maskContext.putImageData(pixels, 0, 0)

  const softMask = createCanvas(width, height)
  const softContext = softMask.getContext("2d")
  if (!softContext) throw new Error("This browser cannot process photos.")
  softContext.filter = "blur(1.2px)"
  softContext.drawImage(maskCanvas, 0, 0)

  const result = createCanvas(width, height)
  const context = result.getContext("2d")
  if (!context) throw new Error("This browser cannot process photos.")
  context.drawImage(photo, 0, 0)
  context.globalCompositeOperation = "destination-in"
  context.drawImage(softMask, 0, 0)
  return result
}

export function canvasToPhotoUrl(canvas: HTMLCanvasElement, transparent: boolean) {
  return transparent ? canvas.toDataURL("image/png") : canvas.toDataURL("image/jpeg", 0.92)
}
