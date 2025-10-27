"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import FileUploadArea from "@/components/file-upload-area"

export default function Home() {
  const router = useRouter()
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleFileUpload = async (file: File) => {
    setError(null)
    setIsProcessing(true)

    try {
      const formData = new FormData()
      formData.append("file", file)

      const response = await fetch("/api/omr", {
        method: "POST",
        body: formData,
      })

      if (!response.ok) {
        throw new Error("Failed to process music sheet")
      }

      const data = await response.json()

      const params = new URLSearchParams({
        data: JSON.stringify(data),
        fileName: file.name,
      })
      router.push(`/recognition-results?${params.toString()}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-background via-background to-accent/5">
      <div className="container mx-auto px-4 py-12 md:py-16">
        <div className="max-w-2xl mx-auto">
          {error && (
            <Card className="border-destructive/20 bg-destructive/5 p-6 mb-6">
              <p className="text-destructive text-sm font-medium">Error: {error}</p>
              <Button onClick={() => setError(null)} variant="outline" className="mt-4 bg-transparent">
                Try Another File
              </Button>
            </Card>
          )}
          <FileUploadArea onFileUpload={handleFileUpload} isProcessing={isProcessing} />
        </div>
      </div>
    </main>
  )
}
