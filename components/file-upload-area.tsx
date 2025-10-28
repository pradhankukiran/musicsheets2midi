"use client"

import type React from "react"

import { useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Upload, CheckCircle2, Loader2, X } from "lucide-react"

const PROXY_BASE = "/api/backend/convert"

type MidiState = {
  b64: string
  filename?: string
  url: string
}

type AudioState = {
  b64: string
  format: string
  url: string
  filename?: string
  programNumber: number
}

const INSTRUMENTS: { value: string; label: string }[] = [
  { value: "0", label: "Piano (Acoustic Grand)" },
  { value: "24", label: "Guitar (Nylon)" },
  { value: "32", label: "Bass (Acoustic)" },
  { value: "40", label: "Violin" },
  { value: "41", label: "Viola" },
  { value: "42", label: "Cello" },
  { value: "46", label: "Harp" },
  { value: "56", label: "Trumpet" },
  { value: "57", label: "Trombone" },
  { value: "60", label: "French Horn" },
  { value: "64", label: "Soprano Sax" },
  { value: "71", label: "Clarinet" },
  { value: "73", label: "Flute" },
  { value: "74", label: "Recorder" },
  { value: "104", label: "Sitar" },
]

export default function FileUploadArea() {
  const [isDragging, setIsDragging] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [isFetchingAudio, setIsFetchingAudio] = useState(false)
  const [statusMsg, setStatusMsg] = useState("")
  const [errorMsg, setErrorMsg] = useState("")
  const [midiState, setMidiState] = useState<MidiState | null>(null)
  const [audioState, setAudioState] = useState<AudioState | null>(null)
  const [mxlFilename, setMxlFilename] = useState<string>("")
  const [selectedInstrument, setSelectedInstrument] = useState<string>("0")
  const fileInputRef = useRef<HTMLInputElement>(null)

  const makeBlobUrlFromBase64 = (b64: string, mimeType: string) => {
    const binary = atob(b64)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i)
    }
    const blob = new Blob([bytes], { type: mimeType })
    return URL.createObjectURL(blob)
  }

  const revokeUrl = (url?: string) => {
    if (url) {
      URL.revokeObjectURL(url)
    }
  }

  const resetState = () => {
    revokeUrl(midiState?.url)
    revokeUrl(audioState?.url)
    setMidiState(null)
    setAudioState(null)
    setMxlFilename("")
    setStatusMsg("")
    setErrorMsg("")
    setSelectedInstrument("0")
  }

  const handleClear = () => {
    setFile(null)
    resetState()
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  useEffect(() => {
    return () => {
      revokeUrl(midiState?.url)
      revokeUrl(audioState?.url)
    }
  }, [midiState?.url, audioState?.url])

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = () => {
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const files = e.dataTransfer.files
    if (files.length > 0) {
      handleFile(files[0])
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.currentTarget.files
    if (files && files.length > 0) {
      handleFile(files[0])
    }
  }

  const handleFile = (selectedFile: File) => {
    const validTypes = ["image/png", "image/jpeg", "application/pdf"]
    const isValidType = validTypes.includes(selectedFile.type) || selectedFile.name.toLowerCase().endsWith(".pdf")
    if (!isValidType) {
      setErrorMsg("Please upload a PNG, JPG, or PDF file.")
      return
    }

    if (selectedFile.size > 10 * 1024 * 1024) {
      setErrorMsg("File size must be less than 10MB.")
      return
    }

    setFile(selectedFile)
    resetState()
    setStatusMsg(`Selected: ${selectedFile.name}`)
  }

  const postFileForXML = async (uploadFile: File) => {
    const lowerName = uploadFile.name.toLowerCase()
    const isPdf = uploadFile.type === "application/pdf" || lowerName.endsWith(".pdf")
    const endpoint = isPdf ? `${PROXY_BASE}/pdf` : `${PROXY_BASE}/page`

    const formData = new FormData()
    formData.append("file", uploadFile)

    const response = await fetch(endpoint, {
      method: "POST",
      body: formData,
    })

    if (!response.ok) {
      throw new Error(`File conversion failed with status ${response.status}`)
    }

    const data = await response.json()
    return { data, isPdf }
  }

  const mxlToMidi = async (mxl_b64: string) => {
    const response = await fetch(`${PROXY_BASE}/midi`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ mxl_b64 }),
    })

    if (!response.ok) {
      throw new Error(`MIDI conversion failed with status ${response.status}`)
    }

    const data = await response.json()
    if (data.status && data.status !== "ok") {
      throw new Error(data.error || "Conversion to MIDI failed.")
    }

    if (!data.midi_b64) {
      throw new Error("No MIDI returned from conversion service.")
    }

    return data
  }

  const midiToAudio = async (midi_b64: string, programNumber: number) => {
    const response = await fetch(`${PROXY_BASE}/audio-instrument`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ midi_b64, program_number: programNumber }),
    })

    if (!response.ok) {
      throw new Error(`Audio conversion failed with status ${response.status}`)
    }

    const data = await response.json()
    if (data.status && data.status !== "ok") {
      throw new Error(data.error || "Conversion to audio failed.")
    }

    if (!data.audio_b64) {
      throw new Error("No audio returned from conversion service.")
    }

    return data
  }

  const extractMxlPayload = (payload: any) => {
    if (Array.isArray(payload?.pages) && payload.pages.length > 0) {
      const okPages = payload.pages.filter((page: any) => page.status === "ok" || !page.status)
      const firstPage = (okPages.length > 0 ? okPages[0] : payload.pages[0]) ?? null
      return {
        mxl_b64: firstPage?.mxl_b64,
        mxl_filename: firstPage?.mxl_filename,
      }
    }

    return {
      mxl_b64: payload?.mxl_b64,
      mxl_filename: payload?.mxl_filename,
    }
  }

  const handleConvert = async () => {
    if (!file) {
      setErrorMsg("Select a file before converting.")
      return
    }

    try {
      setIsProcessing(true)
      setErrorMsg("")
      setStatusMsg("Uploading sheet and extracting MusicXML...")

      const { data } = await postFileForXML(file)
      const { mxl_b64, mxl_filename } = extractMxlPayload(data)

      if (!mxl_b64) {
        throw new Error("No MusicXML data returned from the conversion service.")
      }

      setMxlFilename(mxl_filename || file.name.replace(/\.[^/.]+$/, "") + ".mxl")

      setStatusMsg("Converting MusicXML to MIDI...")
      const midiData = await mxlToMidi(mxl_b64)

      revokeUrl(midiState?.url)
      const midiUrl = makeBlobUrlFromBase64(midiData.midi_b64, "audio/midi")
      setMidiState({
        b64: midiData.midi_b64,
        filename: midiData.midi_filename || file.name.replace(/\.[^/.]+$/, "") + ".mid",
        url: midiUrl,
      })

      revokeUrl(audioState?.url)
      setAudioState(null)
      setStatusMsg("MIDI ready. Choose an instrument to preview audio.")
    } catch (error) {
      resetState()
      setErrorMsg(error instanceof Error ? error.message : "An unexpected error occurred.")
    } finally {
      setIsProcessing(false)
    }
  }

  const handlePreviewAudio = async () => {
    if (!midiState) {
      setErrorMsg("Generate MIDI before requesting audio.")
      return
    }

    try {
      setIsFetchingAudio(true)
      setErrorMsg("")
      setStatusMsg("Rendering audio with selected instrument...")

      const programNumber = Number.parseInt(selectedInstrument, 10)
      const audioData = await midiToAudio(midiState.b64, programNumber)
      const audioFormat = (audioData.audio_format || "wav").toLowerCase()
      const mimeType = audioFormat === "wav" ? "audio/wav" : `audio/${audioFormat}`

      revokeUrl(audioState?.url)
      const audioUrl = makeBlobUrlFromBase64(audioData.audio_b64, mimeType)

      setAudioState({
        b64: audioData.audio_b64,
        format: audioFormat,
        filename:
          audioData.audio_filename ||
          `${midiState.filename?.replace(/\.mid$/, "") || "converted"}_${programNumber}.${audioFormat}`,
        url: audioUrl,
        programNumber,
      })

      setStatusMsg("Audio ready. Hit play or download the WAV file.")
    } catch (error) {
      revokeUrl(audioState?.url)
      setAudioState(null)
      setErrorMsg(error instanceof Error ? error.message : "Failed to render audio preview.")
    } finally {
      setIsFetchingAudio(false)
    }
  }

  return (
    <Card
      className={`border-2 border-dashed transition-all duration-300 ornament-top ornament-bottom ${
        isDragging
          ? "border-primary bg-gradient-to-br from-primary/20 to-accent/15 shadow-lg"
          : "border-primary/30 bg-card hover:border-primary/50 hover:shadow-md"
      }`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div className="flex flex-col items-center justify-center gap-8 px-6 md:px-12 py-16 md:py-24">
        <div className="text-center space-y-2">
          <h1 className="text-3xl md:text-4xl font-semibold tracking-wider bg-gradient-to-r from-primary via-accent to-secondary bg-clip-text text-transparent">
            MusicSheets2MIDI
          </h1>
          <p className="text-xs md:text-sm text-muted-foreground font-medium tracking-widest uppercase">
            by MaqAura
          </p>
        </div>

        <div className="relative">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/30 to-accent/20 rounded-full blur-2xl" />
          <div className="relative rounded-full bg-gradient-to-br from-primary/20 to-accent/10 p-6 border border-primary/20">
            <Upload className="h-10 w-10 text-primary" />
          </div>
        </div>

        <div className="text-center space-y-3">
          <h2 className="text-2xl md:text-3xl font-light tracking-wide text-foreground">Upload Your Music Sheet</h2>
          <p className="text-sm md:text-base text-muted-foreground font-light">
            Drag and drop your file here, or click to browse
          </p>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,image/png,image/jpeg"
          onChange={handleFileChange}
          className="hidden"
          disabled={isProcessing}
        />

        <div className="flex flex-col items-center gap-4 w-full">
          <Button
            onClick={() => fileInputRef.current?.click()}
            disabled={isProcessing}
            size="lg"
            className="px-10 py-6 bg-gradient-to-r from-primary to-secondary text-primary-foreground hover:shadow-lg transition-all duration-300 font-light tracking-wide"
          >
            {isProcessing ? "Processing..." : "Select File"}
          </Button>

          {file && (
            <div className="flex flex-row items-center justify-center gap-3 w-full flex-wrap animate-in fade-in-0 slide-in-from-top-2 duration-300">
              <Button
                onClick={handleConvert}
                disabled={isProcessing}
                size="lg"
                className="px-10 py-6 bg-card text-foreground border border-primary/40 hover:bg-primary/10 transition-all duration-300 font-light tracking-wide"
              >
                {isProcessing ? "Converting..." : "Convert"}
              </Button>
              <Button
                onClick={handleClear}
                disabled={isProcessing || isFetchingAudio}
                size="lg"
                variant="ghost"
                className="px-10 py-6 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all duration-300 font-light tracking-wide"
              >
                <X className="h-4 w-4 mr-2" />
                Clear
              </Button>
            </div>
          )}
        </div>

        {statusMsg && (
          <div className="w-full animate-in fade-in-0 duration-500">
            <Card className="border border-primary/30 bg-gradient-to-br from-primary/10 to-accent/5 ornament-top ornament-bottom">
              <div className="flex items-center justify-center gap-4 px-6 py-4">
                {isProcessing || isFetchingAudio ? (
                  <div className="relative">
                    <div className="absolute inset-0 bg-gradient-to-br from-primary/30 to-accent/20 rounded-full blur-xl" />
                    <Loader2 className="h-5 w-5 text-primary animate-spin relative" />
                  </div>
                ) : (
                  <div className="relative">
                    <div className="absolute inset-0 bg-gradient-to-br from-primary/30 to-accent/20 rounded-full blur-xl" />
                    <CheckCircle2 className="h-5 w-5 text-primary relative" />
                  </div>
                )}
                <p className="text-sm text-foreground font-light tracking-wide text-center">{statusMsg}</p>
              </div>
            </Card>
          </div>
        )}

        {errorMsg && (
          <div className="w-full animate-in fade-in-0 duration-500">
            <Card className="border border-destructive/50 bg-destructive/5">
              <div className="px-6 py-4">
                <p className="text-sm text-destructive font-medium text-center">{errorMsg}</p>
              </div>
            </Card>
          </div>
        )}

        {midiState && (
          <Card className="w-full border-2 border-dashed border-primary/30 bg-gradient-to-br from-card to-accent/5 hover:border-primary/50 transition-all duration-300 ornament-top ornament-bottom">
            <div className="p-6 space-y-5">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                  <p className="text-xs font-light tracking-widest text-muted-foreground uppercase">Instrument</p>
                  <h3 className="text-lg font-light text-foreground">Choose a sound for playback</h3>
                </div>
                <Select
                  value={selectedInstrument}
                  onValueChange={(value) => {
                    setSelectedInstrument(value)
                    if (audioState) {
                      revokeUrl(audioState.url)
                      setAudioState(null)
                      setStatusMsg("Instrument changed. Generate a new preview.")
                    }
                  }}
                >
                  <SelectTrigger className="w-full md:w-64 bg-background/60">
                    <SelectValue placeholder="Select instrument" />
                  </SelectTrigger>
                  <SelectContent>
                    {INSTRUMENTS.map((instrument) => (
                      <SelectItem key={instrument.value} value={instrument.value}>
                        {instrument.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-wrap gap-3">
                <Button
                  onClick={handlePreviewAudio}
                  disabled={isFetchingAudio}
                  className="bg-gradient-to-r from-secondary to-primary text-secondary-foreground hover:shadow-md transition-all duration-300 font-light tracking-wide"
                >
                  {isFetchingAudio ? "Rendering Audio..." : "Preview Audio"}
                </Button>
                <Button
                  asChild
                  variant="outline"
                  className="border-primary/40 hover:bg-primary/10 transition-all duration-300 font-light tracking-wide"
                >
                  <a href={midiState.url} download={midiState.filename || "output.mid"}>
                    Download MIDI
                  </a>
                </Button>
                <Button
                  asChild
                  variant="outline"
                  disabled={!audioState}
                  className="border-primary/40 hover:bg-primary/10 transition-all duration-300 font-light tracking-wide disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <a
                    href={audioState?.url || "#"}
                    download={audioState?.filename || "output.wav"}
                    aria-disabled={!audioState}
                  >
                    Download WAV
                  </a>
                </Button>
              </div>

              {audioState && (
                <div className="space-y-2">
                  <p className="text-xs font-light tracking-widest text-muted-foreground uppercase">
                    Preview ({audioState.format.toUpperCase()})
                  </p>
                  <audio controls src={audioState.url} className="w-full">
                    Your browser does not support the audio element.
                  </audio>
                </div>
              )}

              <div className="text-xs text-muted-foreground">
                {mxlFilename && <p>MusicXML source: {mxlFilename}</p>}
                <p>
                  MIDI file size:{" "}
                  {Math.max(1, Math.round(((midiState.b64.length * 3) / 4) / 1024))} KB
                </p>
              </div>
            </div>
          </Card>
        )}

        <p className="text-xs text-muted-foreground font-light tracking-widest uppercase">PNG, JPG, or PDF</p>
      </div>
    </Card>
  )
}
