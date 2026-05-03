import { Compass, Sparkles } from 'lucide-react'
import type { VoyageMeta } from './types'
import { formatShortDate } from './dateFormat'
import { loadMyVoyage } from './myVoyageStorage'

type Props = {
  voyageMeta: VoyageMeta
}

export function VoyageMilestoneBanner({ voyageMeta }: Props) {
  if (!voyageMeta.isCompleted || !voyageMeta.finalRetrospective) return null

  const { goalName } = loadMyVoyage()

  return (
    <section
      className="mb-8 overflow-hidden rounded-2xl border-2 border-amber-300/95 bg-gradient-to-br from-amber-50 via-white to-sky-50 p-6 shadow-xl shadow-amber-200/50 ring-1 ring-amber-200/80"
      aria-labelledby="milestone-heading"
    >
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-amber-200/80 pb-4">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 to-sky-500 text-white shadow-md">
            <Compass className="h-6 w-6" strokeWidth={2} aria-hidden />
          </span>
          <div>
            <h2
              id="milestone-heading"
              className="text-lg font-bold tracking-tight text-amber-950 sm:text-xl"
            >
              영감의 이정표
            </h2>
            <p className="mt-1 text-sm font-medium text-amber-900/85">
              「{goalName.trim() ? goalName : '이번'}」 항해를 마치며 남긴 마지막 회고
            </p>
          </div>
        </div>
        <Sparkles className="h-6 w-6 shrink-0 text-amber-500" strokeWidth={2} aria-hidden />
      </div>
      <blockquote className="mt-5 border-l-4 border-amber-400 pl-4">
        <p className="whitespace-pre-wrap text-base font-medium leading-relaxed text-slate-800">
          {voyageMeta.finalRetrospective}
        </p>
      </blockquote>
      {voyageMeta.completedAt && (
        <p className="mt-4 text-right text-xs font-medium text-slate-500">
          이정표 세운 날 · {formatShortDate(voyageMeta.completedAt)}
        </p>
      )}
    </section>
  )
}
