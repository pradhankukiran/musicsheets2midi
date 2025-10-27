"use client"

import FileUploadArea from "@/components/file-upload-area"

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-background via-background to-accent/5">
      <div className="container mx-auto px-4 py-12 md:py-16">
        <div className="max-w-2xl mx-auto">
          <FileUploadArea />
        </div>
      </div>
    </main>
  )
}
