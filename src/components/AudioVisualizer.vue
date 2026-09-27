<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { Mic, CheckCircle2, Volume1, VolumeX, AlertTriangle } from 'lucide-vue-next'

export type AudioQualityState = 'idle' | 'silent' | 'quiet' | 'optimal' | 'loud'

const props = defineProps<{
  analyserNode: AnalyserNode | null
  isRecording: boolean
}>()

const emit = defineEmits<{
  (e: 'qualityChange', quality: AudioQualityState): void
}>()

const canvasRef = ref<HTMLCanvasElement | null>(null)
let animationFrameId: number | null = null

const soundQualityState = ref<AudioQualityState>('idle')
const soundLevelPercent = ref<number>(0)

let smoothedRms = 0
let peakHold = 0
let peakHoldTimer = 0

const qualityIcon = computed(() => {
  if (!props.isRecording) return Mic
  switch (soundQualityState.value) {
    case 'optimal':
      return CheckCircle2
    case 'quiet':
      return Volume1
    case 'loud':
      return AlertTriangle
    case 'silent':
    default:
      return VolumeX
  }
})

const qualityLabel = computed(() => {
  if (!props.isRecording) return 'Мікрофон готовий'
  switch (soundQualityState.value) {
    case 'optimal':
      return 'Оптимальна якість'
    case 'quiet':
      return 'Занадто тихо'
    case 'loud':
      return 'Занадто гучно'
    case 'silent':
    default:
      return 'Тиша (немає звуку)'
  }
})

const badgeClasses = computed(() => {
  if (!props.isRecording) {
    return 'border-slate-800 bg-slate-950/70 text-slate-400'
  }
  switch (soundQualityState.value) {
    case 'optimal':
      return 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300 ring-2 ring-emerald-500/20 shadow-sm shadow-emerald-500/20'
    case 'quiet':
      return 'border-amber-500/40 bg-amber-500/15 text-amber-300 ring-2 ring-amber-500/20'
    case 'loud':
      return 'border-red-500/40 bg-red-500/15 text-red-300 ring-2 ring-red-500/20 animate-pulse'
    case 'silent':
    default:
      return 'border-slate-700/60 bg-slate-800/80 text-slate-400'
  }
})

const qualityHint = computed(() => {
  if (!props.isRecording) {
    return 'Готово до запису. Натисніть кнопку мікрофона вище та говоріть'
  }
  switch (soundQualityState.value) {
    case 'optimal':
      return '✓ Рівень сигналу відмінний для точного розпізнавання мови'
    case 'quiet':
      return '⚠️ Звук занадто тихий — говоріть ближче до мікрофона для кращого результату'
    case 'loud':
      return '⚠️ Сигнал занадто гучний — відійдіть трохи далі від мікрофона'
    case 'silent':
    default:
      return 'ℹ️ Очікування звуку... Говоріть у мікрофон для аналізу якості'
  }
})

const hintTextClass = computed(() => {
  if (!props.isRecording) return 'text-slate-500'
  switch (soundQualityState.value) {
    case 'optimal':
      return 'text-emerald-400/90'
    case 'quiet':
      return 'text-amber-400/90'
    case 'loud':
      return 'text-red-400/90'
    case 'silent':
    default:
      return 'text-slate-400'
  }
})

function getSegmentClass(seg: number): string {
  const threshold = (seg / 10) * 100
  const isActive = soundLevelPercent.value >= threshold
  if (!isActive) return 'bg-slate-800'

  if (seg <= 6) {
    return 'bg-emerald-400 shadow-xs shadow-emerald-400/40'
  } else if (seg <= 8) {
    return 'bg-amber-400 shadow-xs shadow-amber-400/40'
  } else {
    return 'bg-red-500 shadow-xs shadow-red-500/50'
  }
}

function renderIdleState(ctx: CanvasRenderingContext2D, width: number, height: number) {
  ctx.clearRect(0, 0, width, height)

  const centerY = height / 2
  const barCount = Math.min(36, Math.max(20, Math.floor(width / 16)))
  const spacing = 5
  const totalSpacing = (barCount - 1) * spacing
  const barWidth = Math.max(3, (width - totalSpacing - 40) / barCount)
  const startX = (width - (barCount * barWidth + totalSpacing)) / 2

  for (let i = 0; i < barCount; i++) {
    const x = startX + i * (barWidth + spacing)
    const idleHeight = Math.sin((i / (barCount - 1)) * Math.PI) * 14 + 6
    ctx.fillStyle = 'rgba(249, 115, 22, 0.2)'
    ctx.beginPath()
    ctx.roundRect(x, centerY - idleHeight / 2, barWidth, idleHeight, barWidth / 2)
    ctx.fill()
  }
}

