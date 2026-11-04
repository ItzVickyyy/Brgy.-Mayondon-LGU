import { useCallback, useEffect, useRef, useState } from "react"
import { Camera, CircleAlert, ImageOff, LoaderCircle, RefreshCw, UserRound } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { canvasToPhotoUrl, cropToPortrait, PHOTO_HEIGHT, PHOTO_WIDTH, removeBackground } from "@/lib/photo-background"

type Phase = "camera" | "working" | "review"

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
      </div>
      <PhotoCaptureDialog open={open} onOpenChange={setOpen} onUse={(photoUrl, usedOriginal = false) => { onChange(photoUrl); setFallbackNotice(usedOriginal); setOpen(false) }} />
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

function PhotoCaptureDialog({ open, onOpenChange, onUse }: { open: boolean; onOpenChange: (open: boolean) => void; onUse: (photoUrl: string, usedOriginal?: boolean) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [phase, setPhase] = useState<Phase>("camera")
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([])
  const [cameraId, setCameraId] = useState("")
  const [activeCameraId, setActiveCameraId] = useState("")
  const [attempt, setAttempt] = useState(0)
  const [cameraReady, setCameraReady] = useState(false)
  const [cameraError, setCameraError] = useState("")
  const [removalError, setRemovalError] = useState("")
  const [cutout, setCutout] = useState<string>("")
  const [original, setOriginal] = useState<string>("")

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
    setCutout("")
    setOriginal("")
    setRemovalError("")
  }, [open])

  async function takePhoto() {
    const video = videoRef.current
    if (!video?.videoWidth) return
    const portrait = cropToPortrait(video)
    stopCamera()
    const originalUrl = canvasToPhotoUrl(portrait, false)
    setOriginal(originalUrl)
    setRemovalError("")
    setPhase("working")
    try {
      const removed = await removeBackground(portrait)
      const cutoutUrl = canvasToPhotoUrl(removed, true)
      setCutout(cutoutUrl)
      onUse(cutoutUrl, false)
    } catch (error) {
      setCutout("")
      setRemovalError(error instanceof Error ? error.message : "The background could not be removed.")
      onUse(originalUrl, true)
    }
    setPhase("review")
  }

  function retake() {
    setCutout("")
    setOriginal("")
    setRemovalError("")
    setUseOriginal(false)
    setPhase("camera")
  }

  const chosen = cutout || original

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-md" onInteractOutside={(event) => event.preventDefault()}>
        <DialogHeader>
          <DialogTitle>Take a photo</DialogTitle>
          <DialogDescription>
            {phase === "camera" ? "Ask the resident to face the camera with the head and shoulders inside the frame." : phase === "working" ? "Removing the background. This stays on this computer." : "The photo is applied automatically when processing finishes."}
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
            ) : phase === "working" ? (
              <div className="relative size-full">
                {original ? <img src={original} alt="" className="size-full object-cover opacity-40" /> : null}
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-sm text-white" role="status"><LoaderCircle className="size-6 animate-spin" aria-hidden="true" />Removing background…<span className="px-6 text-center text-xs text-white/80">The first photo of the day can take a few seconds.</span></div>
              </div>
            ) : (
              <div className="size-full bg-white">{chosen ? <img src={chosen} alt="Preview, head and shoulders" className="size-full object-cover" /> : null}</div>
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

        {phase === "review" && removalError ? <p role="status" className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/5 px-3 py-2 text-sm"><CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />{removalError} The original photo was applied. You can retake it if needed.</p> : null}

        <DialogFooter className="gap-2 sm:justify-between">
          {phase === "camera" ? <>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            {cameraError ? <Button type="button" onClick={() => setAttempt((count) => count + 1)}><RefreshCw className="size-4" aria-hidden="true" />Try again</Button> : <Button type="button" onClick={() => void takePhoto()} disabled={!cameraReady}><Camera className="size-4" aria-hidden="true" />Take photo</Button>}
          </> : phase === "working" ? <span className="text-sm text-muted-foreground">Applying photo…</span> : <Button type="button" variant="outline" onClick={retake}><RefreshCw className="size-4" aria-hidden="true" />Retake</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
