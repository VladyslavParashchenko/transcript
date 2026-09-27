import type { ITranscriptionService } from '@/types/transcription'

export class GroqTranscriptionService implements ITranscriptionService {
  private readonly apiKey: string
  private readonly baseUrl = 'https://api.groq.com/openai/v1'

  constructor(apiKey: string) {
    if (!apiKey || !apiKey.trim()) {
      throw new Error('Groq API key is required to initialize GroqTranscriptionService.')
    }
    this.apiKey = apiKey.trim()
  }

  /**
   * Transcribe an audio blob using Groq's Whisper API (whisper-large-v3-turbo with fallback to whisper-large-v3)
   */
  async transcribe(audioBlob: Blob): Promise<string> {
    const mimeType = audioBlob.type || 'audio/webm'
    const extension = mimeType.includes('mp4') ? 'mp4' : 'webm'
    const filename = `recording.${extension}`

    const fileToUpload =
      typeof File !== 'undefined' && !(audioBlob instanceof File)
        ? new File([audioBlob], filename, { type: mimeType })
        : audioBlob

    const whisperModels = ['whisper-large-v3-turbo', 'whisper-large-v3']
    let lastError: Error | null = null

    for (const model of whisperModels) {
      try {
        const formData = new FormData()
        formData.append('file', fileToUpload, filename)
        formData.append('model', model)
        formData.append('language', 'uk')

        const response = await fetch(`${this.baseUrl}/audio/transcriptions`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
          },
          body: formData,
        })

        if (!response.ok) {
          let errorMessage = `Помилка розпізнавання аудіо (${response.status})`
          try {
            const errorData = await response.json()
            if (errorData?.error?.message) {
              errorMessage = errorData.error.message
            }
          } catch {
            if (response.statusText) {
              errorMessage = `${errorMessage}: ${response.statusText}`
            }
          }

          const isModelUnavailable =
            response.status === 404 ||
            response.status === 400 ||
            errorMessage.includes('does not exist') ||
            errorMessage.includes('do not have access') ||
            errorMessage.includes('decommissioned') ||
            errorMessage.includes('deprecated')

          if (isModelUnavailable) {
            lastError = new Error(errorMessage)
            continue
          }

          throw new Error(errorMessage)
        }

        const data = await response.json()
        return data.text || ''
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err))
        const isModelUnavailable =
          lastError.message.includes('does not exist') ||
          lastError.message.includes('do not have access') ||
          lastError.message.includes('decommissioned') ||
          lastError.message.includes('deprecated')

        if (!isModelUnavailable) {
          throw lastError
        }
      }
    }

    throw lastError || new Error('Не вдалося розпізнати аудіо жодною з моделей Whisper на Groq.')
  }

  /**
   * Polish and correct raw transcribed text using Groq's Llama model
   */
  async correct(rawText: string): Promise<string> {
    if (!rawText || !rawText.trim()) {
      return ''
    }

    const candidateModels = ['llama-3.1-8b-instant', 'llama-3.3-70b-versatile', 'llama3-8b-8192']

    let lastError: Error | null = null

    for (const model of candidateModels) {
      try {
        const response = await fetch(`${this.baseUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model,
            temperature: 0.2,
            messages: [
              {
                role: 'system',
                content:
                  'Ти редактор. Твоє завдання: взяти сирий розпізнаний текст голосової нотатки українською мовою, розставити правильні розділові знаки, виправити явні помилки розпізнавання слів та оформити текст зрозумілими абзацами. Зберігай оригінальний тон та лексику автора, видаляючи лише слова-паразити та звуки роздумів (е-е-е, ну-у-у). Повертай ТІЛЬКИ відредагований текст без жодних передмов чи пояснень.',
              },
              {
                role: 'user',
                content: rawText,
              },
            ],
          }),
        })

        if (!response.ok) {
          let errorMessage = `Помилка AI-редагування тексту (${response.status})`
          try {
            const errorData = await response.json()
            if (errorData?.error?.message) {
              errorMessage = errorData.error.message
            }
          } catch {
            if (response.statusText) {
              errorMessage = `${errorMessage}: ${response.statusText}`
            }
          }

          // If this specific model does not exist or user lacks access, try next candidate
          const isModelMissingError =
            response.status === 404 ||
            response.status === 400 ||
            errorMessage.includes('does not exist') ||
            errorMessage.includes('do not have access') ||
            errorMessage.includes('decommissioned') ||
            errorMessage.includes('deprecated')

          if (isModelMissingError) {
            lastError = new Error(errorMessage)
            continue
          }

          throw new Error(errorMessage)
        }

        const data = await response.json()
        const content = data.choices?.[0]?.message?.content
        return typeof content === 'string' ? content.trim() : ''
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err))
        const isModelMissingError =
          lastError.message.includes('does not exist') ||
          lastError.message.includes('do not have access') ||
          lastError.message.includes('decommissioned') ||
          lastError.message.includes('deprecated')

        if (!isModelMissingError) {
          throw lastError
        }
      }
    }

    throw lastError || new Error('Не вдалося виконати редагування жодною з доступних моделей Groq.')
  }
}