function startVisualizer() {
  if (animationFrameId !== null) {
    cancelAnimationFrame(animationFrameId)
    animationFrameId = null
  }

  const canvas = canvasRef.value
  if (!canvas) return

  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const dpr = window.devicePixelRatio || 1
  const rect = canvas.getBoundingClientRect()
  canvas.width = rect.width * dpr
  canvas.height = rect.height * dpr
  ctx.scale(dpr, dpr)

  const width = rect.width
  const height = rect.height

  if (!props.isRecording || !props.analyserNode) {
    renderIdleState(ctx, width, height)
    soundQualityState.value = 'idle'
    soundLevelPercent.value = 0
    return
  }

  const analyser = props.analyserNode
  const bufferLength = analyser.frequencyBinCount
  const dataArray = new Uint8Array(bufferLength)
  const timeArray = new Uint8Array(analyser.fftSize || 64)

  const render = () => {
    if (!props.isRecording || !props.analyserNode) {
      renderIdleState(ctx, width, height)
      soundQualityState.value = 'idle'
      soundLevelPercent.value = 0
      animationFrameId = null
      return
    }

    animationFrameId = requestAnimationFrame(render)
    analyser.getByteFrequencyData(dataArray)

    // Compute Audio Signal Quality
    let sumSquares = 0
    let peak = 0

    if (typeof analyser.getByteTimeDomainData === 'function') {
      analyser.getByteTimeDomainData(timeArray)
      for (let i = 0; i < timeArray.length; i++) {
        const norm = (timeArray[i] - 128) / 128
        const abs = Math.abs(norm)
        if (abs > peak) peak = abs
        sumSquares += norm * norm
      }
    } else {
      for (let i = 0; i < bufferLength; i++) {
        const norm = dataArray[i] / 255
        if (norm > peak) peak = norm
        sumSquares += norm * norm
      }
    }

    const rawRms = Math.sqrt(sumSquares / (timeArray.length || bufferLength))

    // Ballistics: fast attack, smooth decay
    if (rawRms > smoothedRms) {
      smoothedRms = smoothedRms * 0.4 + rawRms * 0.6
    } else {
      smoothedRms = smoothedRms * 0.92 + rawRms * 0.08
    }

    if (peak > peakHold) {
      peakHold = peak
      peakHoldTimer = 30
    } else if (peakHoldTimer > 0) {
      peakHoldTimer--
    } else {
      peakHold = peakHold * 0.94
    }

    // Map to percentage for VU meter
    const percent = Math.min(100, Math.max(0, Math.round(smoothedRms * 220)))
    soundLevelPercent.value = percent

    let nextState: AudioQualityState
    if (smoothedRms < 0.035) {
      nextState = 'silent'
    } else if (smoothedRms < 0.09) {
      nextState = 'quiet'
    } else if (peakHold >= 0.92 || smoothedRms >= 0.65) {
      nextState = 'loud'
    } else {
      nextState = 'optimal'
    }

    if (soundQualityState.value !== nextState) {
      soundQualityState.value = nextState
      emit('qualityChange', nextState)
    }

    // Render Canvas Waveform
    ctx.clearRect(0, 0, width, height)

    const centerY = height / 2
    const numBars = Math.min(36, Math.max(20, Math.floor(width / 16)))
    const barSpacing = 5
    const barWidth = Math.max(3, (width - (numBars - 1) * barSpacing - 32) / numBars)
    const startX = (width - (numBars * barWidth + (numBars - 1) * barSpacing)) / 2
    const maxBarHeight = height * 0.68

    for (let i = 0; i < numBars; i++) {
      const distanceFromCenter = Math.abs(i - numBars / 2) / (numBars / 2)
      const binIndex = Math.min(
        bufferLength - 1,
        Math.floor((1 - distanceFromCenter) * (bufferLength * 0.75))
      )

      const value = dataArray[binIndex] || 0
      const normalized = value / 255
      const barHeight = Math.max(6, normalized * maxBarHeight)
      const alpha = Math.min(1, Math.max(0.35, normalized * 1.3))

      const x = startX + i * (barWidth + barSpacing)
      const y = centerY - barHeight / 2

      // Color reaction based on quality
      let barFill = `rgba(249, 115, 22, ${alpha.toFixed(2)})`
      if (nextState === 'loud' && normalized > 0.6) {
        barFill = `rgba(239, 68, 68, ${Math.min(1, alpha + 0.3).toFixed(2)})`
      } else if (nextState === 'optimal' && normalized > 0.35) {
        barFill = `rgba(245, 158, 11, ${alpha.toFixed(2)})`
      }

      ctx.fillStyle = barFill
      ctx.beginPath()
      ctx.roundRect(x, y, barWidth, barHeight, barWidth / 2)
      ctx.fill()
    }
  }

  render()
}

