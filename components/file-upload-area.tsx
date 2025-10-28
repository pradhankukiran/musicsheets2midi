"use client"

import type React from "react"

import { useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Upload, CheckCircle2, Loader2, X } from "lucide-react"
import { MidiPlayer } from "@/components/midi-player-advanced"

const API_BASE = "http://3.110.112.30:8000"
const PROXY_BASE = "/api/backend/convert"

type ConversionResult = {
  page: number
  mxl_b64: string
  mxl_filename?: string
  midi_b64: string
  midi_filename?: string
  mxlUrl: string
  midiUrl: string
}

export default function FileUploadArea() {
  const [isDragging, setIsDragging] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [statusMsg, setStatusMsg] = useState("")
  const [errorMsg, setErrorMsg] = useState("")
  const [results, setResults] = useState<ConversionResult[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)
  const resultsRef = useRef<HTMLDivElement>(null)

  const makeBlobUrlFromBase64 = (b64: string, mimeType: string) => {
    const binary = atob(b64)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i)
    }
    const blob = new Blob([bytes], { type: mimeType })
    return URL.createObjectURL(blob)
  }

  const revokeUrls = (items: ConversionResult[]) => {
    items.forEach((item) => {
      URL.revokeObjectURL(item.mxlUrl)
      URL.revokeObjectURL(item.midiUrl)
    })
  }

  const resetResults = () => {
    revokeUrls(results)
    setResults([])
  }

  const handleClear = () => {
    setFile(null)
    resetResults()
    setStatusMsg("")
    setErrorMsg("")
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  useEffect(() => {
    return () => {
      revokeUrls(results)
    }
  }, [results])

  useEffect(() => {
    if (results.length > 0 && !loading && resultsRef.current) {
      setTimeout(() => {
        resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
      }, 300)
    }
  }, [results, loading])

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
    resetResults()
    setErrorMsg("")
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
    if (data.status !== "ok") {
      throw new Error(data.error || "Conversion to MusicXML failed.")
    }

    return data
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
    if (data.status !== "ok") {
      throw new Error(data.error || "Conversion to MIDI failed.")
    }

    return data
  }

  const handleConvert = async () => {
    if (!file) {
      setErrorMsg("Select a file before converting.")
      return
    }

    try {
      setLoading(true)
      setErrorMsg("")
      setStatusMsg("Converting to MusicXML...")

      const baseData = await postFileForXML(file)

      const pagesData =
        Array.isArray(baseData.pages) && baseData.pages.length > 0
          ? baseData.pages
              .filter((page: any) => page.status === "ok")
              .map((page: any) => ({
                page: page.page ?? 1,
                mxl_b64: page.mxl_b64,
                mxl_filename: page.mxl_filename,
              }))
          : [
              {
                page: 1,
                mxl_b64: baseData.mxl_b64,
                mxl_filename: baseData.mxl_filename,
              },
            ]

      if (pagesData.length === 0) {
        throw new Error("No valid MusicXML data returned.")
      }

      setStatusMsg("Converting MusicXML to MIDI...")

      const finalResults: ConversionResult[] = []

      for (const page of pagesData) {
        const midiData = await mxlToMidi(page.mxl_b64)
        const mxlUrl = makeBlobUrlFromBase64(
          page.mxl_b64,
          "application/vnd.recordare.musicxml+xml"
        )
        const midiUrl = makeBlobUrlFromBase64(midiData.midi_b64, "audio/midi")

        finalResults.push({
          page: page.page ?? 1,
          mxl_b64: page.mxl_b64,
          mxl_filename: page.mxl_filename,
          midi_b64: midiData.midi_b64,
          midi_filename: midiData.midi_filename,
          mxlUrl,
          midiUrl,
        })
      }

      setResults((prev) => {
        revokeUrls(prev)
        return finalResults
      })

      setStatusMsg("Done.")
    } catch (error) {
      resetResults()
      setStatusMsg("")
      setErrorMsg(error instanceof Error ? error.message : "An unexpected error occurred.")
    } finally {
      setLoading(false)
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
          disabled={loading}
        />

        <div className="flex flex-col items-center gap-4 w-full">
          <Button
            onClick={() => fileInputRef.current?.click()}
            disabled={loading}
            size="lg"
            className="px-10 py-6 bg-gradient-to-r from-primary to-secondary text-primary-foreground hover:shadow-lg transition-all duration-300 font-light tracking-wide"
          >
            {loading ? "Processing..." : "Select File"}
          </Button>

          {file && (
            <div className="flex flex-row items-center justify-center gap-3 w-full flex-wrap animate-in fade-in-0 slide-in-from-top-2 duration-300">
              <Button
                onClick={handleConvert}
                disabled={loading}
                size="lg"
                className="px-10 py-6 bg-card text-foreground border border-primary/40 hover:bg-primary/10 transition-all duration-300 font-light tracking-wide"
              >
                {loading ? "Converting..." : "Convert"}
              </Button>
              <Button
                onClick={handleClear}
                disabled={loading}
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
                {loading ? (
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
                <p className="text-sm text-foreground font-light tracking-wide">{statusMsg}</p>
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

        {results.length > 0 && (
          <div ref={resultsRef} className="w-full space-y-6 text-left mt-6 animate-in fade-in-0 slide-in-from-bottom-4 duration-700">
            {results.map((result, index) => (
              <Card
                key={result.page}
                className="border-2 border-dashed border-primary/30 bg-gradient-to-br from-card to-accent/5 hover:border-primary/50 hover:shadow-lg transition-all duration-300 ornament-top ornament-bottom"
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <div className="p-6 space-y-5">
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <div className="absolute inset-0 bg-gradient-to-br from-primary/30 to-accent/20 rounded-full blur-lg" />
                      <div className="relative rounded-full bg-gradient-to-br from-primary/20 to-accent/10 p-2 border border-primary/20">
                        <CheckCircle2 className="h-4 w-4 text-primary" />
                      </div>
                    </div>
                    <p className="text-sm font-light tracking-widest text-muted-foreground uppercase">
                      Page {result.page}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-3">
                    <Button
                      asChild
                      size="sm"
                      className="bg-gradient-to-r from-primary to-accent text-primary-foreground hover:shadow-md transition-all duration-300 font-light tracking-wide"
                    >
                      <a
                        href={result.mxlUrl}
                        download={result.mxl_filename || `page${result.page}.mxl`}
                      >
                        Download MusicXML
                      </a>
                    </Button>
                    <Button
                      asChild
                      size="sm"
                      className="bg-gradient-to-r from-secondary to-primary text-secondary-foreground hover:shadow-md transition-all duration-300 font-light tracking-wide"
                    >
                      <a
                        href={result.midiUrl}
                        download={result.midi_filename || `page${result.page}.mid`}
                      >
                        Download MIDI
                      </a>
                    </Button>
                  </div>

                  <div className="pt-2">
                    <MidiPlayer midiBase64={result.midi_b64} />
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}

        <p className="text-xs text-muted-foreground font-light tracking-widest uppercase">PNG, JPG, or PDF</p>
      </div>
    </Card>
  )
}
