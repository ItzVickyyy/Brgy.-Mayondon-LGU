import { useCallback, useEffect, useRef, useState } from "react"
import { Camera, ImageOff, LoaderCircle, RefreshCw, UserRound } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { canvasToPhotoUrl, cropToPortrait, PHOTO_HEIGHT, PHOTO_WIDTH, removeBackground } from "@/lib/photo-background"

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

/** A photo box with a button that opens the camera. Used where a document needs the resident's picture. */
export function PhotoCapture({ id, value, onChange }: PhotoCaptureProps) {
  const [open, setOpen] = useState(false)
  const [fallbackNotice, setFallbackNotice] = useState(false)
  const [photoVersions, setPhotoVersions] = useState<PhotoVersions | null>(null)
  const [keepOriginal, setKeepOriginal] = useState(false)
  const lastManagedValue = useRef(value)

  useEffect(() => {
    if (value === lastManagedValue.current) return
    lastManagedValue.current = value
    setPhotoVersions(null)
    setKeepOriginal(false)
    setFallbackNotice(false)
  }, [value])

  function applyPhoto(photoUrl: string) {
    lastManagedValue.current = photoUrl
    onChange(photoUrl)
  }

  function handleUse({ cutout, original, removalFailed }: PhotoVersions & { removalFailed: boolean }) {
    setPhotoVersions({ cutout, original })
    setKeepOriginal(false)
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

  return (
    <div className="flex items-center gap-4">
      <div className="flex h-28 w-[84px] shrink-0 items-center justify-center overflow-hidden rounded-md border bg-white">
        {value ? <img src={value} alt="Resident, head and shoulders" className="size-full object-cover" /> : <UserRound className="size-8 text-muted-foreground/50" aria-hidden="true" />}
      </div>
      <div className="flex min-w-0 flex-col items-start gap-1.5">
        <Button id={id} type="button" variant={value ? "outline" : "default"} onClick={() => setOpen(true)}>
          <Camera className="size-4" aria-hidden="true" />{value ? "Retake photo" : "Take photo"}
        </Button>
        <p className="text-xs text-muted-foreground">{fallbackNotice ? "Background could not be removed. Using the original photo." : value ? "Photo ready. Retake it if needed." : "Use the camera to capture the resident’s photo."}</p>
        {photoVersions?.cutout ? (
          <label className="flex min-h-11 cursor-pointer items-center gap-2 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={keepOriginal}
              onChange={(event) => handleKeepOriginal(event.target.checked)}
              className="size-4 shrink-0 accent-primary"
            />
            <span>The cut-out looks wrong. Keep the original background.</span>
          </label>
        ) : null}
      </div>
      <PhotoCaptureDialog open={open} onOpenChange={setOpen} onUse={handleUse} />
    </div>
  )
}

function cameraErrorMessage(error: unknown) {
  if (typeof window !== "undefined" && (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia)) {
    return "The camera only works when this system is opened on the same computer (localhost) or through a secure https address. Please ask the system administrator."
  }
  const name = error instanceof DOMException ? error.name : ""
  if (name === "NotAllowedError" || name === "SecurityError") return "The camera is blocked. Click the camera icon next to the web address, choose Allow, then try again."
  if (name === "NotFoundError" || name === "OverconstrainedError") return "No camera was found. Check that the camera is plugged in, then try again."
  if (name === "NotReadableError" || name === "AbortError") return "The camera is being used by another program. Close it, then try again."
  return "The camera could not be started. Please try again."
}

function PhotoCaptureDialog({ open, onOpenChange, onUse }: { open: boolean; onOpenChange: (open: boolean) => void; onUse: (photos: PhotoVersions & { removalFailed: boolean }) => void }) {
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
        if (!cancelled) setCameraError(cameraErrorMessage(error))
      }
    }
    void start()
    return () => { cancelled = true; stopCamera() }
  }, [open, phase, cameraId, attempt, stopCamera])

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
    const originalUrl = canvasToPhotoUrl(portrait, false)
    setPhase("working")
    try {
      const removed = await removeBackground(portrait)
      const cutoutUrl = canvasToPhotoUrl(removed, true)
      onUse({ cutout: cutoutUrl, original: originalUrl, removalFailed: false })
    } catch {
      onUse({ cutout: "", original: originalUrl, removalFailed: true })
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-md" onInteractOutside={(event) => event.preventDefault()}>
        <DialogHeader>
          <DialogTitle>Take a photo</DialogTitle>
          <DialogDescription>
            {phase === "camera" ? "Ask the resident to face the camera with the head and shoulders inside the frame." : "Removing the background. This stays on this computer."}
          </DialogDescription>
        </DialogHeader>

        <div className="mx-auto w-full max-w-[300px]">
          <div className="relative overflow-hidden rounded-md border bg-neutral-900" style={{ aspectRatio: `${PHOTO_WIDTH} / ${PHOTO_HEIGHT}` }}>
            {phase === "camera" ? (
              <>
                {/* Keep the preview in the same non-mirrored orientation as the captured image and printed photo. */}
                <video ref={videoRef} playsInline muted aria-label="Camera preview" className="size-full object-cover" />
                {cameraReady ? <div className="pointer-events-none absolute left-1/2 top-[10%] h-[54%] w-[58%] -translate-x-1/2 rounded-[50%] border-2 border-dashed border-white/70" aria-hidden="true" /> : null}
                {!cameraReady && !cameraError ? <div className="absolute inset-0 flex items-center justify-center gap-2 text-sm text-white" role="status"><LoaderCircle className="size-4 animate-spin" aria-hidden="true" />Starting the camera…</div> : null}
                {cameraError ? <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-4 text-center text-sm text-white"><ImageOff className="size-6" aria-hidden="true" />{cameraError}</div> : null}
              </>
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-sm text-white" role="status"><LoaderCircle className="size-6 animate-spin" aria-hidden="true" />Removing background…<span className="px-6 text-center text-xs text-white/80">The first photo of the day can take a few seconds.</span></div>
            )}
          </div>
        </div>

        {phase === "camera" && cameras.length > 1 ? (
          <label className="flex flex-col gap-1.5 text-sm font-medium">Camera
            <select value={cameraId || activeCameraId} onChange={(event) => setCameraId(event.target.value)} className="h-9 rounded-md border bg-background px-2 text-sm font-normal">
              {cameras.map((camera, index) => <option key={camera.deviceId} value={camera.deviceId}>{camera.label || `Camera ${index + 1}`}</option>)}
            </select>
          </label>
        ) : null}

        <DialogFooter className="gap-2 sm:justify-between">
          {phase === "camera" ? <>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            {cameraError ? <Button type="button" onClick={() => setAttempt((count) => count + 1)}><RefreshCw className="size-4" aria-hidden="true" />Try again</Button> : <Button type="button" onClick={() => void takePhoto()} disabled={!cameraReady}><Camera className="size-4" aria-hidden="true" />Take photo</Button>}
          </> : <span className="text-sm text-muted-foreground">Applying photo…</span>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
