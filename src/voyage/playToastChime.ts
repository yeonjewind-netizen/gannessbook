/** 짧고 맑은 물방울 느낌의 알림음 (Web Audio API, 외부 파일 없음) */
export function playToastChime(): void {
  if (typeof window === 'undefined') return
  try {
    const AC =
      window.AudioContext ||
      (
        window as unknown as {
          webkitAudioContext?: typeof AudioContext
        }
      ).webkitAudioContext
    if (!AC) return
    const ctx = new AC()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.connect(gain)
    gain.connect(ctx.destination)

    const t0 = ctx.currentTime
    osc.frequency.setValueAtTime(1150, t0)
    osc.frequency.exponentialRampToValueAtTime(520, t0 + 0.11)
    gain.gain.setValueAtTime(0.0001, t0)
    gain.gain.exponentialRampToValueAtTime(0.09, t0 + 0.012)
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.18)

    osc.start(t0)
    osc.stop(t0 + 0.2)

    ctx.resume?.().catch(() => {
      /* 사용자 제스처 전에는 실패할 수 있음 */
    })
    window.setTimeout(() => {
      ctx.close?.().catch(() => {})
    }, 400)
  } catch {
    /* ignore */
  }
}
