"use client"

import type React from "react"

import { useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Upload } from "lucide-react"

interface FileUploadAreaProps {
  onFileUpload: (file: File) => void
  isProcessing: boolean
}

export default function FileUploadArea({ onFileUpload, isProcessing }: FileUploadAreaProps) {
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

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

  const handleFile = (file: File) => {
    const validTypes = ["image/png", "image/jpeg", "application/pdf"]
    if (!validTypes.includes(file.type)) {
      alert("Please upload a PNG, JPG, or PDF file")
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      alert("File size must be less than 10MB")
      return
    }
    onFileUpload(file)
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
          accept=".png,.jpg,.jpeg,.pdf"
          onChange={handleFileChange}
          className="hidden"
          disabled={isProcessing}
        />

        <Button
          onClick={() => fileInputRef.current?.click()}
          disabled={isProcessing}
          size="lg"
          className="px-10 py-6 bg-gradient-to-r from-primary to-secondary text-primary-foreground hover:shadow-lg transition-all duration-300 font-light tracking-wide"
        >
          {isProcessing ? "Processing..." : "Select File"}
        </Button>

        <p className="text-xs text-muted-foreground font-light tracking-widest uppercase">PNG, JPG, or PDF</p>
      </div>
    </Card>
  )
}
