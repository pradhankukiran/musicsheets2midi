"use client"

import { useSearchParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { ArrowLeft } from "lucide-react"
import RecognitionPreview from "@/components/recognition-preview"
import MidiExporter from "@/components/midi-exporter"

export default function RecognitionResultsPage() {
  const searchParams = useSearchParams()
  const router = useRouter()

  const dataParam = searchParams.get("data")
  const fileName = searchParams.get("fileName") || "music-sheet"

  let recognitionData = null
  try {
    if (dataParam) {
      recognitionData = JSON.parse(dataParam)
    }
  } catch (err) {
    console.error("Failed to parse recognition data:", err)
  }

  if (!recognitionData) {
    return (
      <main className="min-h-screen geometric-bg">
        <div className="container mx-auto px-4 py-12">
          <div className="max-w-2xl mx-auto">
            <Card className="pointed-arch-card bg-card p-8 text-center">
              <p className="text-foreground font-light tracking-wide mb-6">No recognition data found</p>
              <Button
                onClick={() => router.push("/")}
                className="arch-button gap-2 bg-gradient-to-r from-primary to-secondary text-primary-foreground hover:shadow-xl"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to Upload
              </Button>
            </Card>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen geometric-bg">
      <div className="container mx-auto px-4 py-6 md:py-12 lg:py-16">
        <div className="max-w-4xl mx-auto">
          <div className="mb-5 md:mb-8">
            <div className="mb-6 border-2 border-primary/20 rounded-xl bg-card p-6">
              <div className="space-y-3 text-center md:text-left">
                <h1 className="text-2xl md:text-3xl lg:text-4xl font-light tracking-[0.15em] bg-gradient-to-r from-primary via-accent to-secondary bg-clip-text text-transparent">
                  Recognition Results
                </h1>
                <div className="flex items-center justify-center md:justify-start gap-2">
                  <span className="ornament-diamond text-primary opacity-50"></span>
                  <p className="text-muted-foreground font-light break-words text-sm md:text-base tracking-wide">
                    {fileName}
                  </p>
                  <span className="ornament-diamond text-primary opacity-50"></span>
                </div>
              </div>
            </div>
            <Button
              onClick={() => router.push("/")}
              variant="outline"
              className="arch-button gap-2 bg-transparent border-2 border-primary/30 hover:bg-primary/10 hover:border-primary w-full md:w-auto transition-all duration-300"
            >
              <ArrowLeft className="h-4 w-4" />
              New Upload
            </Button>
          </div>

          <div className="space-y-4 md:space-y-6">
            <RecognitionPreview data={recognitionData} fileName={fileName} />
            <MidiExporter recognitionData={recognitionData} fileName={fileName} />
          </div>
        </div>
      </div>
    </main>
  )
}