function stopVisualizer() {
  if (animationFrameId !== null) {
    cancelAnimationFrame(animationFrameId)
    animationFrameId = null
  }
  const canvas = canvasRef.value
  if (canvas) {
    const ctx = canvas.getContext('2d')
    if (ctx) {
      const rect = canvas.getBoundingClientRect()
      renderIdleState(ctx, rect.width, rect.height)
    }
  }
  soundQualityState.value = 'idle'
  soundLevelPercent.value = 0
  smoothedRms = 0
  peakHold = 0
}

watch(
  () => [props.isRecording, props.analyserNode],
  ([isRec, analyser]) => {
    if (isRec && analyser) {
      startVisualizer()
    } else {
      stopVisualizer()
    }
  },
  { immediate: true }
)

let resizeObserver: ResizeObserver | null = null

onMounted(() => {
  if (canvasRef.value) {
    resizeObserver = new ResizeObserver(() => {
      if (props.isRecording && props.analyserNode) {
        startVisualizer()
      } else if (canvasRef.value) {
        const ctx = canvasRef.value.getContext('2d')
        if (ctx) {
          const rect = canvasRef.value.getBoundingClientRect()
          renderIdleState(ctx, rect.width, rect.height)
        }
      }
    })
    resizeObserver.observe(canvasRef.value)
  }
  startVisualizer()
})

onUnmounted(() => {
  stopVisualizer()
  if (resizeObserver) {
    resizeObserver.disconnect()
    resizeObserver = null
  }
})
</script>

<template>
  <div
    class="relative flex h-64 w-full flex-col items-center justify-between overflow-hidden rounded-3xl border border-slate-800/80 bg-slate-900/60 p-4 shadow-2xl backdrop-blur-sm sm:h-72 md:h-72"
  >
    <!-- Top Bar: Quality Status Badge & VU Meter & LIVE Indicator -->
    <div class="z-10 flex w-full items-center justify-between gap-2">
      <!-- Quality Badge -->
      <div
        class="flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition-all duration-200"
        :class="badgeClasses"
      >
        <component :is="qualityIcon" class="h-3.5 w-3.5 shrink-0" />
        <span>{{ qualityLabel }}</span>
      </div>

      <!-- Right Controls: VU Meter & Live Badge -->
      <div class="flex items-center gap-2 sm:gap-3">
        <!-- 10-Segment VU Meter -->
        <div
          v-if="isRecording"
          class="flex items-center gap-1 rounded-xl border border-slate-800/80 bg-slate-950/80 px-2 py-1.5"
          title="Шкала рівня звуку"
          aria-label="Шкала рівня звуку"
        >
          <span
            v-for="seg in 10"
            :key="seg"
            class="rounded-xs h-3.5 w-1.5 transition-colors duration-75"
            :class="getSegmentClass(seg)"
          />
        </div>

        <!-- LIVE Indicator -->
        <div
          v-if="isRecording"
          class="flex items-center gap-1.5 rounded-full border border-orange-500/30 bg-orange-500/10 px-2.5 py-1 text-xs font-semibold text-orange-400"
        >
          <span class="relative flex h-2 w-2">
            <span
              class="absolute inline-flex h-full w-full animate-ping rounded-full bg-orange-400 opacity-75"
            />
            <span class="relative inline-flex h-2 w-2 rounded-full bg-orange-500" />
          </span>
          <span>LIVE</span>
        </div>
      </div>
    </div>

    <!-- Center: Interactive Audio Waveform Canvas -->
    <div class="relative flex h-full w-full flex-1 items-center justify-center">
      <canvas ref="canvasRef" class="block h-full w-full" />
    </div>

    <!-- Bottom Bar: Dynamic Context Guidance Tip -->
    <div
      class="z-10 flex w-full items-center justify-center text-center text-xs transition-colors duration-200"
      :class="hintTextClass"
    >
      <p class="truncate font-medium">{{ qualityHint }}</p>
    </div>
  </div>
</template>
