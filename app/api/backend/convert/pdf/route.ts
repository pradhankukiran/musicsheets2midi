import { type NextRequest, NextResponse } from "next/server"

const API_BASE = "http://3.110.112.30:8000"

export const runtime = "nodejs"

export async function POST(request: NextRequest) {
  try {
    const incomingFormData = await request.formData()
    const forwardFormData = new FormData()

    for (const [key, value] of incomingFormData.entries()) {
      if (typeof value === "string") {
        forwardFormData.append(key, value)
      } else {
        const blob = new Blob([await value.arrayBuffer()], { type: value.type })
        forwardFormData.append(key, blob, value.name)
      }
    }

    const upstreamResponse = await fetch(`${API_BASE}/convert/pdf`, {
      method: "POST",
      body: forwardFormData,
    })

    const text = await upstreamResponse.text()
    const data = safeJsonParse(text)

    return NextResponse.json(data, { status: upstreamResponse.status })
  } catch (error) {
    console.error("PDF conversion proxy error:", error)
    return NextResponse.json({ status: "error", error: "Proxy request failed." }, { status: 500 })
  }
}

export function OPTIONS() {
  return corsResponse()
}

function safeJsonParse(text: string) {
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

function corsResponse() {
  return NextResponse.json(
    {},
    {
      status: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    }
  )
}
