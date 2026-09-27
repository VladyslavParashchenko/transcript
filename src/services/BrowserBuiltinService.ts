import type { ITranscriptionService } from '@/types/transcription'

// Type declaration for browser SpeechRecognition APIs
interface IWindowSpeechRecognition extends Window {
  SpeechRecognition?: {
    new (): SpeechRecognitionInstance
  }
  webkitSpeechRecognition?: {
    new (): SpeechRecognitionInstance
  }
}

interface SpeechRecognitionInstance {
  lang: string
  continuous: boolean
  interimResults: boolean
  onresult: ((event: SpeechRecognitionEvent) => void) | null
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null
  onend: (() => void) | null
  start(): void
  stop(): void
  abort(): void
}

interface SpeechRecognitionEvent {
  resultIndex?: number
  results: {
    length: number
    [index: number]: {
      [index: number]: {
        transcript: string
      }
      isFinal?: boolean
    }
  }
}

interface SpeechRecognitionErrorEvent {
  error: string
  message?: string
}

export class BrowserBuiltinService implements ITranscriptionService {
  private static activeRecognition: SpeechRecognitionInstance | null = null
  private static accumulatedTranscript = ''
  private static isListening = false
  private static recognitionError: string | null = null

  /**
   * Starts real-time Web Speech recognition concurrent with microphone recording
   */
  static startListening(): void {
    const win =
      typeof window !== 'undefined' ? (window as unknown as IWindowSpeechRecognition) : undefined
    const SpeechRecognitionClass = win?.SpeechRecognition || win?.webkitSpeechRecognition

    if (!SpeechRecognitionClass) {
      this.recognitionError = 'Ваш браузер не підтримує розпізнавання мовлення.'
      return
    }

    try {
      this.accumulatedTranscript = ''
      this.recognitionError = null
      const recognition = new SpeechRecognitionClass()
      recognition.lang = 'uk-UA'
      recognition.continuous = true
      recognition.interimResults = true

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        for (let i = event.resultIndex ?? 0; i < event.results.length; i++) {
          const res = event.results[i]
          const piece = res[0]?.transcript
          if (res?.isFinal && piece) {
            this.accumulatedTranscript += `${this.accumulatedTranscript ? ' ' : ''}${piece.trim()}`
          }
        }
      }

      recognition.onerror = (event) => {
        this.recognitionError = event.message || `Помилка розпізнавання мовлення: ${event.error}`
      }

      recognition.onend = () => {
        this.isListening = false
      }

      recognition.start()
      this.activeRecognition = recognition
      this.isListening = true
    } catch {
      this.activeRecognition = null
      this.isListening = false
      this.recognitionError = 'Не вдалося запустити браузерне розпізнавання мовлення.'
    }
  }

  /**
   * Stops Web Speech recognition and returns any captured text
   */
  static stopListening(): Promise<string> {
    return new Promise((resolve) => {
      if (!this.activeRecognition || !this.isListening) {
        resolve(this.accumulatedTranscript)
        return
      }

      const rec = this.activeRecognition
      this.activeRecognition = null
      this.isListening = false

      try {
        rec.stop()
      } catch {
        // ignore
      }

      // Small delay to allow any final speech result packets to be dispatched
      setTimeout(() => {
        resolve(this.accumulatedTranscript)
      }, 250)
    })
  }

  static reset(): void {
    if (this.activeRecognition) {
      try {
        this.activeRecognition.abort()
      } catch {
        // ignore
      }
      this.activeRecognition = null
    }
    this.isListening = false
    this.accumulatedTranscript = ''
    this.recognitionError = null
  }

  /**
   * Return text captured by Web Speech API. Audio cannot be transcribed locally,
   * so a failed browser recognition must not be represented as a real result.
   */
  async transcribe(_audioBlob: Blob): Promise<string> {
    // If Web Speech API captured live audio during recording, use that real text!
    if (BrowserBuiltinService.accumulatedTranscript.trim()) {
      const text = BrowserBuiltinService.accumulatedTranscript.trim()
      BrowserBuiltinService.accumulatedTranscript = ''
      return text
    }

    throw new Error(
      BrowserBuiltinService.recognitionError ||
        'Браузер не підтримує розпізнавання мовлення або не вдалося розпізнати запис.'
    )
  }

  /**
   * Correct text with naive capitalization and punctuation formatting without network requests
   */
  async correct(rawText: string): Promise<string> {
    // Simulate brief latency for realistic pipeline feel
    await new Promise((resolve) => setTimeout(resolve, 350))

    if (!rawText || !rawText.trim()) {
      return ''
    }

    const trimmed = rawText.trim()

    // Naive sentence capitalization
    let formatted = trimmed.replace(
      /(^\s*|\.\s+|!\s+|\?\s+)([a-zа-яіїєґ])/gu,
      (_, prefix, char) => {
        return `${prefix}${char.toUpperCase()}`
      }
    )

    // Ensure ending punctuation
    if (!/[.!?…]$/.test(formatted)) {
      formatted += '.'
    }

    return formatted
  }
}
