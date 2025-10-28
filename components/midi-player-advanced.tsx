"use client"

import { useEffect, useRef, useState } from "react"
import * as Tone from "tone"
import { Midi } from "@tonejs/midi"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Play, Pause, Square, SkipBack, Volume2, Download, Music } from "lucide-react"

interface MidiPlayerProps {
  midiBase64: string
}

type InstrumentType =
  | "piano"
  | "synth"
  | "organ"
  | "bass"
  | "strings"
  | "brass"
  | "pluck"
  | "cello"
  | "violin"
  | "oud"
  | "guitar"
  | "harp"
  | "flute"
  | "trumpet"
  | "saxophone"
  | "bells"
  | "marimba"
  | "choir"
  | "pad"
  | "lead"

interface TrackState {
  volume: number
  pan: number
  muted: boolean
  solo: boolean
  instrument: InstrumentType
}

export function MidiPlayer({ midiBase64 }: MidiPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [duration, setDuration] = useState(0)
  const [tempo, setTempo] = useState(100)
  const [volume, setVolume] = useState(80)
  const [playbackRate, setPlaybackRate] = useState(100)
  const [pitchShift, setPitchShift] = useState(0)
  const [loopEnabled, setLoopEnabled] = useState(false)
  const [loopStart, setLoopStart] = useState(0)
  const [loopEnd, setLoopEnd] = useState(100)
  const [metronomeEnabled, setMetronomeEnabled] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [effectsReady, setEffectsReady] = useState(false)

  // Track controls
  const [trackStates, setTrackStates] = useState<TrackState[]>([])
  const trackStatesRef = useRef<TrackState[]>([])

  // Effects
  const [reverbMix, setReverbMix] = useState(0)
  const [delayMix, setDelayMix] = useState(0)
  const [chorusMix, setChorusMix] = useState(0)
  const [distortionAmount, setDistortionAmount] = useState(0)

  // EQ
  const [eqLow, setEqLow] = useState(0)
  const [eqMid, setEqMid] = useState(0)
  const [eqHigh, setEqHigh] = useState(0)

  // Filter
  const [filterFreq, setFilterFreq] = useState(20000)
  const [filterType, setFilterType] = useState<"lowpass" | "highpass">("lowpass")

  // Compressor
  const [compressorThreshold, setCompressorThreshold] = useState(-24)
  const [compressorRatio, setCompressorRatio] = useState(3)

  // Visualizer
  const [waveformData, setWaveformData] = useState<number[]>(new Array(256).fill(0))
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const visualizerFrameRef = useRef<number>()

  const synthsRef = useRef<{ synth: Tone.PolySynth; panner: Tone.Panner; volume: Tone.Volume }[]>([])
  const partsRef = useRef<Tone.Part[]>([])
  const midiDataRef = useRef<Midi | null>(null)
  const animationFrameRef = useRef<number>()

  // Effects nodes
  const masterVolumeRef = useRef<Tone.Volume | null>(null)
  const reverbRef = useRef<Tone.Reverb | null>(null)
  const delayRef = useRef<Tone.FeedbackDelay | null>(null)
  const chorusRef = useRef<Tone.Chorus | null>(null)
  const distortionRef = useRef<Tone.Distortion | null>(null)
  const eqRef = useRef<Tone.EQ3 | null>(null)
  const filterRef = useRef<Tone.Filter | null>(null)
  const compressorRef = useRef<Tone.Compressor | null>(null)
  const analyzerRef = useRef<Tone.Analyser | null>(null)
  const recorderRef = useRef<Tone.Recorder | null>(null)

  // Metronome
  const metronomeRef = useRef<Tone.MetalSynth | null>(null)
  const metronomePartRef = useRef<Tone.Part | null>(null)

  useEffect(() => {
    initializeEffects().then(() => setEffectsReady(true))
    return () => {
      cleanup()
    }
  }, [])

  useEffect(() => {
    trackStatesRef.current = trackStates
  }, [trackStates])

  useEffect(() => {
    if (midiBase64 && effectsReady) {
      loadMidi()
    }
  }, [midiBase64, effectsReady])

  useEffect(() => {
    if (!effectsReady) return

    const updateVisualizer = () => {
      if (analyzerRef.current) {
        const values = analyzerRef.current.getValue() as Float32Array
        setWaveformData(Array.from(values))
      }
      visualizerFrameRef.current = requestAnimationFrame(updateVisualizer)
    }

    updateVisualizer()

    return () => {
      if (visualizerFrameRef.current) {
        cancelAnimationFrame(visualizerFrameRef.current)
      }
    }
  }, [effectsReady])

  useEffect(() => {
    drawWaveform()
  }, [waveformData])

  const initializeEffects = async () => {
    // Master volume
    masterVolumeRef.current = new Tone.Volume(Tone.gainToDb(volume / 100)).toDestination()

    // Effects
    reverbRef.current = new Tone.Reverb({ decay: 2.5, wet: 0 })
    await reverbRef.current.generate()
    delayRef.current = new Tone.FeedbackDelay({ delayTime: "8n", wet: 0 })
    chorusRef.current = new Tone.Chorus({ frequency: 1.5, depth: 0.7, wet: 0 })
    distortionRef.current = new Tone.Distortion({ distortion: 0, wet: 0 })
    eqRef.current = new Tone.EQ3()
    filterRef.current = new Tone.Filter({ frequency: 20000, type: "lowpass" })
    compressorRef.current = new Tone.Compressor({ threshold: -24, ratio: 3 })
    analyzerRef.current = new Tone.Analyser("waveform", 256)
    recorderRef.current = new Tone.Recorder()

    // Chain effects
    reverbRef.current.connect(masterVolumeRef.current)
    delayRef.current.connect(reverbRef.current)
    chorusRef.current.connect(delayRef.current)
    distortionRef.current.connect(chorusRef.current)
    eqRef.current.connect(distortionRef.current)
    filterRef.current.connect(eqRef.current)
    compressorRef.current.connect(filterRef.current)

    // Analyzer splits the signal
    compressorRef.current.connect(analyzerRef.current)
    compressorRef.current.connect(recorderRef.current)

    // Metronome
    metronomeRef.current = new Tone.MetalSynth({
      frequency: 880,
      envelope: { attack: 0.001, decay: 0.1, release: 0.01 },
      harmonicity: 5.1,
      modulationIndex: 32,
      resonance: 4000,
      octaves: 1.5
    }).connect(masterVolumeRef.current)
  }

  const createInstrument = (type: InstrumentType): Tone.PolySynth => {
    switch (type) {
      case "piano":
        return new Tone.PolySynth(Tone.FMSynth, {
          harmonicity: 3,
          modulationIndex: 10,
          oscillator: { type: "triangle" },
          envelope: { attack: 0.002, decay: 0.3, sustain: 0.05, release: 1 },
          modulation: { type: "sine" },
          modulationEnvelope: { attack: 0.002, decay: 0.2, sustain: 0, release: 0.2 }
        })

      case "organ":
        return new Tone.PolySynth(Tone.FMSynth, {
          harmonicity: 2,
          modulationIndex: 2,
          oscillator: { type: "sine" },
          envelope: { attack: 0.02, decay: 0.3, sustain: 0.7, release: 0.3 },
          modulation: { type: "sine" },
          modulationEnvelope: { attack: 0.5, decay: 0.2, sustain: 0.6, release: 0.3 }
        })

      case "bass":
        return new Tone.PolySynth(Tone.FMSynth, {
          harmonicity: 1,
          modulationIndex: 5,
          oscillator: { type: "triangle" },
          envelope: { attack: 0.01, decay: 0.15, sustain: 0.4, release: 0.3 },
          modulation: { type: "sine" },
          modulationEnvelope: { attack: 0.01, decay: 0.1, sustain: 0.2, release: 0.2 }
        })

      case "strings":
        return new Tone.PolySynth(Tone.AMSynth, {
          harmonicity: 2.5,
          oscillator: { type: "sawtooth" },
          envelope: { attack: 0.2, decay: 0.3, sustain: 0.8, release: 1.2 },
          modulation: { type: "triangle" },
          modulationEnvelope: { attack: 0.3, decay: 0.2, sustain: 0.7, release: 1 }
        })

      case "cello":
        return new Tone.PolySynth(Tone.AMSynth, {
          harmonicity: 2,
          oscillator: { type: "sawtooth" },
          envelope: { attack: 0.15, decay: 0.4, sustain: 0.85, release: 1.5 },
          modulation: { type: "triangle" },
          modulationEnvelope: { attack: 0.2, decay: 0.3, sustain: 0.8, release: 1.2 }
        })

      case "violin":
        return new Tone.PolySynth(Tone.AMSynth, {
          harmonicity: 3,
          oscillator: { type: "sawtooth" },
          envelope: { attack: 0.08, decay: 0.2, sustain: 0.75, release: 0.9 },
          modulation: { type: "square" },
          modulationEnvelope: { attack: 0.1, decay: 0.2, sustain: 0.7, release: 0.8 }
        })

      case "oud":
        return new Tone.PolySynth(Tone.FMSynth, {
          harmonicity: 2.5,
          modulationIndex: 8,
          oscillator: { type: "triangle" },
          envelope: { attack: 0.005, decay: 0.4, sustain: 0.2, release: 1.8 },
          modulation: { type: "sine" },
          modulationEnvelope: { attack: 0.01, decay: 0.3, sustain: 0.1, release: 1.2 }
        })

      case "guitar":
        return new Tone.PolySynth(Tone.FMSynth, {
          harmonicity: 3,
          modulationIndex: 6,
          oscillator: { type: "triangle" },
          envelope: { attack: 0.003, decay: 0.3, sustain: 0.15, release: 1.2 },
          modulation: { type: "sine" },
          modulationEnvelope: { attack: 0.005, decay: 0.2, sustain: 0.1, release: 0.8 }
        })

      case "harp":
        return new Tone.PolySynth(Tone.FMSynth, {
          harmonicity: 4,
          modulationIndex: 10,
          oscillator: { type: "sine" },
          envelope: { attack: 0.001, decay: 0.5, sustain: 0, release: 1 },
          modulation: { type: "triangle" },
          modulationEnvelope: { attack: 0.001, decay: 0.4, sustain: 0, release: 0.8 }
        })

      case "brass":
        return new Tone.PolySynth(Tone.AMSynth, {
          harmonicity: 4,
          oscillator: { type: "square" },
          envelope: { attack: 0.04, decay: 0.3, sustain: 0.6, release: 0.4 },
          modulation: { type: "sawtooth" },
          modulationEnvelope: { attack: 0.05, decay: 0.2, sustain: 0.5, release: 0.3 }
        })

      case "trumpet":
        return new Tone.PolySynth(Tone.AMSynth, {
          harmonicity: 5,
          oscillator: { type: "square" },
          envelope: { attack: 0.015, decay: 0.25, sustain: 0.5, release: 0.4 },
          modulation: { type: "sawtooth" },
          modulationEnvelope: { attack: 0.02, decay: 0.15, sustain: 0.4, release: 0.3 }
        })

      case "saxophone":
        return new Tone.PolySynth(Tone.AMSynth, {
          harmonicity: 2,
          oscillator: { type: "triangle" },
          envelope: { attack: 0.03, decay: 0.3, sustain: 0.65, release: 0.5 },
          modulation: { type: "sawtooth" },
          modulationEnvelope: { attack: 0.04, decay: 0.25, sustain: 0.5, release: 0.4 }
        })

      case "flute":
        return new Tone.PolySynth(Tone.FMSynth, {
          harmonicity: 1.5,
          modulationIndex: 3,
          oscillator: { type: "sine" },
          envelope: { attack: 0.05, decay: 0.2, sustain: 0.6, release: 0.8 },
          modulation: { type: "sine" },
          modulationEnvelope: { attack: 0.06, decay: 0.15, sustain: 0.5, release: 0.7 }
        })

      case "bells":
        return new Tone.PolySynth(Tone.FMSynth, {
          harmonicity: 8,
          modulationIndex: 20,
          oscillator: { type: "sine" },
          envelope: { attack: 0.001, decay: 2.5, sustain: 0, release: 3 },
          modulation: { type: "sine" },
          modulationEnvelope: { attack: 0.001, decay: 2, sustain: 0, release: 2.5 }
        })

      case "marimba":
        return new Tone.PolySynth(Tone.FMSynth, {
          harmonicity: 3.2,
          modulationIndex: 18,
          oscillator: { type: "triangle" },
          envelope: { attack: 0.001, decay: 0.6, sustain: 0, release: 0.8 },
          modulation: { type: "sine" },
          modulationEnvelope: { attack: 0.001, decay: 0.5, sustain: 0, release: 0.6 }
        })

      case "choir":
        return new Tone.PolySynth(Tone.AMSynth, {
          harmonicity: 1.5,
          oscillator: { type: "sine" },
          envelope: { attack: 0.6, decay: 0.4, sustain: 0.8, release: 2 },
          modulation: { type: "triangle" },
          modulationEnvelope: { attack: 0.7, decay: 0.3, sustain: 0.7, release: 1.8 }
        })

      case "pad":
        return new Tone.PolySynth(Tone.AMSynth, {
          harmonicity: 2,
          oscillator: { type: "sawtooth" },
          envelope: { attack: 1, decay: 0.6, sustain: 0.85, release: 2.5 },
          modulation: { type: "triangle" },
          modulationEnvelope: { attack: 1.2, decay: 0.5, sustain: 0.8, release: 2.3 }
        })

      case "lead":
        return new Tone.PolySynth(Tone.AMSynth, {
          harmonicity: 3,
          oscillator: { type: "sawtooth" },
          envelope: { attack: 0.01, decay: 0.3, sustain: 0.5, release: 0.9 },
          modulation: { type: "square" },
          modulationEnvelope: { attack: 0.02, decay: 0.2, sustain: 0.4, release: 0.7 }
        })

      case "pluck":
        return new Tone.PolySynth(Tone.PluckSynth, {
          attackNoise: 1,
          dampening: 4000,
          resonance: 0.7
        })

      default:
        return new Tone.PolySynth(Tone.FMSynth, {
          harmonicity: 2,
          modulationIndex: 8,
          oscillator: { type: "triangle" },
          envelope: { attack: 0.01, decay: 0.2, sustain: 0.3, release: 0.8 },
          modulation: { type: "sine" },
          modulationEnvelope: { attack: 0.02, decay: 0.15, sustain: 0.2, release: 0.6 }
        })
    }
  }

  const cleanup = () => {
    partsRef.current.forEach(part => part.dispose())
    synthsRef.current.forEach(({ synth, panner, volume }) => {
      synth.dispose()
      panner.dispose()
      volume.dispose()
    })
    metronomePartRef.current?.dispose()

    partsRef.current = []
    synthsRef.current = []

    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
    }
    if (visualizerFrameRef.current) {
      cancelAnimationFrame(visualizerFrameRef.current)
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
      setLoopEnd(midi.duration)

      const newTrackStates: TrackState[] = []

      midi.tracks.forEach((track, idx) => {
        const trackState: TrackState = {
          volume: 80,
          pan: 0,
          muted: false,
          solo: false,
          instrument: "synth"
        }
        newTrackStates.push(trackState)

        const synth = createInstrument(trackState.instrument)
        const panner = new Tone.Panner(0)
        const volumeNode = new Tone.Volume(Tone.gainToDb(trackState.volume / 100))

        synth.chain(panner, volumeNode, compressorRef.current!)

        synthsRef.current.push({ synth, panner, volume: volumeNode })

        const notes = track.notes.map((note) => ({
          time: note.time,
          note: note.name,
          duration: note.duration,
          velocity: note.velocity,
        }))

        const part = new Tone.Part((time, note) => {
          const currentTrackState = trackStatesRef.current[idx]
          if (!currentTrackState?.muted) {
            const hasSolo = trackStatesRef.current.some(t => t.solo)
            if (!hasSolo || currentTrackState.solo) {
              synth.triggerAttackRelease(
                note.note,
                note.duration,
                time,
                note.velocity
              )
            }
          }
        }, notes)

        partsRef.current.push(part)
      })

      setTrackStates(newTrackStates)

      // Setup metronome
      if (midi.header.timeSignatures.length > 0) {
        const beatsPerMeasure = midi.header.timeSignatures[0].timeSignature[0]
        const measureLength = Tone.Time("1m").toSeconds()
        const beatLength = measureLength / beatsPerMeasure

        const metronomeNotes: { time: number; beat: number }[] = []
        const totalBeats = Math.ceil(midi.duration / beatLength)

        for (let i = 0; i < totalBeats; i++) {
          metronomeNotes.push({
            time: i * beatLength,
            beat: i % beatsPerMeasure
          })
        }

        metronomePartRef.current = new Tone.Part((time, note) => {
          if (metronomeEnabled) {
            metronomeRef.current!.frequency.value = note.beat === 0 ? 1200 : 880
            metronomeRef.current!.triggerAttackRelease("32n", time, 0.5)
          }
        }, metronomeNotes)
      }

      setIsLoading(false)
    } catch (error) {
      console.error("Error loading MIDI:", error)
      setIsLoading(false)
    }
  }

  const updateProgress = () => {
    const currentTime = Tone.getTransport().seconds
    setProgress(currentTime)

    if (loopEnabled && currentTime >= loopEnd) {
      Tone.getTransport().seconds = loopStart
    } else if (currentTime >= duration) {
      handleStop()
    } else if (Tone.getTransport().state === "started") {
      animationFrameRef.current = requestAnimationFrame(updateProgress)
    }
  }

  const handlePlay = async () => {
    if (partsRef.current.length === 0) return

    await Tone.start()

    partsRef.current.forEach(part => part.start(0))
    metronomePartRef.current?.start(0)
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
    metronomePartRef.current?.stop()
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

  const handleVolumeChange = (value: number[]) => {
    const newVolume = value[0]
    setVolume(newVolume)
    if (masterVolumeRef.current) {
      masterVolumeRef.current.volume.value = Tone.gainToDb(newVolume / 100)
    }
  }

  const handleTempoChange = (value: number[]) => {
    const newTempo = value[0]
    setTempo(newTempo)
    const baseBPM = midiDataRef.current?.header.tempos[0]?.bpm || 120
    Tone.getTransport().bpm.value = baseBPM * (newTempo / 100)
  }

  const handlePlaybackRateChange = (value: number[]) => {
    const newRate = value[0]
    setPlaybackRate(newRate)
    Tone.getTransport().playbackRate = newRate / 100
  }

  const handlePitchShiftChange = (value: number[]) => {
    const shift = value[0]
    setPitchShift(shift)

    synthsRef.current.forEach(({ synth }) => {
      synth.set({ detune: shift * 100 })
    })
  }

  const handleProgressChange = (value: number[]) => {
    const newTime = value[0]
    Tone.getTransport().seconds = newTime
    setProgress(newTime)
  }

  const handleTrackVolumeChange = (trackIdx: number, value: number[]) => {
    const newVolume = value[0]
    setTrackStates(prev => {
      const updated = [...prev]
      updated[trackIdx].volume = newVolume
      return updated
    })
    if (synthsRef.current[trackIdx]) {
      synthsRef.current[trackIdx].volume.volume.value = Tone.gainToDb(newVolume / 100)
    }
  }

  const handleTrackPanChange = (trackIdx: number, value: number[]) => {
    const newPan = value[0]
    setTrackStates(prev => {
      const updated = [...prev]
      updated[trackIdx].pan = newPan
      return updated
    })
    if (synthsRef.current[trackIdx]) {
      synthsRef.current[trackIdx].panner.pan.value = newPan / 100
    }
  }

  const handleTrackMute = (trackIdx: number) => {
    setTrackStates(prev => {
      const updated = [...prev]
      updated[trackIdx].muted = !updated[trackIdx].muted
      return updated
    })
  }

  const handleTrackSolo = (trackIdx: number) => {
    setTrackStates(prev => {
      const updated = [...prev]
      updated[trackIdx].solo = !updated[trackIdx].solo
      return updated
    })
  }

  const handleTrackInstrumentChange = (trackIdx: number, instrument: InstrumentType) => {
    setTrackStates(prev => {
      const updated = [...prev]
      updated[trackIdx].instrument = instrument
      return updated
    })

    const { panner, volume } = synthsRef.current[trackIdx]
    const oldSynth = synthsRef.current[trackIdx].synth
    oldSynth.dispose()

    const newSynth = createInstrument(instrument)
    newSynth.chain(panner, volume, compressorRef.current!)
    synthsRef.current[trackIdx].synth = newSynth

    // Recreate the part with the new synth
    const track = midiDataRef.current?.tracks[trackIdx]
    if (track) {
      const notes = track.notes.map((note) => ({
        time: note.time,
        note: note.name,
        duration: note.duration,
        velocity: note.velocity,
      }))

      partsRef.current[trackIdx].dispose()

      const part = new Tone.Part((time, note) => {
        const currentTrackState = trackStatesRef.current[trackIdx]
        if (!currentTrackState?.muted) {
          const hasSolo = trackStatesRef.current.some(t => t.solo)
          if (!hasSolo || currentTrackState.solo) {
            newSynth.triggerAttackRelease(
              note.note,
              note.duration,
              time,
              note.velocity
            )
          }
        }
      }, notes)

      partsRef.current[trackIdx] = part
      if (isPlaying) {
        part.start(0)
      }
    }
  }

  const handleReverbChange = (value: number[]) => {
    const mix = value[0]
    setReverbMix(mix)
    if (reverbRef.current) {
      reverbRef.current.wet.value = mix / 100
    }
  }

  const handleDelayChange = (value: number[]) => {
    const mix = value[0]
    setDelayMix(mix)
    if (delayRef.current) {
      delayRef.current.wet.value = mix / 100
    }
  }

  const handleChorusChange = (value: number[]) => {
    const mix = value[0]
    setChorusMix(mix)
    if (chorusRef.current) {
      chorusRef.current.wet.value = mix / 100
    }
  }

  const handleDistortionChange = (value: number[]) => {
    const amount = value[0]
    setDistortionAmount(amount)
    if (distortionRef.current) {
      distortionRef.current.distortion = amount / 100
      distortionRef.current.wet.value = amount / 100
    }
  }

  const handleEqLowChange = (value: number[]) => {
    const gain = value[0]
    setEqLow(gain)
    if (eqRef.current) {
      eqRef.current.low.value = gain
    }
  }

  const handleEqMidChange = (value: number[]) => {
    const gain = value[0]
    setEqMid(gain)
    if (eqRef.current) {
      eqRef.current.mid.value = gain
    }
  }

  const handleEqHighChange = (value: number[]) => {
    const gain = value[0]
    setEqHigh(gain)
    if (eqRef.current) {
      eqRef.current.high.value = gain
    }
  }

  const handleFilterFreqChange = (value: number[]) => {
    const freq = value[0]
    setFilterFreq(freq)
    if (filterRef.current) {
      filterRef.current.frequency.value = freq
    }
  }

  const handleFilterTypeChange = (type: "lowpass" | "highpass") => {
    setFilterType(type)
    if (filterRef.current) {
      filterRef.current.type = type
    }
  }

  const handleCompressorThresholdChange = (value: number[]) => {
    const threshold = value[0]
    setCompressorThreshold(threshold)
    if (compressorRef.current) {
      compressorRef.current.threshold.value = threshold
    }
  }

  const handleCompressorRatioChange = (value: number[]) => {
    const ratio = value[0]
    setCompressorRatio(ratio)
    if (compressorRef.current) {
      compressorRef.current.ratio.value = ratio
    }
  }

  const handleLoopStartChange = (value: number[]) => {
    const newStart = value[0]
    setLoopStart(newStart)
    if (newStart >= loopEnd) {
      setLoopEnd(Math.min(newStart + 1, duration))
    }
  }

  const handleLoopEndChange = (value: number[]) => {
    const newEnd = value[0]
    setLoopEnd(newEnd)
    if (newEnd <= loopStart) {
      setLoopStart(Math.max(0, newEnd - 1))
    }
  }

  const handleExportToWav = async () => {
    if (!recorderRef.current) return

    try {
      setIsRecording(true)

      await recorderRef.current.start()
      await handlePlay()

      // Wait for playback to finish (accounting for tempo and playback rate)
      const baseBPM = midiDataRef.current?.header.tempos[0]?.bpm || 120
      const currentBPM = baseBPM * (tempo / 100)
      const tempoAdjustment = baseBPM / currentBPM
      const rateAdjustment = 100 / playbackRate
      const recordingDuration = duration * 1000 * tempoAdjustment * rateAdjustment
      await new Promise(resolve => setTimeout(resolve, recordingDuration))

      const recording = await recorderRef.current.stop()
      const url = URL.createObjectURL(recording)
      const a = document.createElement("a")
      a.href = url
      a.download = "midi-playback.wav"
      a.click()
      URL.revokeObjectURL(url)

      handleStop()
      setIsRecording(false)
    } catch (error) {
      console.error("Error exporting to WAV:", error)
      setIsRecording(false)
    }
  }

  const drawWaveform = () => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const width = canvas.width
    const height = canvas.height

    // Clear canvas with dark background
    ctx.fillStyle = "#000000"
    ctx.fillRect(0, 0, width, height)

    // Draw center line
    ctx.strokeStyle = "rgba(128, 128, 128, 0.5)"
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(0, height / 2)
    ctx.lineTo(width, height / 2)
    ctx.stroke()

    // Draw waveform
    ctx.strokeStyle = "#00ff88"
    ctx.lineWidth = 2
    ctx.beginPath()

    const sliceWidth = width / waveformData.length

    for (let i = 0; i < waveformData.length; i++) {
      const value = waveformData[i]
      const x = (i / waveformData.length) * width

      // Map waveform value (-1 to 1) to canvas height
      const y = ((value + 1) / 2) * height

      if (i === 0) {
        ctx.moveTo(x, y)
      } else {
        ctx.lineTo(x, y)
      }
    }

    ctx.stroke()

    // Draw fill under waveform
    ctx.lineTo(width, height / 2)
    ctx.lineTo(0, height / 2)
    ctx.closePath()
    ctx.fillStyle = "rgba(0, 255, 136, 0.1)"
    ctx.fill()
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
      {/* Main Controls */}
      <div className="space-y-3">
        {/* Buttons Row */}
        <div className="flex items-center justify-center gap-2">
          <Button size="icon" variant="outline" onClick={handleRestart} disabled={isLoading}>
            <SkipBack className="h-4 w-4" />
          </Button>

          {!isPlaying ? (
            <Button size="icon" onClick={handlePlay} disabled={isLoading || isRecording}>
              <Play className="h-4 w-4" />
            </Button>
          ) : (
            <Button size="icon" variant="outline" onClick={handlePause}>
              <Pause className="h-4 w-4" />
            </Button>
          )}

          <Button size="icon" variant="outline" onClick={handleStop} disabled={isLoading}>
            <Square className="h-4 w-4" />
          </Button>

          <Button size="icon" variant="outline" onClick={handleExportToWav} disabled={isLoading || isRecording}>
            <Download className="h-4 w-4" />
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

      {/* Master Controls */}
      <div className="space-y-3 md:space-y-0 md:grid md:grid-cols-2 md:gap-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Volume2 className="h-4 w-4" />
              <span className="text-sm font-medium">Volume</span>
            </div>
            <span className="text-sm font-medium">{volume}%</span>
          </div>
          <Slider
            value={[volume]}
            max={100}
            step={1}
            onValueChange={handleVolumeChange}
            disabled={isLoading}
          />
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

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Rate</span>
            <span className="text-sm font-medium">{playbackRate}%</span>
          </div>
          <Slider
            value={[playbackRate]}
            min={25}
            max={200}
            step={5}
            onValueChange={handlePlaybackRateChange}
            disabled={isLoading}
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Pitch</span>
            <span className="text-sm font-medium">{pitchShift > 0 ? '+' : ''}{pitchShift}</span>
          </div>
          <Slider
            value={[pitchShift]}
            min={-12}
            max={12}
            step={1}
            onValueChange={handlePitchShiftChange}
            disabled={isLoading}
          />
        </div>
      </div>

      {/* Advanced Controls Tabs */}
      <Tabs defaultValue="tracks" className="w-full">
        <TabsList className="w-full h-auto flex flex-wrap md:grid md:grid-cols-5 gap-1 p-1">
          <TabsTrigger value="tracks" className="flex-1 min-w-[80px] text-xs md:text-sm">Tracks</TabsTrigger>
          <TabsTrigger value="effects" className="flex-1 min-w-[80px] text-xs md:text-sm">Effects</TabsTrigger>
          <TabsTrigger value="eq" className="flex-1 min-w-[80px] text-xs md:text-sm">EQ</TabsTrigger>
          <TabsTrigger value="loop" className="flex-1 min-w-[80px] text-xs md:text-sm">Loop</TabsTrigger>
          <TabsTrigger value="visual" className="flex-1 min-w-[80px] text-xs md:text-sm">Visual</TabsTrigger>
        </TabsList>

        <TabsContent value="tracks" className="space-y-2">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Track Controls</span>
            <div className="flex items-center gap-2">
              <Music className="h-4 w-4" />
              <span className="text-xs">Metronome</span>
              <Switch
                checked={metronomeEnabled}
                onCheckedChange={setMetronomeEnabled}
              />
            </div>
          </div>
          {trackStates.map((track, idx) => (
            <div key={idx} className="border rounded p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Track {idx + 1}</span>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant={track.muted ? "default" : "outline"}
                    onClick={() => handleTrackMute(idx)}
                  >
                    M
                  </Button>
                  <Button
                    size="sm"
                    variant={track.solo ? "default" : "outline"}
                    onClick={() => handleTrackSolo(idx)}
                  >
                    S
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs">Instrument</label>
                  <Select
                    value={track.instrument}
                    onValueChange={(val) => handleTrackInstrumentChange(idx, val as InstrumentType)}
                  >
                    <SelectTrigger className="h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="synth">Synth</SelectItem>
                      <SelectItem value="piano">Piano</SelectItem>
                      <SelectItem value="organ">Organ</SelectItem>
                      <SelectItem value="bass">Bass</SelectItem>
                      <SelectItem value="strings">Strings</SelectItem>
                      <SelectItem value="cello">Cello</SelectItem>
                      <SelectItem value="violin">Violin</SelectItem>
                      <SelectItem value="oud">Oud</SelectItem>
                      <SelectItem value="guitar">Guitar</SelectItem>
                      <SelectItem value="harp">Harp</SelectItem>
                      <SelectItem value="brass">Brass</SelectItem>
                      <SelectItem value="trumpet">Trumpet</SelectItem>
                      <SelectItem value="saxophone">Saxophone</SelectItem>
                      <SelectItem value="flute">Flute</SelectItem>
                      <SelectItem value="bells">Bells</SelectItem>
                      <SelectItem value="marimba">Marimba</SelectItem>
                      <SelectItem value="choir">Choir</SelectItem>
                      <SelectItem value="pad">Pad</SelectItem>
                      <SelectItem value="lead">Lead</SelectItem>
                      <SelectItem value="pluck">Pluck</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-xs">Volume: {track.volume}%</label>
                  <Slider
                    value={[track.volume]}
                    max={100}
                    step={1}
                    onValueChange={(val) => handleTrackVolumeChange(idx, val)}
                    className="mt-1"
                  />
                </div>

                <div className="col-span-2">
                  <label className="text-xs">Pan: {track.pan > 0 ? 'R' : track.pan < 0 ? 'L' : 'C'} {Math.abs(track.pan)}</label>
                  <Slider
                    value={[track.pan]}
                    min={-100}
                    max={100}
                    step={1}
                    onValueChange={(val) => handleTrackPanChange(idx, val)}
                    className="mt-1"
                  />
                </div>
              </div>
            </div>
          ))}
        </TabsContent>

        <TabsContent value="effects" className="space-y-3">
          <div>
            <label className="text-sm font-medium">Reverb: {reverbMix}%</label>
            <Slider
              value={[reverbMix]}
              max={100}
              step={1}
              onValueChange={handleReverbChange}
            />
          </div>

          <div>
            <label className="text-sm font-medium">Delay: {delayMix}%</label>
            <Slider
              value={[delayMix]}
              max={100}
              step={1}
              onValueChange={handleDelayChange}
            />
          </div>

          <div>
            <label className="text-sm font-medium">Chorus: {chorusMix}%</label>
            <Slider
              value={[chorusMix]}
              max={100}
              step={1}
              onValueChange={handleChorusChange}
            />
          </div>

          <div>
            <label className="text-sm font-medium">Distortion: {distortionAmount}%</label>
            <Slider
              value={[distortionAmount]}
              max={100}
              step={1}
              onValueChange={handleDistortionChange}
            />
          </div>
        </TabsContent>

        <TabsContent value="eq" className="space-y-3">
          <div>
            <label className="text-sm font-medium">Low: {eqLow > 0 ? '+' : ''}{eqLow} dB</label>
            <Slider
              value={[eqLow]}
              min={-12}
              max={12}
              step={1}
              onValueChange={handleEqLowChange}
            />
          </div>

          <div>
            <label className="text-sm font-medium">Mid: {eqMid > 0 ? '+' : ''}{eqMid} dB</label>
            <Slider
              value={[eqMid]}
              min={-12}
              max={12}
              step={1}
              onValueChange={handleEqMidChange}
            />
          </div>

          <div>
            <label className="text-sm font-medium">High: {eqHigh > 0 ? '+' : ''}{eqHigh} dB</label>
            <Slider
              value={[eqHigh]}
              min={-12}
              max={12}
              step={1}
              onValueChange={handleEqHighChange}
            />
          </div>

          <div className="pt-3 border-t">
            <div className="flex items-center gap-2 mb-2">
              <label className="text-sm font-medium">Filter Type</label>
              <Select value={filterType} onValueChange={handleFilterTypeChange}>
                <SelectTrigger className="h-8 w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="lowpass">Low Pass</SelectItem>
                  <SelectItem value="highpass">High Pass</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <label className="text-sm font-medium">Frequency: {filterFreq} Hz</label>
            <Slider
              value={[filterFreq]}
              min={20}
              max={20000}
              step={10}
              onValueChange={handleFilterFreqChange}
            />
          </div>

          <div className="pt-3 border-t">
            <div>
              <label className="text-sm font-medium">Compressor Threshold: {compressorThreshold} dB</label>
              <Slider
                value={[compressorThreshold]}
                min={-60}
                max={0}
                step={1}
                onValueChange={handleCompressorThresholdChange}
              />
            </div>

            <div className="mt-3">
              <label className="text-sm font-medium">Compressor Ratio: {compressorRatio}:1</label>
              <Slider
                value={[compressorRatio]}
                min={1}
                max={20}
                step={0.5}
                onValueChange={handleCompressorRatioChange}
              />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="loop" className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Loop Enabled</span>
            <Switch
              checked={loopEnabled}
              onCheckedChange={setLoopEnabled}
            />
          </div>

          <div>
            <label className="text-sm font-medium">Loop Start: {formatTime(loopStart)}</label>
            <Slider
              value={[loopStart]}
              max={duration || 100}
              step={0.1}
              onValueChange={handleLoopStartChange}
              disabled={!loopEnabled}
            />
          </div>

          <div>
            <label className="text-sm font-medium">Loop End: {formatTime(loopEnd)}</label>
            <Slider
              value={[loopEnd]}
              max={duration || 100}
              step={0.1}
              onValueChange={handleLoopEndChange}
              disabled={!loopEnabled}
            />
          </div>
        </TabsContent>

        <TabsContent value="visual" className="space-y-2">
          <div className="text-sm font-medium mb-2">Waveform Analyzer</div>
          <div className="border rounded overflow-hidden">
            <canvas
              ref={canvasRef}
              width={800}
              height={200}
              className="w-full"
              style={{ display: 'block' }}
            />
          </div>
        </TabsContent>
      </Tabs>

      {!effectsReady && (
        <div className="text-sm text-muted-foreground text-center">
          Initializing audio engine...
        </div>
      )}

      {isLoading && (
        <div className="text-sm text-muted-foreground text-center">
          Loading MIDI...
        </div>
      )}

      {isRecording && (
        <div className="text-sm text-red-500 text-center font-medium">
          Recording...
        </div>
      )}
    </div>
  )
}
