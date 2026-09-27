export type TranscriptionMode = 'browser' | 'groq'
export type CorrectionMode = 'groq' | 'local' | 'none'

export type ServiceMode = 'groq' | 'mock' | 'browser'

export type PipelineStatus =
  'idle' | 'recording' | 'transcribing' | 'correcting' | 'completed' | 'error'

export interface ITranscriber {
  transcribe(audioBlob: Blob): Promise<string>
}

export interface ICorrector {
  correct(rawText: string): Promise<string>
}

export interface ITranscriptionService extends ITranscriber, ICorrector {}

export interface TranscriptionResult {
  id?: string
  rawText: string
  processedText: string
  durationMs: number
}

export interface SavedTranscription {
  id: string
  createdAt: number
  processedText: string
  rawText: string
  durationMs: number
  title?: string
}
