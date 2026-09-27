import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest'
import { useAudioRecorder } from '@/composables/useAudioRecorder'

describe('useAudioRecorder Hardware Lifecycle', () => {
  let mockTrackStop: Mock<() => void>
  let mockStream: { getTracks: () => { stop: () => void }[] }
  let mockCloseAudioCtx: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.restoreAllMocks()

    mockTrackStop = vi.fn<() => void>()
    mockStream = {
      getTracks: () => [{ stop: mockTrackStop }, { stop: mockTrackStop }],
    }

    mockCloseAudioCtx = vi.fn().mockResolvedValue(undefined)

    // Mock navigator.mediaDevices.getUserMedia
    Object.defineProperty(global.navigator, 'mediaDevices', {
      value: {
        getUserMedia: vi.fn().mockResolvedValue(mockStream),
      },
      configurable: true,
    })

    // Mock AudioContext
    class MockAnalyserNode {
      fftSize = 64
      frequencyBinCount = 32
      getByteFrequencyData() {}
    }

    class MockAudioContext {
      state = 'running'
      resume = vi.fn().mockResolvedValue(undefined)
      createAnalyser = vi.fn().mockReturnValue(new MockAnalyserNode())
      createMediaStreamSource = vi.fn().mockReturnValue({
        connect: vi.fn(),
      })
      close = mockCloseAudioCtx
    }

    // @ts-expect-error mock window AudioContext
    window.AudioContext = MockAudioContext

    // Mock MediaRecorder
    class MockMediaRecorder {
      state = 'inactive'
      mimeType = 'audio/webm'
      ondataavailable: ((event: { data: Blob }) => void) | null = null
      onstop: (() => void) | null = null
      onerror: ((err: unknown) => void) | null = null

      static isTypeSupported() {
        return true
      }

      start() {
        this.state = 'recording'
      }

      stop() {
        this.state = 'inactive'
        if (this.ondataavailable) {
          this.ondataavailable({ data: new Blob(['audio-slice'], { type: 'audio/webm' }) })
        }
        if (this.onstop) {
          this.onstop()
        }
      }
    }

    // @ts-expect-error mock window MediaRecorder
    window.MediaRecorder = MockMediaRecorder
  })

  it('starts audio recording and connects AnalyserNode', async () => {
    const recorder = useAudioRecorder()

    expect(recorder.isRecording.value).toBe(false)
    expect(recorder.analyserNode.value).toBeNull()

    await recorder.start()

    expect(recorder.isRecording.value).toBe(true)
    expect(recorder.analyserNode.value).not.toBeNull()
    expect(recorder.analyserNode.value?.fftSize).toBe(64)
  })

  it('verifies Clean Hardware Teardown: halting all tracks and closing AudioContext on stop', async () => {
    const recorder = useAudioRecorder()

    await recorder.start()
    expect(recorder.isRecording.value).toBe(true)

    const blob = await recorder.stop()

    expect(recorder.isRecording.value).toBe(false)
    expect(recorder.analyserNode.value).toBeNull()
    expect(blob).toBeInstanceOf(Blob)

    // CRITICAL: Acceptance criteria: Clean Hardware Teardown
    // Stopping a recording immediately releases the microphone indicator in the browser
    expect(mockTrackStop).toHaveBeenCalledTimes(2)
    expect(mockCloseAudioCtx).toHaveBeenCalledTimes(1)
  })

  it('measures the microphone capture duration rather than processing time', async () => {
    const now = vi.spyOn(performance, 'now')
    now.mockReturnValueOnce(100).mockReturnValueOnce(3450)
    const recorder = useAudioRecorder()

    await recorder.start()
    await recorder.stop()

    expect(recorder.durationMs.value).toBe(3350)
  })
})
