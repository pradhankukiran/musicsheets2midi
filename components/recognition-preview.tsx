"use client"

import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

interface RecognitionPreviewProps {
  data: any
  fileName: string
}

export default function RecognitionPreview({ data, fileName }: RecognitionPreviewProps) {
  const notes = data.notes || []
  const tempo = data.tempo || 120
  const timeSignature = data.timeSignature || "4/4"
  const key = data.key || "C Major"

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-card to-primary/5 p-5 md:p-8 ornament-top ornament-bottom">
      <div className="mb-5 md:mb-8">
        <p className="text-xs font-light tracking-widest text-muted-foreground uppercase">Recognition Results</p>
        <h3 className="mt-2 text-xl md:text-2xl font-light tracking-wide text-foreground break-words">{fileName}</h3>
      </div>

      <div className="mb-5 md:mb-8 flex flex-col gap-3 md:grid md:grid-cols-2 lg:grid-cols-4 md:gap-4">
        {[
          { label: "Tempo", value: `${tempo} BPM`, color: "from-primary" },
          { label: "Time Signature", value: timeSignature, color: "from-accent" },
          { label: "Key", value: key, color: "from-secondary" },
          { label: "Notes", value: notes.length, color: "from-primary" },
        ].map((item, idx) => (
          <div
            key={idx}
            className={`rounded-lg bg-gradient-to-br ${item.color}/15 to-transparent p-4 border border-${item.color.split("-")[1]}/20`}
          >
            <p className="text-xs font-light tracking-widest text-muted-foreground uppercase">{item.label}</p>
            <p className="mt-2 text-2xl md:text-xl font-light text-foreground">{item.value}</p>
          </div>
        ))}
      </div>

      <div className="h-px bg-gradient-to-r from-primary/20 via-accent/20 to-transparent mb-5 md:mb-8" />

      <div>
        <p className="text-xs font-light tracking-widest text-muted-foreground uppercase mb-4">Recognized Notes</p>
        <div className="flex flex-wrap gap-2">
          {notes.slice(0, 20).map((note: any, idx: number) => (
            <Badge
              key={idx}
              variant="secondary"
              className="font-mono bg-secondary/20 text-secondary-foreground hover:bg-secondary/30 font-light text-sm px-3 py-1"
            >
              {note.pitch}
              {note.duration && <span className="ml-1 text-xs">({note.duration})</span>}
            </Badge>
          ))}
          {notes.length > 20 && (
            <Badge variant="outline" className="text-muted-foreground font-light text-sm px-3 py-1">
              +{notes.length - 20} more
            </Badge>
          )}
        </div>
      </div>
    </Card>
  )
}
