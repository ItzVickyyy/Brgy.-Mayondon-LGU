import { Minus, Plus, RotateCcw } from "lucide-react"
import {
  type KeyboardEvent,
  type PointerEvent,
  useEffect,
  useRef,
  useState,
} from "react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  canvasToPhotoUrl,
  PHOTO_HEIGHT,
  PHOTO_WIDTH,
} from "@/lib/photo-background"

const MAX_ZOOM = 3
const STEP = 0.25
const KEY_PAN = 0.03

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** The photo as a picture address that can be drawn (a data or blob address). */
  src: string
  /** Called with the adjusted photo when the person applies a change. */
  onApply: (photoUrl: string) => void
}

type View = { zoom: number; x: number; y: number } // x and y: shift as a fraction of the frame

const START: View = { zoom: 1, x: 0, y: 0 }
const clamp = (value: number, low: number, high: number) =>
  Math.min(high, Math.max(low, value))
/** The photo always covers the frame, so the shift is limited by the zoom. */
const fit = (view: View): View => {
  const room = (view.zoom - 1) / 2
  return {
    zoom: view.zoom,
    x: clamp(view.x, -room, room),
    y: clamp(view.y, -room, room),
  }
}

/**
 * Click the photo to see it large. Zoom with the slider or the buttons, drag to move it.
 * The bright square is the part that prints (the photo boxes on the forms are square; the picture is
 * portrait and is centred in them), so the face can be placed inside it. Apply saves the adjusted picture.
 */
