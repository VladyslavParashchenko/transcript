import { ref, type Ref } from 'vue'
import type {
  PipelineStatus,
  ServiceMode,
  TranscriptionMode,
  CorrectionMode,
  TranscriptionResult,
  SavedTranscription,
} from '@/types/transcription'
import { TranscriptionFactory } from '@/services/TranscriptionFactory'
import { BrowserBuiltinService } from '@/services/BrowserBuiltinService'
import { useAudioRecorder, type UseAudioRecorderReturn } from './useAudioRecorder'

export interface UseTranscriptionReturn {
  status: Ref<PipelineStatus>
  serviceMode: Ref<ServiceMode>
  transcriptionMode: Ref<TranscriptionMode>
  correctionMode: Ref<CorrectionMode>
  apiKey: Ref<string>
  result: Ref<TranscriptionResult | null>
  errorMessage: Ref<string | null>
  isSettingsModalOpen: Ref<boolean>
  recorder: UseAudioRecorderReturn

  startRecording: () => Promise<void>
  stopRecording: () => Promise<void>
  setServiceMode: (mode: ServiceMode) => void
  setTranscriptionMode: (mode: TranscriptionMode) => void
  setCorrectionMode: (mode: CorrectionMode) => void
  submitApiKey: (newKey: string) => void
  cancelApiKeyPrompt: () => void
  openSettings: () => void
  closeSettings: () => void
  clearError: () => void
  resetPipeline: () => void
  updateProcessedText: (text: string) => void
  loadSavedTranscription: (item: SavedTranscription) => void
}

const GROQ_API_KEY_STORAGE = 'groq_api_key'
const SERVICE_MODE_STORAGE = 'transcription_service_mode'
const TRANSCRIPTION_MODE_STORAGE = 'transcription_service_provider'
const CORRECTION_MODE_STORAGE = 'correction_service_provider'

