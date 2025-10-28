"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Download, Music } from "lucide-react"

interface MidiExporterProps {
  recognitionData: any
  fileName: string
}

export default function MidiExporter({ recognitionData, fileName }: MidiExporterProps) {
  const [isExporting, setIsExporting] = useState(false)

  const generateMidi = async () => {
    setIsExporting(true)
    try {
      const response = await fetch("/api/generate-midi", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(recognitionData),
      })

      if (!response.ok) {
        throw new Error("Failed to generate MIDI")
      }

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `${fileName.replace(/\.[^/.]+$/, "")}.mid`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (error) {
      console.error("Export failed:", error)
      alert("Failed to export MIDI file")
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <Card className="border-primary/20 bg-gradient-to-r from-primary/10 via-accent/10 to-secondary/10 p-5 md:p-8 ornament-top ornament-bottom">
      <div className="space-y-5">
        <div>
          <h3 className="text-xl md:text-2xl font-light tracking-wide text-foreground">Ready to Export</h3>
          <p className="text-sm md:text-base text-muted-foreground font-light mt-2">Convert recognized notes to MIDI format</p>
        </div>
        <Button
          onClick={generateMidi}
          disabled={isExporting}
          size="lg"
          className="gap-2 bg-gradient-to-r from-primary to-secondary text-primary-foreground hover:shadow-lg transition-all duration-300 font-light tracking-wide w-full md:w-auto md:px-10"
        >
          <Download className="h-5 w-5" />
          {isExporting ? "Exporting..." : "Export MIDI"}
        </Button>
      </div>
    </Card>
  )
}