export function PhotoViewer({ open, onOpenChange, src, onApply }: Props) {
  const { t } = useTranslation()
  const [view, setView] = useState<View>(START)
  const drag = useRef<{
    pointer: number
    x: number
    y: number
    start: View
  } | null>(null)
  const frame = useRef<HTMLDivElement>(null)
  const changed = view.zoom !== 1 || view.x !== 0 || view.y !== 0

  useEffect(() => {
    if (open) setView(START)
  }, [open])

  function zoomTo(zoom: number) {
    setView((current) => fit({ ...current, zoom: clamp(zoom, 1, MAX_ZOOM) }))
  }

  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    event.currentTarget.setPointerCapture(event.pointerId)
    drag.current = {
      pointer: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      start: view,
    }
  }

  function onPointerMove(event: PointerEvent<HTMLDivElement>) {
    const state = drag.current
    const box = frame.current?.getBoundingClientRect()
    if (!state || state.pointer !== event.pointerId || !box) return
    setView(
      fit({
        zoom: state.start.zoom,
        x: state.start.x + (event.clientX - state.x) / box.width,
        y: state.start.y + (event.clientY - state.y) / box.height,
      }),
    )
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [-KEY_PAN, 0],
      ArrowRight: [KEY_PAN, 0],
      ArrowUp: [0, -KEY_PAN],
      ArrowDown: [0, KEY_PAN],
    }
    const move = moves[event.key]
    if (move) {
      event.preventDefault()
      setView((current) =>
        fit({ ...current, x: current.x + move[0], y: current.y + move[1] }),
      )
    } else if (event.key === "+" || event.key === "=") zoomTo(view.zoom + STEP)
    else if (event.key === "-") zoomTo(view.zoom - STEP)
  }

  async function apply() {
    try {
      const image = new Image()
      image.src = src
      await image.decode()
      const canvas = document.createElement("canvas")
      canvas.width = PHOTO_WIDTH
      canvas.height = PHOTO_HEIGHT
      const context = canvas.getContext("2d")
      if (!context) return
      const transparent = src.startsWith("data:image/png")
      if (!transparent) {
        context.fillStyle = "#fff"
        context.fillRect(0, 0, PHOTO_WIDTH, PHOTO_HEIGHT)
      }
      const width = PHOTO_WIDTH * view.zoom
      const height = PHOTO_HEIGHT * view.zoom
      context.drawImage(
        image,
        (PHOTO_WIDTH - width) / 2 + view.x * PHOTO_WIDTH,
        (PHOTO_HEIGHT - height) / 2 + view.y * PHOTO_HEIGHT,
        width,
        height,
      )
      onApply(canvasToPhotoUrl(canvas, transparent))
      onOpenChange(false)
    } catch {
      onOpenChange(false)
    }
  }

  // The square that prints, centred in the portrait frame: its height is the frame width.
  const guideTop = ((PHOTO_HEIGHT - PHOTO_WIDTH) / 2 / PHOTO_HEIGHT) * 100
  const guideHeight = (PHOTO_WIDTH / PHOTO_HEIGHT) * 100

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-h-[94vh] overflow-y-auto sm:max-w-md"
        data-testid="photo-viewer"
      >
        <DialogHeader>
          <DialogTitle>{t("issuances.new.photoViewer.title")}</DialogTitle>
          <DialogDescription>
            {t("issuances.new.photoViewer.description")}
          </DialogDescription>
        </DialogHeader>

        <div
          ref={frame}
          role="application"
          // biome-ignore lint/a11y/noNoninteractiveTabindex: the frame moves with the arrow keys and zooms with plus and minus
          tabIndex={0}
          aria-label={t("issuances.new.photoViewer.frameLabel")}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={() => {
            drag.current = null
          }}
          onPointerCancel={() => {
            drag.current = null
          }}
          onKeyDown={onKeyDown}
          className="relative mx-auto w-full max-w-[min(360px,50vh)] cursor-grab touch-none select-none overflow-hidden rounded-md border bg-white outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 active:cursor-grabbing"
          style={{ aspectRatio: `${PHOTO_WIDTH} / ${PHOTO_HEIGHT}` }}
        >
          <img
            src={src}
            alt={t("issuances.new.photoCapture.alt")}
            draggable={false}
            className="pointer-events-none size-full object-cover"
            style={{
              transform: `translate(${view.x * 100}%, ${view.y * 100}%) scale(${view.zoom})`,
            }}
          />
          {/* Dim everything that will not print. */}
          <div
            className="pointer-events-none absolute inset-x-0 top-0 bg-black/45"
            style={{ height: `${guideTop}%` }}
            aria-hidden="true"
          />
          <div
            className="pointer-events-none absolute inset-x-0 bottom-0 bg-black/45"
            style={{ height: `${guideTop}%` }}
            aria-hidden="true"
          />
          <div
            className="pointer-events-none absolute inset-x-0 border-y-2 border-dashed border-white/90"
            style={{ top: `${guideTop}%`, height: `${guideHeight}%` }}
            aria-hidden="true"
          />
        </div>

        <div className="mx-auto flex w-full max-w-[360px] items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label={t("issuances.new.photoViewer.zoomOut")}
            disabled={view.zoom <= 1}
            onClick={() => zoomTo(view.zoom - STEP)}
          >
            <Minus aria-hidden="true" />
          </Button>
          <input
            type="range"
            min={1}
            max={MAX_ZOOM}
            step={0.05}
            value={view.zoom}
            onChange={(event) => zoomTo(Number(event.target.value))}
            aria-label={t("issuances.new.photoViewer.zoom")}
            className="h-11 min-w-0 flex-1 accent-primary"
          />
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label={t("issuances.new.photoViewer.zoomIn")}
            disabled={view.zoom >= MAX_ZOOM}
            onClick={() => zoomTo(view.zoom + STEP)}
          >
            <Plus aria-hidden="true" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={t("issuances.new.photoViewer.reset")}
            disabled={!changed}
            onClick={() => setView(START)}
          >
            <RotateCcw aria-hidden="true" />
          </Button>
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
          >
            {changed
              ? t("issuances.new.photoViewer.cancel")
              : t("issuances.new.photoViewer.close")}
          </Button>
          <Button
            type="button"
            disabled={!changed}
            onClick={() => void apply()}
          >
            {t("issuances.new.photoViewer.apply")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