export function useTranscription(): UseTranscriptionReturn {
  const recorder = useAudioRecorder()

  const status = ref<PipelineStatus>('idle')
  const serviceMode = ref<ServiceMode>(
    (localStorage.getItem(SERVICE_MODE_STORAGE) as ServiceMode) || 'mock'
  )

  const initialTranscriptionMode =
    (localStorage.getItem(TRANSCRIPTION_MODE_STORAGE) as TranscriptionMode) ||
    (serviceMode.value === 'groq' ? 'groq' : 'browser')

  const initialCorrectionMode =
    (localStorage.getItem(CORRECTION_MODE_STORAGE) as CorrectionMode) ||
    (serviceMode.value === 'groq' ? 'groq' : 'local')

  const transcriptionMode = ref<TranscriptionMode>(initialTranscriptionMode)
  const correctionMode = ref<CorrectionMode>(initialCorrectionMode)

  const apiKey = ref<string>(localStorage.getItem(GROQ_API_KEY_STORAGE) || '')
  const result = ref<TranscriptionResult | null>(null)
  const errorMessage = ref<string | null>(null)
  const isSettingsModalOpen = ref<boolean>(false)

  // Deferred promise resolver/rejecter for missing API key resolution
  let pendingApiKeyResolver: ((key: string) => void) | null = null
  let pendingApiKeyRejecter: ((reason?: unknown) => void) | null = null

  const syncServiceMode = (): void => {
    if (transcriptionMode.value === 'groq' && correctionMode.value === 'groq') {
      serviceMode.value = 'groq'
    } else {
      serviceMode.value = 'mock'
    }
    localStorage.setItem(SERVICE_MODE_STORAGE, serviceMode.value)
  }

  const setTranscriptionMode = (mode: TranscriptionMode): void => {
    transcriptionMode.value = mode
    localStorage.setItem(TRANSCRIPTION_MODE_STORAGE, mode)
    syncServiceMode()
  }

  const setCorrectionMode = (mode: CorrectionMode): void => {
    correctionMode.value = mode
    localStorage.setItem(CORRECTION_MODE_STORAGE, mode)
    syncServiceMode()
  }

  const setServiceMode = (mode: ServiceMode): void => {
    serviceMode.value = mode
    localStorage.setItem(SERVICE_MODE_STORAGE, mode)
    if (mode === 'groq') {
      transcriptionMode.value = 'groq'
      correctionMode.value = 'groq'
      localStorage.setItem(TRANSCRIPTION_MODE_STORAGE, 'groq')
      localStorage.setItem(CORRECTION_MODE_STORAGE, 'groq')
    } else {
      transcriptionMode.value = 'browser'
      correctionMode.value = 'local'
      localStorage.setItem(TRANSCRIPTION_MODE_STORAGE, 'browser')
      localStorage.setItem(CORRECTION_MODE_STORAGE, 'local')
    }
  }

  const openSettings = (): void => {
    isSettingsModalOpen.value = true
  }

  const closeSettings = (): void => {
    cancelApiKeyPrompt()
  }

  const clearError = (): void => {
    errorMessage.value = null
    if (status.value === 'error') {
      status.value = 'idle'
    }
  }

  const resetPipeline = (): void => {
    BrowserBuiltinService.reset()
    status.value = 'idle'
    errorMessage.value = null
    result.value = null
  }

  const updateProcessedText = (newText: string): void => {
    if (result.value) {
      result.value = {
        ...result.value,
        processedText: newText,
      }
    }
  }

  const submitApiKey = (newKey: string): void => {
    const trimmed = newKey.trim()
    apiKey.value = trimmed
    if (trimmed) {
      localStorage.setItem(GROQ_API_KEY_STORAGE, trimmed)
    } else {
      localStorage.removeItem(GROQ_API_KEY_STORAGE)
    }

    isSettingsModalOpen.value = false

    // Resolve deferred pipeline if active
    if (pendingApiKeyResolver) {
      const resolver = pendingApiKeyResolver
      pendingApiKeyResolver = null
      pendingApiKeyRejecter = null
      resolver(trimmed)
    }
  }

  const cancelApiKeyPrompt = (): void => {
    isSettingsModalOpen.value = false
    if (pendingApiKeyRejecter) {
      const rejecter = pendingApiKeyRejecter
      pendingApiKeyResolver = null
      pendingApiKeyRejecter = null
      rejecter(new Error('Введення API ключа було скасовано.'))
    }
  }

  const getOrPromptApiKey = async (): Promise<string> => {
    if (apiKey.value && apiKey.value.trim()) {
      return apiKey.value.trim()
    }

    // Suspend pipeline and open settings modal
    isSettingsModalOpen.value = true
    return new Promise<string>((resolve, reject) => {
      pendingApiKeyResolver = resolve
      pendingApiKeyRejecter = reject
    })
  }

  const startRecording = async (): Promise<void> => {
    clearError()
    result.value = null
    try {
      await recorder.start()
      if (transcriptionMode.value === 'browser') {
        BrowserBuiltinService.startListening()
      }
      status.value = 'recording'
    } catch (err) {
      status.value = 'error'
      errorMessage.value =
        err instanceof Error ? err.message : 'Не вдалося отримати доступ до мікрофона.'
    }
  }

  const stopRecording = async (): Promise<void> => {
    if (status.value !== 'recording') return

    try {
      // 1. Stop audio capture and obtain audio blob. This also records the actual
      // microphone duration before any recognition/finalization delays occur.
      const audioBlob = await recorder.stop()

      if (transcriptionMode.value === 'browser') {
        await BrowserBuiltinService.stopListening()
      }

      if (!audioBlob || audioBlob.size === 0) {
        throw new Error('Аудіозапис порожній.')
      }

      // 2. Determine if Groq API key is required
      const requiresGroqKey = transcriptionMode.value === 'groq' || correctionMode.value === 'groq'

      let keyToUse = apiKey.value
      if (requiresGroqKey) {
        keyToUse = await getOrPromptApiKey()
        if (!keyToUse) {
          throw new Error('Groq API ключ не вказано.')
        }
      }

      // 3. Transcription step (Speech-to-Text)
      status.value = 'transcribing'
      const transcriber = TranscriptionFactory.createTranscriber(transcriptionMode.value, keyToUse)
      const rawText = await transcriber.transcribe(audioBlob)

      if (!rawText || !rawText.trim()) {
        throw new Error('Не вдалося розпізнати мову у записі.')
      }

      // 4. Correction step (Text Formatting / Editing)
      status.value = 'correcting'
      const corrector = TranscriptionFactory.createCorrector(correctionMode.value, keyToUse)
      const processedText = await corrector.correct(rawText)

      // 5. Completed
      result.value = {
        rawText,
        processedText: processedText || rawText,
        durationMs: recorder.durationMs.value,
      }
      status.value = 'completed'
    } catch (err) {
      status.value = 'error'
      errorMessage.value =
        err instanceof Error ? err.message : 'Виникла помилка під час обробки аудіо.'
    }
  }

  const loadSavedTranscription = (item: SavedTranscription): void => {
    result.value = {
      id: item.id,
      rawText: item.rawText,
      processedText: item.processedText,
      durationMs: item.durationMs,
    }
    status.value = 'completed'
    clearError()
  }

  return {
    status,
    serviceMode,
    transcriptionMode,
    correctionMode,
    apiKey,
    result,
    errorMessage,
    isSettingsModalOpen,
    recorder,
    startRecording,
    stopRecording,
    setServiceMode,
    setTranscriptionMode,
    setCorrectionMode,
    submitApiKey,
    cancelApiKeyPrompt,
    openSettings,
    closeSettings,
    clearError,
    resetPipeline,
    updateProcessedText,
    loadSavedTranscription,
  }
}
