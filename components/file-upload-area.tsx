"use client"

import type React from "react"

import { useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Upload } from "lucide-react"

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

  useEffect(() => {
    return () => {
      revokeUrls(results)
    }
  }, [results])

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
          <Button
            onClick={handleConvert}
            disabled={loading}
            size="lg"
            className="px-10 py-6 bg-card text-foreground border border-primary/40 hover:bg-primary/10 transition-all duration-300 font-light tracking-wide"
          >
            {loading ? "Converting..." : "Convert"}
          </Button>
        </div>

        {statusMsg && <p className="text-sm text-foreground font-light">{statusMsg}</p>}
        {errorMsg && <p className="text-sm text-destructive font-medium">{errorMsg}</p>}

        {results.length > 0 && (
          <div className="w-full space-y-6 text-left mt-4">
            {results.map((result) => (
              <div key={result.page} className="rounded-lg border border-primary/30 bg-card/80 p-6 space-y-4">
                <p className="text-sm font-light tracking-wide text-muted-foreground uppercase">
                  Page {result.page}
                </p>
                <div className="flex flex-wrap gap-4">
                  <a
                    href={result.mxlUrl}
                    download={result.mxl_filename || `page${result.page}.mxl`}
                    className="text-primary underline underline-offset-4 text-sm"
                  >
                    Download MusicXML
                  </a>
                  <a
                    href={result.midiUrl}
                    download={result.midi_filename || `page${result.page}.mid`}
                    className="text-primary underline underline-offset-4 text-sm"
                  >
                    Download MIDI
                  </a>
                </div>
                <audio controls className="w-full" src={result.midiUrl}>
                  Your browser does not support the audio element.
                </audio>
              </div>
            ))}
          </div>
        )}

        <p className="text-xs text-muted-foreground font-light tracking-widest uppercase">PNG, JPG, or PDF</p>
      </div>
    </Card>
  )
}
