import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { TranscriptionFactory } from '@/services/TranscriptionFactory'
import { BrowserBuiltinService } from '@/services/BrowserBuiltinService'
import { GroqTranscriptionService } from '@/services/GroqTranscriptionService'

describe('TranscriptionFactory', () => {
  it('instantiates BrowserBuiltinService when mode is "mock"', () => {
    const service = TranscriptionFactory.create('mock')
    expect(service).toBeInstanceOf(BrowserBuiltinService)
  })

  it('instantiates GroqTranscriptionService when mode is "groq" and apiKey is provided', () => {
    const service = TranscriptionFactory.create('groq', 'gsk_test_key_123')
    expect(service).toBeInstanceOf(GroqTranscriptionService)
  })

  it('throws an error when mode is "groq" but apiKey is missing or whitespace', () => {
    expect(() => TranscriptionFactory.create('groq')).toThrowError(/Groq API ключ/i)
    expect(() => TranscriptionFactory.create('groq', '   ')).toThrowError(/Groq API ключ/i)
  })

  it('creates appropriate transcriber for browser and groq modes', () => {
    const browserTranscriber = TranscriptionFactory.createTranscriber('browser')
    expect(browserTranscriber).toBeInstanceOf(BrowserBuiltinService)

    const groqTranscriber = TranscriptionFactory.createTranscriber('groq', 'gsk_key_123')
    expect(groqTranscriber).toBeInstanceOf(GroqTranscriptionService)

    expect(() => TranscriptionFactory.createTranscriber('groq')).toThrowError(/Groq API ключ/i)
  })

  it('creates appropriate corrector for local, groq, and none modes', async () => {
    const localCorrector = TranscriptionFactory.createCorrector('local')
    expect(localCorrector).toBeInstanceOf(BrowserBuiltinService)

    const groqCorrector = TranscriptionFactory.createCorrector('groq', 'gsk_key_123')
    expect(groqCorrector).toBeInstanceOf(GroqTranscriptionService)

    expect(() => TranscriptionFactory.createCorrector('groq')).toThrowError(/Groq API ключ/i)

    const noneCorrector = TranscriptionFactory.createCorrector('none')
    expect(await noneCorrector.correct('оригінальний текст')).toBe('оригінальний текст')
  })
})

describe('BrowserBuiltinService', () => {
  const service = new BrowserBuiltinService()

  it('fails instead of returning fabricated text when browser recognition is unavailable', async () => {
    const fakeBlob = new Blob(['dummy audio content'], { type: 'audio/webm' })
    await expect(service.transcribe(fakeBlob)).rejects.toThrow('не підтримує розпізнавання')
  })

  it('keeps final results beyond the first 50 speech segments', async () => {
    class FakeRecognition {
      lang = ''
      continuous = false
      interimResults = false
      onresult: ((event: { resultIndex: number; results: unknown[] }) => void) | null = null
      onerror = null
      onend = null
      start() {
        const results = Array.from({ length: 51 }, () => [{ transcript: '' }])
        results[50] = Object.assign([{ transcript: 'пізній сегмент' }], { isFinal: true })
        this.onresult?.({ resultIndex: 50, results })
      }
      stop() {}
      abort() {}
    }
    // @ts-expect-error test-only Web Speech API implementation
    window.SpeechRecognition = FakeRecognition

    BrowserBuiltinService.startListening()
    await BrowserBuiltinService.stopListening()

    await expect(service.transcribe(new Blob(['audio']))).resolves.toBe('пізній сегмент')
    BrowserBuiltinService.reset()
    // @ts-expect-error remove test-only Web Speech API implementation
    delete window.SpeechRecognition
  })

  it('corrects raw text with naive sentence capitalization and ending punctuation', async () => {
    const raw = 'це тестовий запис без розділових знаків для перевірки'
    const corrected = await service.correct(raw)
    expect(corrected).toBe('Це тестовий запис без розділових знаків для перевірки.')
  })

  it('preserves existing terminal punctuation if present', async () => {
    const raw = 'перше речення! друге речення? третє речення.'
    const corrected = await service.correct(raw)
    expect(corrected).toBe('Перше речення! Друге речення? Третє речення.')
  })

  it('handles empty text gracefully', async () => {
    const corrected = await service.correct('')
    expect(corrected).toBe('')
  })
})

