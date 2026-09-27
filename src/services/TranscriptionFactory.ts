import type {
  ITranscriber,
  ICorrector,
  ITranscriptionService,
  TranscriptionMode,
  CorrectionMode,
  ServiceMode,
} from '@/types/transcription'
import { BrowserBuiltinService } from './BrowserBuiltinService'
import { GroqTranscriptionService } from './GroqTranscriptionService'

export class TranscriptionFactory {
  /**
   * Resolves and returns the appropriate speech transcriber service.
   */
  static createTranscriber(mode: TranscriptionMode, apiKey?: string): ITranscriber {
    if (mode === 'groq') {
      if (!apiKey || !apiKey.trim()) {
        throw new Error('Groq API ключ обов’язковий для розпізнавання через Groq.')
      }
      return new GroqTranscriptionService(apiKey.trim())
    }

    return new BrowserBuiltinService()
  }

  /**
   * Resolves and returns the appropriate text correction / editing service.
   */
  static createCorrector(mode: CorrectionMode, apiKey?: string): ICorrector {
    if (mode === 'none') {
      return {
        correct: async (text: string) => text,
      }
    }

    if (mode === 'groq') {
      if (!apiKey || !apiKey.trim()) {
        throw new Error('Groq API ключ обов’язковий для AI-корекції через Groq.')
      }
      return new GroqTranscriptionService(apiKey.trim())
    }

    return new BrowserBuiltinService()
  }

  /**
   * Resolves and returns the combined service for backwards compatibility.
   */
  static create(mode: ServiceMode, apiKey?: string): ITranscriptionService {
    if (mode === 'groq') {
      if (!apiKey || !apiKey.trim()) {
        throw new Error('Groq API ключ обов’язковий для режиму Groq.')
      }
      return new GroqTranscriptionService(apiKey.trim())
    }

    return new BrowserBuiltinService()
  }
}
