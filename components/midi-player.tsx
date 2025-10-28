"use client"

import { useEffect, useRef, useState } from "react"
import * as Tone from "tone"
import { Midi } from "@tonejs/midi"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import { Play, Pause, Square, SkipBack } from "lucide-react"

interface MidiPlayerProps {
  midiBase64: string
}

export function MidiPlayer({ midiBase64 }: MidiPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [duration, setDuration] = useState(0)
  const [tempo, setTempo] = useState(100)

  const synthsRef = useRef<Tone.PolySynth[]>([])
  const partsRef = useRef<Tone.Part[]>([])
  const midiDataRef = useRef<Midi | null>(null)
  const animationFrameRef = useRef<number>()

  useEffect(() => {
    return () => {
      cleanup()
    }
  }, [])

  useEffect(() => {
    if (midiBase64) {
      loadMidi()
    }
  }, [midiBase64])

  const cleanup = () => {
    partsRef.current.forEach(part => part.dispose())
    synthsRef.current.forEach(synth => synth.dispose())
    partsRef.current = []
    synthsRef.current = []
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
    }
  }

  const loadMidi = async () => {
    try {
      setIsLoading(true)
      cleanup()

      const binary = atob(midiBase64)
      const bytes = new Uint8Array(binary.length)
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i)
      }

      const midi = new Midi(bytes)
      midiDataRef.current = midi
      setDuration(midi.duration)

      midi.tracks.forEach((track) => {
        const synth = new Tone.PolySynth(Tone.Synth, {
          envelope: {
            attack: 0.02,
            decay: 0.1,
            sustain: 0.3,
            release: 1,
          },
        }).toDestination()

        synthsRef.current.push(synth)

        const notes = track.notes.map((note) => ({
          time: note.time,
          note: note.name,
          duration: note.duration,
          velocity: note.velocity,
        }))

        const part = new Tone.Part((time, note) => {
          synth.triggerAttackRelease(
            note.note,
            note.duration,
            time,
            note.velocity
          )
        }, notes)

        partsRef.current.push(part)
      })

      setIsLoading(false)
    } catch (error) {
      console.error("Error loading MIDI:", error)
      setIsLoading(false)
    }
  }

  const updateProgress = () => {
    const currentTime = Tone.getTransport().seconds
    setProgress(currentTime)

    if (currentTime >= duration) {
      handleStop()
    } else if (Tone.getTransport().state === "started") {
      animationFrameRef.current = requestAnimationFrame(updateProgress)
    }
  }

  const handlePlay = async () => {
    if (partsRef.current.length === 0) return

    await Tone.start()

    partsRef.current.forEach(part => part.start(0))
    Tone.getTransport().start()
    setIsPlaying(true)
    animationFrameRef.current = requestAnimationFrame(updateProgress)
  }

  const handlePause = () => {
    Tone.getTransport().pause()
    setIsPlaying(false)
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
    }
  }

  const handleStop = () => {
    Tone.getTransport().stop()
    partsRef.current.forEach(part => part.stop())
    setIsPlaying(false)
    setProgress(0)
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
    }
  }

  const handleRestart = () => {
    handleStop()
    setTimeout(() => handlePlay(), 100)
  }

  const handleTempoChange = (value: number[]) => {
    const newTempo = value[0]
    setTempo(newTempo)
    Tone.getTransport().bpm.value = (midiDataRef.current?.header.tempos[0]?.bpm || 120) * (newTempo / 100)
  }

  const handleProgressChange = (value: number[]) => {
    const newTime = value[0]
    Tone.getTransport().seconds = newTime
    setProgress(newTime)
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, "0")}`
  }

  if (!midiBase64) {
    return null
  }

  return (
    <div className="w-full space-y-4 p-3 md:p-4 border rounded-lg bg-card">
      <div className="space-y-3">
        {/* Buttons Row */}
        <div className="flex items-center justify-center gap-2">
          <Button
            size="icon"
            variant="outline"
            onClick={handleRestart}
            disabled={isLoading}
          >
            <SkipBack className="h-4 w-4" />
          </Button>

          {!isPlaying ? (
            <Button
              size="icon"
              onClick={handlePlay}
              disabled={isLoading}
            >
              <Play className="h-4 w-4" />
            </Button>
          ) : (
            <Button
              size="icon"
              variant="outline"
              onClick={handlePause}
            >
              <Pause className="h-4 w-4" />
            </Button>
          )}

          <Button
            size="icon"
            variant="outline"
            onClick={handleStop}
            disabled={isLoading}
          >
            <Square className="h-4 w-4" />
          </Button>
        </div>

        {/* Seekbar Row */}
        <div className="space-y-2">
          <Slider
            value={[progress]}
            max={duration || 100}
            step={0.1}
            onValueChange={handleProgressChange}
            disabled={isLoading}
            className="cursor-pointer"
          />
          <div className="text-xs md:text-sm text-muted-foreground text-center">
            {formatTime(progress)} / {formatTime(duration)}
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Tempo</span>
          <span className="text-sm font-medium">{tempo}%</span>
        </div>
        <Slider
          value={[tempo]}
          min={25}
          max={200}
          step={5}
          onValueChange={handleTempoChange}
          disabled={isLoading}
        />
      </div>

      {isLoading && (
        <div className="text-sm text-muted-foreground text-center">
          Loading MIDI...
        </div>
      )}
    </div>
  )
}