describe('GroqTranscriptionService', () => {
  const apiKey = 'gsk_valid_key_test'
  const service = new GroqTranscriptionService(apiKey)

  const originalFetch = global.fetch

  beforeEach(() => {
    vi.restoreAllMocks()
  })

  afterEach(() => {
    global.fetch = originalFetch
  })

  it('sends correct multipart/form-data payload and headers to Groq Whisper endpoint', async () => {
    const mockAudioBlob = new Blob(['test-audio'], { type: 'audio/webm' })

    let capturedUrl = ''
    let capturedOptions: RequestInit | undefined

    global.fetch = vi.fn().mockImplementation(async (url: string, options: RequestInit) => {
      capturedUrl = url
      capturedOptions = options
      return {
        ok: true,
        json: async () => ({ text: 'Розпізнаний український текст' }),
      } as Response
    })

    const result = await service.transcribe(mockAudioBlob)

    expect(result).toBe('Розпізнаний український текст')
    expect(capturedUrl).toBe('https://api.groq.com/openai/v1/audio/transcriptions')
    expect(capturedOptions?.method).toBe('POST')

    const headers = capturedOptions?.headers as Record<string, string>
    expect(headers['Authorization']).toBe(`Bearer ${apiKey}`)

    const body = capturedOptions?.body as FormData
    expect(body).toBeInstanceOf(FormData)
    expect(body.get('model')).toBe('whisper-large-v3-turbo')
    expect(body.get('language')).toBe('uk')
    const file = body.get('file') as File
    expect(file.name).toBe('recording.webm')
  })

  it('sends correct Llama prompt and settings to Groq chat completions endpoint', async () => {
    const rawText = 'привіт як справи це текст без знаків'

    let capturedUrl = ''
    let capturedOptions: RequestInit | undefined

    global.fetch = vi.fn().mockImplementation(async (url: string, options: RequestInit) => {
      capturedUrl = url
      capturedOptions = options
      return {
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: 'Привіт! Як справи? Це текст без знаків.',
              },
            },
          ],
        }),
      } as Response
    })

    const result = await service.correct(rawText)

    expect(result).toBe('Привіт! Як справи? Це текст без знаків.')
    expect(capturedUrl).toBe('https://api.groq.com/openai/v1/chat/completions')
    expect(capturedOptions?.method).toBe('POST')

    const headers = capturedOptions?.headers as Record<string, string>
    expect(headers['Authorization']).toBe(`Bearer ${apiKey}`)
    expect(headers['Content-Type']).toBe('application/json')

    const payload = JSON.parse(capturedOptions?.body as string)
    expect(payload.model).toBe('llama-3.1-8b-instant')
    expect(payload.temperature).toBe(0.2)
    expect(payload.messages).toHaveLength(2)
    expect(payload.messages[0].role).toBe('system')
    expect(payload.messages[0].content).toContain('Ти редактор.')
    expect(payload.messages[1].role).toBe('user')
    expect(payload.messages[1].content).toBe(rawText)
  })

  it('automatically falls back to next candidate model if current model does not exist or user lacks access', async () => {
    const apiKey = 'gsk_fallback_test_key'
    const service = new GroqTranscriptionService(apiKey)
    const attemptedModels: string[] = []

    global.fetch = vi.fn().mockImplementation(async (_url: string, options?: RequestInit) => {
      const payload = JSON.parse(options?.body as string)
      attemptedModels.push(payload.model)

      if (payload.model === 'llama-3.1-8b-instant') {
        return {
          ok: false,
          status: 404,
          json: async () => ({
            error: {
              message:
                'The model `llama-3.1-8b-instant` does not exist or you do not have access to it.',
            },
          }),
        } as Response
      }

      return {
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: 'Успішний результат через резервну модель.',
              },
            },
          ],
        }),
      } as Response
    })

    const result = await service.correct('текст для резерву')
    expect(result).toBe('Успішний результат через резервну модель.')
    expect(attemptedModels[0]).toBe('llama-3.1-8b-instant')
    expect(attemptedModels[1]).toBe('llama-3.3-70b-versatile')
  })

  it('throws descriptive error on Groq API failure', async () => {
    global.fetch = vi.fn().mockImplementation(async () => {
      return {
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        json: async () => ({
          error: {
            message: 'Invalid API Key',
          },
        }),
      } as Response
    })

    const fakeBlob = new Blob(['audio'])
    await expect(service.transcribe(fakeBlob)).rejects.toThrowError('Invalid API Key')
  })
})
