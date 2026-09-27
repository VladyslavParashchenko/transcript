import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useTranscription } from '@/composables/useTranscription'

describe('useTranscription Composable', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
  })

  it('initializes in mock mode by default providing Zero-Key Dev Experience', () => {
    const { status, serviceMode, apiKey, result } = useTranscription()
    expect(serviceMode.value).toBe('mock')
    expect(status.value).toBe('idle')
    expect(apiKey.value).toBe('')
    expect(result.value).toBeNull()
  })

  it('reports an error instead of fabricating text when browser recognition is unavailable', async () => {
    const transcription = useTranscription()

    // Mock internal recorder methods
    vi.spyOn(transcription.recorder, 'start').mockResolvedValue()
    vi.spyOn(transcription.recorder, 'stop').mockResolvedValue(
      new Blob(['audio bytes'], { type: 'audio/webm' })
    )

    // 1. Start recording
    await transcription.startRecording()
    expect(transcription.status.value).toBe('recording')

    // 2. Stop recording and await pipeline completion
    await transcription.stopRecording()

    expect(transcription.status.value).toBe('error')
    expect(transcription.result.value).toBeNull()
    expect(transcription.errorMessage.value).toContain('не підтримує розпізнавання')
  })

  it('suspends pipeline in groq mode when API key is missing and resumes after key submission (Deferred Key Prompt)', async () => {
    const transcription = useTranscription()
    transcription.setServiceMode('groq')

    // Ensure no key is set
    expect(transcription.apiKey.value).toBe('')

    // Mock audio recorder stop returning audio
    vi.spyOn(transcription.recorder, 'start').mockResolvedValue()
    vi.spyOn(transcription.recorder, 'stop').mockResolvedValue(
      new Blob(['recorded audio data'], { type: 'audio/webm' })
    )

    // Mock fetch for Groq API
    global.fetch = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes('audio/transcriptions')) {
        return {
          ok: true,
          json: async () => ({ text: 'тестовий текст з аудіо' }),
        } as Response
      }
      if (url.includes('chat/completions')) {
        return {
          ok: true,
          json: async () => ({
            choices: [{ message: { content: 'Тестовий текст з аудіо.' } }],
          }),
        } as Response
      }
      return { ok: false } as Response
    })

    await transcription.startRecording()
    expect(transcription.status.value).toBe('recording')

    // Trigger stopRecording() - this will suspend and open the settings modal
    const stopPromise = transcription.stopRecording()
    await Promise.resolve()

    // Verify modal is opened for deferred key input
    expect(transcription.isSettingsModalOpen.value).toBe(true)

    // User submits key via submitApiKey
    transcription.submitApiKey('gsk_deferred_test_key')

    // Await completion of pipeline
    await stopPromise

    expect(transcription.apiKey.value).toBe('gsk_deferred_test_key')
    expect(localStorage.getItem('groq_api_key')).toBe('gsk_deferred_test_key')
    expect(transcription.status.value).toBe('completed')
    expect(transcription.result.value?.processedText).toBe('Тестовий текст з аудіо.')
  })

  it('handles cancellation of deferred modal by reporting error without breaking app state', async () => {
    const transcription = useTranscription()
    transcription.setServiceMode('groq')

    vi.spyOn(transcription.recorder, 'start').mockResolvedValue()
    vi.spyOn(transcription.recorder, 'stop').mockResolvedValue(
      new Blob(['audio bytes'], { type: 'audio/webm' })
    )

    await transcription.startRecording()
    const stopPromise = transcription.stopRecording()
    await Promise.resolve()

    expect(transcription.isSettingsModalOpen.value).toBe(true)

    // User cancels
    transcription.cancelApiKeyPrompt()

    await stopPromise

    expect(transcription.status.value).toBe('error')
    expect(transcription.errorMessage.value).toContain('скасовано')
    expect(transcription.isSettingsModalOpen.value).toBe(false)

    // Can clear error
    transcription.clearError()
    expect(transcription.status.value).toBe('idle')
    expect(transcription.errorMessage.value).toBeNull()
  })

  it('updates processedText dynamically when user edits it', () => {
    const transcription = useTranscription()
    transcription.result.value = {
      rawText: 'початковий текст',
      processedText: 'Початковий текст.',
      durationMs: 120,
    }

    transcription.updateProcessedText('Відредагований вручну текст.')
    expect(transcription.result.value?.processedText).toBe('Відредагований вручну текст.')
    expect(transcription.result.value?.rawText).toBe('початковий текст')
  })

  it('allows setting transcriptionMode and correctionMode independently', () => {
    const transcription = useTranscription()
    expect(transcription.transcriptionMode.value).toBe('browser')
    expect(transcription.correctionMode.value).toBe('local')

    transcription.setTranscriptionMode('groq')
    expect(transcription.transcriptionMode.value).toBe('groq')
    expect(transcription.correctionMode.value).toBe('local')

    transcription.setCorrectionMode('none')
    expect(transcription.correctionMode.value).toBe('none')
    expect(transcription.transcriptionMode.value).toBe('groq')
  })
})
