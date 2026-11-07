import { type ChangeEvent, useCallback, useEffect, useRef, useState } from "react"
import type { TFunction } from "i18next"
import { useTranslation } from "react-i18next"
import { Camera, ImageOff, LoaderCircle, RefreshCw, Upload, UserRound } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { canvasToPhotoUrl, cropToPortrait, PHOTO_HEIGHT, PHOTO_WIDTH, removeBackground } from "@/lib/photo-background"
import { photoUploadMessage } from "@/lib/issuanceLabels"
import { PHOTO_UPLOAD_ACCEPT, PHOTO_UPLOAD_OPEN_ERROR, validatePhotoFile } from "@/lib/photo-upload"

type Phase = "camera" | "working"

type PhotoVersions = {
  cutout: string
  original: string
}

type PhotoCaptureProps = {
  id?: string
  /** The photo now saved for the resident (a picture address), if any. */
  value?: string
  onChange: (photoUrl: string) => void
}

type PhotoResult = PhotoVersions & { removalFailed: boolean }

/** Makes the original and the cut-out from a portrait crop. If the background cannot be removed, only the original is kept. */
async function makePhotoVersions(portrait: HTMLCanvasElement): Promise<PhotoResult> {
  const original = canvasToPhotoUrl(portrait, false)
  try {
    const removed = await removeBackground(portrait)
    return { cutout: canvasToPhotoUrl(removed, true), original, removalFailed: false }
  } catch {
    return { cutout: "", original, removalFailed: true }
  }
}

/** Opens a chosen picture file as an image. The browser applies the photo's rotation (EXIF) when it is drawn. */
async function loadImageFile(file: File): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(file)
  try {
    const image = new Image()
    image.src = url
    await image.decode()
    if (!image.naturalWidth || !image.naturalHeight) throw new Error("empty image")
    return image
  } finally {
    URL.revokeObjectURL(url)
  }
}

/** A photo box with buttons to take a photo with the camera or upload a picture file. Used where a document needs the resident's picture. */
export function PhotoCapture({ id, value, onChange }: PhotoCaptureProps) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [fallbackNotice, setFallbackNotice] = useState(false)
  const [photoVersions, setPhotoVersions] = useState<PhotoVersions | null>(null)
  const [keepOriginal, setKeepOriginal] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [uploadError, setUploadError] = useState("")
  const fileInputRef = useRef<HTMLInputElement>(null)
  const lastManagedValue = useRef(value)

  useEffect(() => {
    if (value === lastManagedValue.current) return
    lastManagedValue.current = value
    setPhotoVersions(null)
    setKeepOriginal(false)
    setFallbackNotice(false)
    setUploadError("")
  }, [value])

  function applyPhoto(photoUrl: string) {
    lastManagedValue.current = photoUrl
    onChange(photoUrl)
  }

  function handleUse({ cutout, original, removalFailed }: PhotoResult) {
    setPhotoVersions({ cutout, original })
    setKeepOriginal(false)
    setUploadError("")
    setFallbackNotice(removalFailed)
    applyPhoto(removalFailed ? original : cutout)
    setOpen(false)
  }

  function handleKeepOriginal(checked: boolean) {
    if (!photoVersions?.cutout) return
    setKeepOriginal(checked)
    setFallbackNotice(false)
    applyPhoto(checked ? photoVersions.original : photoVersions.cutout)
  }

  async function handleFileChosen(event: ChangeEvent<HTMLInputElement>) {
    const input = event.target
    const file = input.files?.[0]
    input.value = "" // so choosing the same file again still counts as a change
    if (!file) return
    const problem = validatePhotoFile(file)
    if (problem) { setUploadError(photoUploadMessage(problem, t)); return }
    setUploadError("")
    setProcessing(true)
    try {
      const image = await loadImageFile(file)
      handleUse(await makePhotoVersions(cropToPortrait(image)))
    } catch {
      setUploadError(photoUploadMessage(PHOTO_UPLOAD_OPEN_ERROR, t))
    } finally {
      setProcessing(false)
    }
  }

  const hint = processing
    ? t("issuances.new.photoCapture.removing")
    : fallbackNotice
      ? t("issuances.new.photoCapture.fallback")
      : value
        ? t("issuances.new.photoCapture.ready")
        : t("issuances.new.photoCapture.prompt")

  return (
    <div className="flex items-center gap-4">
      <div className="flex h-28 w-[84px] shrink-0 items-center justify-center overflow-hidden rounded-md border bg-white">
        {value ? <img src={value} alt={t("issuances.new.photoCapture.alt")} className="size-full object-cover" /> : <UserRound className="size-8 text-muted-foreground/50" aria-hidden="true" />}
      </div>
      <div className="flex min-w-0 flex-col items-start gap-1.5">
        <div className="flex flex-wrap gap-2">
          <Button id={id} type="button" variant={value ? "outline" : "default"} onClick={() => setOpen(true)} disabled={processing}>
            <Camera className="size-4" aria-hidden="true" />{value ? t("issuances.new.photoCapture.retake") : t("issuances.new.photoCapture.take")}
          </Button>
          <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()} disabled={processing}>
            {processing ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> : <Upload className="size-4" aria-hidden="true" />}{t("issuances.new.photoCapture.upload")}
          </Button>
          <input ref={fileInputRef} type="file" accept={PHOTO_UPLOAD_ACCEPT} onChange={(event) => void handleFileChosen(event)} className="hidden" aria-label={t("issuances.new.photoCapture.chooseFile")} tabIndex={-1} />
        </div>
        <p className="text-xs text-muted-foreground" role={processing ? "status" : undefined}>{hint}</p>
        {uploadError ? <p className="text-xs text-destructive" role="alert">{uploadError}</p> : null}
        {photoVersions?.cutout ? (
          <label className="flex min-h-11 cursor-pointer items-center gap-2 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={keepOriginal}
              onChange={(event) => handleKeepOriginal(event.target.checked)}
              className="size-4 shrink-0 accent-primary"
            />
            <span>{t("issuances.new.photoCapture.keepOriginal")}</span>
          </label>
        ) : null}
      </div>
      <PhotoCaptureDialog open={open} onOpenChange={setOpen} onUse={handleUse} />
    </div>
  )
}

