<script setup lang="ts">
import type { PipelineStatus } from '@/types/transcription'
import { CheckCircle2 } from 'lucide-vue-next'

const props = defineProps<{
  status: PipelineStatus
}>()

const pipelineSteps = [
  { key: 'recording', label: 'Запис' },
  { key: 'transcribing', label: 'Розпізнавання' },
  { key: 'correcting', label: 'Редагування' },
  { key: 'completed', label: 'Готово' },
] as const

function isStepActive(stepKey: string): boolean {
  if (props.status === 'idle' || props.status === 'completed') return false
  return props.status === stepKey
}

function isStepDone(stepKey: string): boolean {
  if (props.status === 'completed') return true
  const order = ['recording', 'transcribing', 'correcting', 'completed']
  const currentIndex = order.indexOf(props.status)
  const stepIndex = order.indexOf(stepKey)
  if (currentIndex === -1) return false
  return currentIndex > stepIndex
}
</script>

<template>
  <div
    class="flex w-full max-w-md items-center justify-between gap-1 rounded-2xl border border-slate-800/80 bg-slate-900/60 px-4 py-3 text-xs"
    role="region"
    aria-label="Етапи обробки аудіо"
  >
    <template v-for="(step, index) in pipelineSteps" :key="step.key">
      <div
        class="flex items-center gap-1.5 font-medium transition-colors"
        :class="[
          isStepActive(step.key)
            ? 'font-bold text-orange-400'
            : isStepDone(step.key)
              ? 'text-emerald-400'
              : 'text-slate-500',
        ]"
      >
        <CheckCircle2 v-if="isStepDone(step.key)" class="h-3.5 w-3.5 shrink-0 text-emerald-400" />
        <span
          v-else
          class="h-2 w-2 shrink-0 rounded-full transition-colors"
          :class="[isStepActive(step.key) ? 'animate-pulse bg-orange-500' : 'bg-slate-700']"
        />
        <span class="truncate">{{ step.label }}</span>
      </div>
      <div
        v-if="index < pipelineSteps.length - 1"
        class="h-px w-3 shrink-0 transition-colors sm:w-6"
        :class="[
          isStepDone(pipelineSteps[index + 1].key) || isStepActive(pipelineSteps[index + 1].key)
            ? 'bg-orange-500/50'
            : 'bg-slate-800',
        ]"
      />
    </template>
  </div>
</template>
