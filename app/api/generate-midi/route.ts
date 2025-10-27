import { type NextRequest, NextResponse } from "next/server"

// Helper function to convert note names to MIDI numbers
function noteToMidi(noteName: string): number {
  const notes: { [key: string]: number } = {
    C: 0,
    D: 2,
    E: 4,
    F: 5,
    G: 7,
    A: 9,
    B: 11,
  }

  const match = noteName.match(/([A-G])(\d)/)
  if (!match) return 60 // Default to middle C

  const note = notes[match[1]]
  const octave = Number.parseInt(match[2])
  return 12 + octave * 12 + note
}

// Helper function to convert duration to ticks
function durationToTicks(duration: string): number {
  const ticksPerQuarter = 480
  const durations: { [key: string]: number } = {
    whole: ticksPerQuarter * 4,
    half: ticksPerQuarter * 2,
    quarter: ticksPerQuarter,
    eighth: ticksPerQuarter / 2,
    sixteenth: ticksPerQuarter / 4,
  }
  return durations[duration] || ticksPerQuarter
}

// Simple MIDI file generator
function generateMidiBuffer(notes: any[]): Buffer {
  const ticksPerQuarter = 480
  const tempo = 500000 // microseconds per quarter note (120 BPM)

  // MIDI file header
  const header = Buffer.from([
    0x4d,
    0x54,
    0x68,
    0x64, // "MThd"
    0x00,
    0x00,
    0x00,
    0x06, // Header length
    0x00,
    0x00, // Format type 0
    0x00,
    0x01, // Number of tracks
    (ticksPerQuarter >> 8) & 0xff,
    ticksPerQuarter & 0xff, // Division
  ])

  // Build track data
  let trackData = Buffer.alloc(0)

  // Set tempo
  const tempoData = Buffer.from([
    0x00, // Delta time
    0xff,
    0x51,
    0x03, // Meta event: Set Tempo
    (tempo >> 16) & 0xff,
    (tempo >> 8) & 0xff,
    tempo & 0xff,
  ])
  trackData = Buffer.concat([trackData, tempoData])

  // Add notes
  for (const note of notes) {
    const midiNote = noteToMidi(note.pitch)
    const duration = durationToTicks(note.duration)
    const velocity = note.velocity || 100

    // Note on
    const noteOnData = Buffer.from([
      0x00, // Delta time
      0x90, // Note on
      midiNote & 0xff,
      velocity & 0xff,
    ])
    trackData = Buffer.concat([trackData, noteOnData])

    // Note off
    const noteOffData = Buffer.from([
      (duration >> 8) & 0xff,
      duration & 0xff, // Delta time (variable length)
      0x80, // Note off
      midiNote & 0xff,
      0x40, // Velocity
    ])
    trackData = Buffer.concat([trackData, noteOffData])
  }

  // End of track
  const endOfTrack = Buffer.from([
    0x00, // Delta time
    0xff,
    0x2f,
    0x00, // Meta event: End of Track
  ])
  trackData = Buffer.concat([trackData, endOfTrack])

  // Track header
  const trackHeader = Buffer.from([
    0x4d,
    0x54,
    0x72,
    0x6b, // "MTrk"
    (trackData.length >> 24) & 0xff,
    (trackData.length >> 16) & 0xff,
    (trackData.length >> 8) & 0xff,
    trackData.length & 0xff,
  ])

  return Buffer.concat([header, trackHeader, trackData])
}

export async function POST(request: NextRequest) {
  try {
    const recognitionData = await request.json()
    const notes = recognitionData.notes || []

    if (notes.length === 0) {
      return NextResponse.json({ error: "No notes to convert" }, { status: 400 })
    }

    const midiBuffer = generateMidiBuffer(notes)

    return new NextResponse(midiBuffer, {
      headers: {
        "Content-Type": "audio/midi",
        "Content-Disposition": 'attachment; filename="output.mid"',
      },
    })
  } catch (error) {
    console.error("MIDI generation error:", error)
    return NextResponse.json({ error: "Failed to generate MIDI file" }, { status: 500 })
  }
}