function cameraErrorMessage(error: unknown, t: TFunction) {
  if (typeof window !== "undefined" && (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia)) {
    return t("issuances.new.photoCapture.errors.insecure")
  }
  const name = error instanceof DOMException ? error.name : ""
  if (name === "NotAllowedError" || name === "SecurityError") return t("issuances.new.photoCapture.errors.blocked")
  if (name === "NotFoundError" || name === "OverconstrainedError") return t("issuances.new.photoCapture.errors.notFound")
  if (name === "NotReadableError" || name === "AbortError") return t("issuances.new.photoCapture.errors.inUse")
  return t("issuances.new.photoCapture.errors.generic")
}

function PhotoCaptureDialog({ open, onOpenChange, onUse }: { open: boolean; onOpenChange: (open: boolean) => void; onUse: (photos: PhotoResult) => void }) {
  const { t } = useTranslation()
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [phase, setPhase] = useState<Phase>("camera")
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([])
  const [cameraId, setCameraId] = useState("")
  const [activeCameraId, setActiveCameraId] = useState("")
  const [attempt, setAttempt] = useState(0)
  const [cameraReady, setCameraReady] = useState(false)
  const [cameraError, setCameraError] = useState("")

  const stopCamera = useCallback(() => {
    for (const track of streamRef.current?.getTracks() ?? []) track.stop()
    streamRef.current = null
    setCameraReady(false)
  }, [])

  // Start the camera while the dialog is open and we are waiting for a shot.
  // biome-ignore lint/correctness/useExhaustiveDependencies: `attempt` makes "Try again" start the camera once more.
  useEffect(() => {
    if (!open || phase !== "camera") return
    let cancelled = false
    setCameraError("")
    setCameraReady(false)
    async function start() {
      try {
        if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) throw new Error("insecure")
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { ...(cameraId ? { deviceId: { exact: cameraId } } : { facingMode: "user" }), width: { ideal: 1280 }, height: { ideal: 960 } },
          audio: false,
        })
        if (cancelled) { for (const track of stream.getTracks()) track.stop(); return }
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          await videoRef.current.play().catch(() => undefined)
        }
        // Names of the cameras are only available after permission is given.
        const devices = (await navigator.mediaDevices.enumerateDevices()).filter((device) => device.kind === "videoinput")
        if (!cancelled) { setCameras(devices); setActiveCameraId(stream.getVideoTracks()[0]?.getSettings().deviceId ?? ""); setCameraReady(true) }
      } catch (error) {
        if (!cancelled) setCameraError(cameraErrorMessage(error, t))
      }
    }
    void start()
    return () => { cancelled = true; stopCamera() }
  }, [open, phase, cameraId, attempt, stopCamera, t])

  // Start fresh each time the dialog opens.
  useEffect(() => {
    if (!open) return
    setPhase("camera")
    setCameraError("")
  }, [open])

  async function takePhoto() {
    const video = videoRef.current
    if (!video?.videoWidth) return
    const portrait = cropToPortrait(video)
    stopCamera()
    setPhase("working")
    onUse(await makePhotoVersions(portrait))
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-md" onInteractOutside={(event) => event.preventDefault()}>
        <DialogHeader>
          <DialogTitle>{t("issuances.new.photoCapture.dialogTitle")}</DialogTitle>
          <DialogDescription>
            {phase === "camera" ? t("issuances.new.photoCapture.faceCamera") : t("issuances.new.photoCapture.removing")}
          </DialogDescription>
        </DialogHeader>

        <div className="mx-auto w-full max-w-[300px]">
          <div className="relative overflow-hidden rounded-md border bg-neutral-900" style={{ aspectRatio: `${PHOTO_WIDTH} / ${PHOTO_HEIGHT}` }}>
            {phase === "camera" ? (
              <>
                {/* Mirror the live preview so the resident sees a familiar front-camera view. The saved photo remains in its natural orientation. */}
                <video ref={videoRef} playsInline muted aria-label={t("issuances.new.photoCapture.preview")} className="size-full -scale-x-100 object-cover" />
                {cameraReady ? <div className="pointer-events-none absolute left-1/2 top-[10%] h-[54%] w-[58%] -translate-x-1/2 rounded-[50%] border-2 border-dashed border-white/70" aria-hidden="true" /> : null}
                {!cameraReady && !cameraError ? <div className="absolute inset-0 flex items-center justify-center gap-2 text-sm text-white" role="status"><LoaderCircle className="size-4 animate-spin" aria-hidden="true" />{t("issuances.new.photoCapture.starting")}</div> : null}
                {cameraError ? <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-4 text-center text-sm text-white"><ImageOff className="size-6" aria-hidden="true" />{cameraError}</div> : null}
              </>
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-sm text-white" role="status"><LoaderCircle className="size-6 animate-spin" aria-hidden="true" />{t("issuances.new.photoCapture.removingBackground")}<span className="px-6 text-center text-xs text-white/80">{t("issuances.new.photoCapture.firstPhotoSlow")}</span></div>
            )}
          </div>
        </div>

        {phase === "camera" && cameras.length > 1 ? (
          <label className="flex flex-col gap-1.5 text-sm font-medium">{t("issuances.new.photoCapture.camera")}
            <select value={cameraId || activeCameraId} onChange={(event) => setCameraId(event.target.value)} className="h-9 rounded-md border bg-background px-2 text-sm font-normal">
              {cameras.map((camera, index) => <option key={camera.deviceId} value={camera.deviceId}>{camera.label || t("issuances.new.photoCapture.cameraN", { number: index + 1 })}</option>)}
            </select>
          </label>
        ) : null}

        <DialogFooter className="gap-2 sm:justify-between">
          {phase === "camera" ? <>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>{t("issuances.new.photoCapture.cancel")}</Button>
            {cameraError ? <Button type="button" onClick={() => setAttempt((count) => count + 1)}><RefreshCw className="size-4" aria-hidden="true" />{t("issuances.new.photoCapture.tryAgain")}</Button> : <Button type="button" onClick={() => void takePhoto()} disabled={!cameraReady}><Camera className="size-4" aria-hidden="true" />{t("issuances.new.photoCapture.take")}</Button>}
          </> : <span className="text-sm text-muted-foreground">{t("issuances.new.photoCapture.applying")}</span>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
