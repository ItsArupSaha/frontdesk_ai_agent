/**
 * Tests for CallRow.tsx — specifically the audio player visibility.
 */
import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import CallRow from '../components/CallRow'
import type { CallLog } from '../lib/api'

const baseCall: CallLog = {
  id: '1',
  call_id: 'vapi_1',
  caller_number: '+15550001234',
  started_at: '2024-03-10T14:00:00+00:00',
  ended_at: '2024-03-10T14:03:00+00:00',
  was_emergency: false,
  was_booked: true,
  summary: 'Caller booked plumbing repair.',
  transcript: [
    { role: 'user', content: 'Hi I need a plumber' },
    { role: 'assistant', content: 'Sure, let me check availability.' },
  ],
  status: 'completed',
  duration_seconds: 180,
  recording_url: null,
}

function renderInTable(call: CallLog) {
  return render(
    <table>
      <tbody>
        <CallRow call={call} />
      </tbody>
    </table>,
  )
}

describe('CallRow', () => {
  it('renders collapsed by default', () => {
    renderInTable(baseCall)
    expect(screen.getByTestId('call-row')).toBeInTheDocument()
    expect(screen.queryByTestId('call-row-expanded')).not.toBeInTheDocument()
  })

  it('expands when clicked', () => {
    renderInTable(baseCall)
    fireEvent.click(screen.getByTestId('call-row'))
    expect(screen.getByTestId('call-row-expanded')).toBeInTheDocument()
  })

  it('hides audio player when recording_url is null', () => {
    renderInTable(baseCall)
    fireEvent.click(screen.getByTestId('call-row'))
    expect(screen.queryByTestId('call-audio-player')).not.toBeInTheDocument()
  })

  it('shows audio player when recording_url is present', () => {
    const callWithRecording: CallLog = {
      ...baseCall,
      recording_url: 'https://recordings.vapi.ai/call_xyz.mp3',
    }
    renderInTable(callWithRecording)
    fireEvent.click(screen.getByTestId('call-row'))
    const player = screen.getByTestId('call-audio-player')
    expect(player).toBeInTheDocument()
    expect(player).toHaveAttribute('src', 'https://recordings.vapi.ai/call_xyz.mp3')
  })

  it('shows transcript lines on expand', () => {
    renderInTable(baseCall)
    fireEvent.click(screen.getByTestId('call-row'))
    expect(screen.getByText('Hi I need a plumber')).toBeInTheDocument()
    expect(screen.getByText('Sure, let me check availability.')).toBeInTheDocument()
  })

  it('shows summary when present', () => {
    renderInTable(baseCall)
    fireEvent.click(screen.getByTestId('call-row'))
    // Summary text appears in both the collapsed row cell and the expanded section.
    const matches = screen.getAllByText('Caller booked plumbing repair.')
    expect(matches.length).toBeGreaterThanOrEqual(1)
  })
})
