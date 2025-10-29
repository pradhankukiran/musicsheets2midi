"use client"

import { useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState, forwardRef } from "react"
import JSZip from "jszip"
import { Button } from "@/components/ui/button"

declare global {
  interface Window {
    opensheetmusicdisplay?: {
      OpenSheetMusicDisplay: any
    }
  }
}

type ScoreViewerProps = {
  musicXmlBase64: string
  audioUrl?: string
  showControls?: boolean
  onPlaybackStateChange?: (isPlaying: boolean, canPlay: boolean, isInitializing: boolean) => void
}

export type ScoreViewerRef = {
  play: () => void
  stop: () => void
  isPlaying: boolean
  canPlay: boolean
  isInitializing: boolean
}

const OSMD_SCRIPT_SRC =
  "https://unpkg.com/opensheetmusicdisplay@1.8.9/build/opensheetmusicdisplay.min.js"

export const ScoreViewer = forwardRef<ScoreViewerRef, ScoreViewerProps>(
  function ScoreViewer({ musicXmlBase64, audioUrl, showControls = true, onPlaybackStateChange }, ref) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const audioElementRef = useRef<HTMLAudioElement | null>(null)
  const osmdRef = useRef<any>(null)
  const rafRef = useRef<number>()
  const totalStepsRef = useRef<number>(0)
  const currentStepRef = useRef<number>(0)

  const [isInitializing, setIsInitializing] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const [audioReady, setAudioReady] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string>("")

  const ensureOsmdLoaded = useCallback(async () => {
    if (typeof window === "undefined") return null
    if (window.opensheetmusicdisplay?.OpenSheetMusicDisplay) {
      return window.opensheetmusicdisplay.OpenSheetMusicDisplay
    }

    return new Promise<any>((resolve, reject) => {
      const existing = document.querySelector<HTMLScriptElement>('script[data-osmd="true"]')
      if (existing) {
        existing.addEventListener("load", () => {
          if (window.opensheetmusicdisplay?.OpenSheetMusicDisplay) {
            resolve(window.opensheetmusicdisplay.OpenSheetMusicDisplay)
          } else {
            reject(new Error("Failed to load OpenSheetMusicDisplay"))
          }
        })
        existing.addEventListener("error", () => reject(new Error("Failed to load OpenSheetMusicDisplay")))
        return
      }

      const script = document.createElement("script")
      script.src = OSMD_SCRIPT_SRC
      script.async = true
      script.dataset.osmd = "true"
      script.onload = () => {
        if (window.opensheetmusicdisplay?.OpenSheetMusicDisplay) {
          resolve(window.opensheetmusicdisplay.OpenSheetMusicDisplay)
        } else {
          reject(new Error("Failed to load OpenSheetMusicDisplay"))
        }
      }
      script.onerror = () => reject(new Error("Failed to load OpenSheetMusicDisplay"))
      document.body.appendChild(script)
    })
  }, [])

  const base64ToUint8Array = useCallback((raw: string) => {
    const base64 = raw.includes(",") ? raw.split(",").pop() ?? "" : raw
    const normalized = base64.replace(/\s/g, "")
    const binaryString = atob(normalized)
    const bytes = new Uint8Array(binaryString.length)
    for (let i = 0; i < binaryString.length; i += 1) {
      bytes[i] = binaryString.charCodeAt(i)
    }
    return bytes
  }, [])

  const advanceCursorToStep = useCallback((targetStep: number) => {
    const osmd = osmdRef.current
    if (!osmd?.cursor) {
      console.log("advanceCursorToStep: no cursor available")
      return
    }

    const cursor = osmd.cursor
    if (targetStep <= 0) {
      cursor.reset()
      cursor.show()
      currentStepRef.current = 0
      return
    }

    if (targetStep < currentStepRef.current) {
      cursor.reset()
      cursor.show()
      currentStepRef.current = 0
    }

    while (currentStepRef.current < targetStep && !cursor.iterator.EndReached) {
      cursor.next()
      currentStepRef.current += 1
    }

    cursor.show()

    // Ensure cursor stays visible on top with proper dimensions
    if (cursor.cursorElement) {
      cursor.cursorElement.style.zIndex = "1000"
      cursor.cursorElement.style.height = "90px"
      cursor.cursorElement.style.width = "3px"
      cursor.cursorElement.style.backgroundColor = "rgba(221, 84, 0, 0.85)"
    }
  }, [])

  const stopPlayback = useCallback(
    (resetAudio: boolean) => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = undefined
      }

      if (resetAudio && audioElementRef.current) {
        audioElementRef.current.pause()
        audioElementRef.current.currentTime = 0
      }

      advanceCursorToStep(0)
      setIsPlaying(false)
    },
    [advanceCursorToStep]
  )

  const calculateCursorSteps = useCallback(() => {
    const osmd = osmdRef.current
    if (!osmd?.cursor) return 0

    const cursor = osmd.cursor
    cursor.reset()
    cursor.show()

    let steps = 1
    while (!cursor.iterator.EndReached) {
      cursor.next()
      steps += 1
    }

    cursor.reset()
    cursor.show()

    // Ensure cursor is visible after calculation
    if (cursor.cursorElement) {
      cursor.cursorElement.style.height = "90px"
      cursor.cursorElement.style.width = "3px"
      cursor.cursorElement.style.backgroundColor = "rgba(221, 84, 0, 0.85)"
    }

    console.log("Total cursor steps calculated:", steps)
    return steps
  }, [])

  useEffect(() => {
    let alive = true

    const initializeScore = async () => {
      if (!containerRef.current || !musicXmlBase64) return

      try {
        setIsInitializing(true)
        setErrorMessage("")

        const OpenSheetMusicDisplay = await ensureOsmdLoaded()
        if (!OpenSheetMusicDisplay || !alive) return

        // Clear the container and create a fresh OSMD instance
        if (containerRef.current) {
          containerRef.current.innerHTML = ""
        }

        osmdRef.current = new OpenSheetMusicDisplay(containerRef.current, {
          drawTitle: false,
          drawCursor: true,
          autoResize: true,
          drawingParameters: "compact",
          backend: "svg",
          cursorsOptions: [{
            type: 0,
            color: "#dd5400",
            alpha: 0.85,
            follow: true,
          }],
        })

        const xmlBytes = base64ToUint8Array(musicXmlBase64)
        let resource: string

        const isZip = xmlBytes[0] === 0x50 && xmlBytes[1] === 0x4b
        if (isZip) {
          const zip = await JSZip.loadAsync(xmlBytes)
          const entryName =
            Object.keys(zip.files).find((name) =>
              name.toLowerCase().match(/(\.xml|\.musicxml)$/)
            ) ?? null

          if (!entryName) {
            throw new Error("MusicXML archive did not contain an XML file.")
          }

          resource = await zip.file(entryName)!.async("string")
        } else {
          // Convert ArrayBuffer to string for plain XML
          const decoder = new TextDecoder("utf-8")
          resource = decoder.decode(xmlBytes)
        }

        await osmdRef.current.load(resource)

        // Set cursor options before rendering
        osmdRef.current.setOptions({
          drawCursor: true,
        })

        await osmdRef.current.render()

        // Initialize and show cursor
        if (osmdRef.current.cursor) {
          console.log("Cursor exists:", osmdRef.current.cursor)

          // Update cursor color settings before showing
          osmdRef.current.cursor.cursorOptions = {
            type: 0,
            color: "#dd5400",
            alpha: 0.85,
            follow: true,
          }

          // Hide and re-show to regenerate cursor with new color
          osmdRef.current.cursor.hide()
          osmdRef.current.cursor.reset()
          osmdRef.current.cursor.show()

          // Force cursor element styling
          const cursorElement = osmdRef.current.cursor.cursorElement
          if (cursorElement) {
            console.log("Cursor element before styling:", {
              src: cursorElement.src,
              width: cursorElement.width,
              height: cursorElement.height,
              style: cursorElement.style.cssText,
              display: window.getComputedStyle(cursorElement).display,
              visibility: window.getComputedStyle(cursorElement).visibility,
              opacity: window.getComputedStyle(cursorElement).opacity,
            })

            cursorElement.style.zIndex = "1000"
            cursorElement.style.position = "absolute"
            cursorElement.style.pointerEvents = "none"
            cursorElement.style.display = "block"
            cursorElement.style.visibility = "visible"
            cursorElement.style.opacity = "0.85"

            // Replace the image with a colored div
            cursorElement.style.backgroundColor = "rgba(221, 84, 0, 0.85)"
            cursorElement.style.width = "3px"
            cursorElement.style.height = "90px"
            // Hide the original image to show background color
            cursorElement.style.content = ""
            cursorElement.removeAttribute("src")

            console.log("Cursor element after styling:", {
              style: cursorElement.style.cssText,
              offsetWidth: cursorElement.offsetWidth,
              offsetHeight: cursorElement.offsetHeight,
              offsetTop: cursorElement.offsetTop,
              offsetLeft: cursorElement.offsetLeft,
            })
          }

          console.log("Cursor shown, hidden state:", osmdRef.current.cursor.hidden)
        } else {
          console.log("No cursor found on OSMD instance")
        }

        totalStepsRef.current = calculateCursorSteps()
        currentStepRef.current = 0
      } catch (error) {
        console.error("Failed to initialize OSMD:", error)
        setErrorMessage(
          error instanceof Error ? error.message : "Failed to load sheet music."
        )
      } finally {
        if (alive) {
          setIsInitializing(false)
        }
      }
    }

    initializeScore()

    return () => {
      alive = false
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = undefined
      }
    }
  }, [musicXmlBase64, ensureOsmdLoaded, base64ToUint8Array, calculateCursorSteps])

  useEffect(() => {
    const audio = audioElementRef.current
    if (!audio) return

    const handleMetadata = () => setAudioReady(true)
    const handleEnded = () => stopPlayback(false)

    audio.addEventListener("loadedmetadata", handleMetadata)
    audio.addEventListener("ended", handleEnded)

    return () => {
      audio.removeEventListener("loadedmetadata", handleMetadata)
      audio.removeEventListener("ended", handleEnded)
    }
  }, [audioUrl, stopPlayback])

  useEffect(() => {
    if (!audioUrl) {
      setAudioReady(false)
      stopPlayback(true)
    } else {
      setAudioReady(false)
    }
  }, [audioUrl, stopPlayback])

  const tick = useCallback(() => {
    const audio = audioElementRef.current
    const osmd = osmdRef.current
    if (!audio || !osmd?.cursor) {
      rafRef.current = requestAnimationFrame(tick)
      return
    }

    if (audio.paused) {
      stopPlayback(false)
      return
    }

    const duration = audio.duration || 0
    const totalSteps = Math.max(totalStepsRef.current, 1)

    if (duration > 0) {
      const fraction = Math.min(audio.currentTime / duration, 1)
      const targetStep = Math.floor(fraction * (totalSteps - 1))
      if (targetStep !== currentStepRef.current) {
        console.log(`Moving cursor to step ${targetStep} of ${totalSteps}`)
        advanceCursorToStep(targetStep)
      }
    } else {
      advanceCursorToStep(currentStepRef.current + 1)
    }

    rafRef.current = requestAnimationFrame(tick)
  }, [advanceCursorToStep, stopPlayback])

  const handlePlay = async () => {
    if (!audioUrl || !audioReady || !audioElementRef.current || !osmdRef.current?.cursor) {
      return
    }

    try {
      advanceCursorToStep(0)
      audioElementRef.current.currentTime = 0
      await audioElementRef.current.play()
      setIsPlaying(true)
      rafRef.current = requestAnimationFrame(tick)
    } catch (error) {
      console.error("Failed to start playback:", error)
    }
  }

  const disablePlay = useMemo(() => {
    return !audioUrl || !audioReady || isInitializing
  }, [audioUrl, audioReady, isInitializing])

  useImperativeHandle(ref, () => ({
    play: handlePlay,
    stop: () => stopPlayback(true),
    isPlaying,
    canPlay: !disablePlay,
    isInitializing,
  }), [handlePlay, stopPlayback, isPlaying, disablePlay, isInitializing])

  useEffect(() => {
    onPlaybackStateChange?.(isPlaying, !disablePlay, isInitializing)
  }, [isPlaying, disablePlay, isInitializing, onPlaybackStateChange])

  return (
    <div className="space-y-4">
      <div
        ref={containerRef}
        className="w-full overflow-auto rounded-md border border-primary/20 bg-card/60 p-4"
        style={{ minHeight: "260px" }}
      />

      {errorMessage && (
        <p className="text-sm text-destructive text-center">
          {errorMessage}
        </p>
      )}

      {showControls && (
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <Button onClick={handlePlay} disabled={disablePlay || isPlaying}>
            {isInitializing ? "Loading score..." : isPlaying ? "Playing..." : "Play"}
          </Button>
          {audioUrl && (
            <audio
              ref={audioElementRef}
              src={audioUrl}
              controls
              className="w-full md:w-auto"
              preload="metadata"
            />
          )}
        </div>
      )}

      {!showControls && audioUrl && (
        <audio
          ref={audioElementRef}
          src={audioUrl}
          controls
          className="hidden"
          preload="metadata"
        />
      )}
    </div>
  )
})
