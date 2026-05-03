// TODO: [Phase 2] 이 고래 도약 및 회고 로직은 추후 '목표 달성 전용 페이지' 라우팅이 구현되면 그쪽으로 이동시킬 것.

type Props = {
  abyss: boolean
  deepWater: boolean
  onClick: () => void
}

export function VoyageCompleteButton({ abyss, deepWater, onClick }: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`shrink-0 rounded-xl border px-4 py-2.5 text-sm font-semibold shadow-sm transition hover:brightness-105 active:scale-[0.98] ${
        abyss
          ? 'border-amber-400/60 bg-amber-500/20 text-amber-100 hover:bg-amber-500/30'
          : deepWater
            ? 'border-amber-300/80 bg-amber-400/25 text-white hover:bg-amber-400/35'
            : 'border-amber-400/90 bg-amber-50 text-amber-950 hover:bg-amber-100'
      }`}
    >
      🎉 항해 완료
    </button>
  )
}
