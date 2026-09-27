import { ref, shallowRef, getCurrentInstance, onUnmounted, type Ref, type ShallowRef } from 'vue'

export interface UseAudioRecorderReturn {
  isRecording: Ref<boolean>
  audioBlob: Ref<Blob | null>
  durationMs: Ref<number>
  analyserNode: ShallowRef<AnalyserNode | null>
  start: () => Promise<void>
  stop: () => Promise<Blob>
}

export function useAudioRecorder(): UseAudioRecorderReturn {
  const isRecording = ref<boolean>(false)
  const audioBlob = ref<Blob | null>(null)
  const durationMs = ref<number>(0)
  const analyserNode = shallowRef<AnalyserNode | null>(null)

  let mediaStream: MediaStream | null = null
  let audioContext: AudioContext | null = null
  let mediaRecorder: MediaRecorder | null = null
  let chunks: Blob[] = []
  let recordingStartedAt: number | null = null

  function getOptimalMimeType(): string {
    if (typeof MediaRecorder === 'undefined') return ''
    const candidateTypes = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/mp4',
      'audio/ogg;codecs=opus',
      'audio/wav',
    ]
    for (const type of candidateTypes) {
      if (MediaRecorder.isTypeSupported(type)) {
        return type
      }
    }
    return ''
  }

  const start = async (): Promise<void> => {
    if (isRecording.value) return

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error('Ваш браузер не підтримує запис аудіо (getUserMedia).')
    }

    chunks = []
    audioBlob.value = null
    durationMs.value = 0

    try {
      mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      })

      const AudioCtxClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      audioContext = new AudioCtxClass()

      // Ensure audio context is running (some browsers start in suspended state)
      if (audioContext.state === 'suspended') {
        await audioContext.resume()
      }

      const analyser = audioContext.createAnalyser()
      analyser.fftSize = 64
      const source = audioContext.createMediaStreamSource(mediaStream)
      source.connect(analyser)
      analyserNode.value = analyser

      const mimeType = getOptimalMimeType()
      const options = mimeType ? { mimeType } : undefined
      mediaRecorder = new MediaRecorder(mediaStream, options)

      mediaRecorder.ondataavailable = (event: BlobEvent) => {
        if (event.data && event.data.size > 0) {
          chunks.push(event.data)
        }
      }

      mediaRecorder.start(100)
      recordingStartedAt = performance.now()
      isRecording.value = true
    } catch (err) {
      // Clean up in case of failure during initialization
      if (mediaStream) {
        mediaStream.getTracks().forEach((track) => track.stop())
        mediaStream = null
      }
      if (audioContext && audioContext.state !== 'closed') {
        await audioContext.close()
        audioContext = null
      }
      analyserNode.value = null
      recordingStartedAt = null
      isRecording.value = false
      throw err
    }
  }

  const stop = (): Promise<Blob> => {
    return new Promise<Blob>((resolve, reject) => {
      if (!mediaRecorder || mediaRecorder.state === 'inactive') {
        isRecording.value = false
        analyserNode.value = null
        recordingStartedAt = null
        if (audioBlob.value) {
          resolve(audioBlob.value)
        } else {
          resolve(new Blob([], { type: 'audio/webm' }))
        }
        return
      }

      mediaRecorder.onerror = (e) => {
        reject(e)
      }

      mediaRecorder.onstop = async () => {
        const mimeType = mediaRecorder?.mimeType || 'audio/webm'
        const finalBlob = new Blob(chunks, { type: mimeType })
        audioBlob.value = finalBlob
        durationMs.value =
          recordingStartedAt === null ? 0 : Math.round(performance.now() - recordingStartedAt)
        recordingStartedAt = null
        isRecording.value = false
        analyserNode.value = null

        // Clean hardware teardown: Halt all audio tracks to immediately release microphone indicator
        if (mediaStream) {
          mediaStream.getTracks().forEach((track) => {
            track.stop()
          })
          mediaStream = null
        }

        // Close AudioContext
        if (audioContext && audioContext.state !== 'closed') {
          try {
            await audioContext.close()
          } catch {
            // Ignore potential close errors
          }
          audioContext = null
        }

        resolve(finalBlob)
      }

      mediaRecorder.stop()
    })
  }

  // Ensure teardown if component unmounts during active recording
  if (getCurrentInstance()) {
    onUnmounted(() => {
      if (mediaStream) {
        mediaStream.getTracks().forEach((track) => track.stop())
        mediaStream = null
      }
      if (audioContext && audioContext.state !== 'closed') {
        audioContext.close().catch(() => {})
        audioContext = null
      }
    })
  }

  return {
    isRecording,
    audioBlob,
    durationMs,
    analyserNode,
    start,
    stop,
  }
}
