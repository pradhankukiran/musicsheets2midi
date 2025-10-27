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
      <main className="min-h-screen bg-gradient-to-b from-background via-background to-accent/5">
        <div className="container mx-auto px-4 py-12">
          <div className="max-w-2xl mx-auto">
            <Card className="border-primary/20 bg-gradient-to-br from-card to-primary/5 p-8 text-center">
              <p className="text-foreground mb-4">No recognition data found</p>
              <Button onClick={() => router.push("/")} className="gap-2">
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
    <main className="min-h-screen bg-gradient-to-b from-background via-background to-accent/5">
      <div className="container mx-auto px-4 py-12 md:py-16">
        <div className="max-w-4xl mx-auto">
          <div className="mb-8 flex items-center justify-between">
            <div>
              <h1 className="text-3xl md:text-4xl font-light tracking-wide text-foreground">Recognition Results</h1>
              <p className="text-muted-foreground font-light mt-2">{fileName}</p>
            </div>
            <Button
              onClick={() => router.push("/")}
              variant="outline"
              className="gap-2 bg-transparent border-primary/30 hover:bg-primary/10"
            >
              <ArrowLeft className="h-4 w-4" />
              New Upload
            </Button>
          </div>

          <div className="space-y-6">
            <RecognitionPreview data={recognitionData} fileName={fileName} />
            <MidiExporter recognitionData={recognitionData} fileName={fileName} />
          </div>
        </div>
      </div>
    </main>
  )
}
