/** 명예의 기록실 — 대수(세대)가 누적되는 카테고리별 기록 */

export type RecordMedia = {
  type: 'image' | 'video'
  url: string
}

export type RecordGeneration = {
  generation: number
  name: string
  recordValue: string
  journeyId: string
  media: RecordMedia
  /** 항해사의 비망록 — 데일리 루틴 (승인된 기록 신청에서 연동) */
  dailyRoutines?: string[]
  /** 태풍(위기) 극복 방법 */
  crisisMethodology?: string
  /** 기록 신청 시 작성한 전체 소감 */
  journeyNote?: string
}

export type GannessRecordCategory = {
  id: string
  title: string
  status: 'approved' | 'pending' | 'rejected'
  history: RecordGeneration[]
}

/** 빈/손상 히스토리 대비 UI 폴백 */
export const FALLBACK_MEDIA: RecordMedia = {
  type: 'image',
  url: 'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?auto=format&fit=crop&w=600&q=70',
}

export const FALLBACK_GENERATION: RecordGeneration = {
  generation: 0,
  name: '—',
  recordValue: '—',
  journeyId: 'fallback',
  media: FALLBACK_MEDIA,
}

const IMG = (id: string) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=800&q=80`

/** 짧은 샘플 영상 (MDN) */
const SAMPLE_VIDEO = 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4'

export const GANNESS_RECORD_CATEGORIES: GannessRecordCategory[] = [
  {
    id: 'cat-stage',
    title: '학교에서 가장 많은 공연 무대에 오른 사람',
    status: 'approved',
    history: [
      {
        generation: 1,
        name: '20학번 선배',
        recordValue: '15회',
        journeyId: 'A1',
        media: {
          type: 'image',
          url: IMG('photo-1503095396549-807759245b35'),
        },
      },
      {
        generation: 2,
        name: '뮤지컬부 22학번',
        recordValue: '18회',
        journeyId: 'A2',
        media: {
          type: 'image',
          url: IMG('photo-1470229722912-7c0e2dbbafd3'),
        },
      },
      {
        generation: 3,
        name: '나(현재)',
        recordValue: '20회',
        journeyId: 'A3',
        media: {
          type: 'image',
          url: IMG('photo-1514525253161-7a46d19cd819'),
        },
      },
    ],
  },
  {
    id: 'cat-basket',
    title: '농구 코트에서 가장 많은 골을 넣은 사람',
    status: 'approved',
    history: [
      {
        generation: 1,
        name: '체육부장 19학번',
        recordValue: '1,204골',
        journeyId: 'B1',
        media: {
          type: 'video',
          url: SAMPLE_VIDEO,
        },
      },
      {
        generation: 2,
        name: '동아리 PG 21학번',
        recordValue: '1,350골',
        journeyId: 'B2',
        media: {
          type: 'image',
          url: IMG('photo-1546519638-68e109498ffc'),
        },
      },
    ],
  },
  {
    id: 'cat-library',
    title: '도서관에서 가장 많은 자리를 지킨 사람 (누적 체류)',
    status: 'pending',
    history: [
      {
        generation: 1,
        name: '수험생 23학번',
        recordValue: '428시간',
        journeyId: 'C1',
        media: {
          type: 'image',
          url: IMG('photo-1521587760476-6c12a7b12190'),
        },
      },
    ],
  },
]

/** journeyId → 이 기록을 세우기까지의 서사 (항해 일지 요약) */
export const GANNESS_JOURNEY_LOGS: Record<
  string,
  { headline: string; body: string }
> = {
  A1: {
    headline: '20학번 선배 · 1대 기록',
    body: '연극부와 뮤지컬 동아리를 오가며 매 학기 무대에 섰습니다. 졸업 무대까지 포함해 총 15번의 막이 올랐고, 후배들에게 “무대는 두렵지 않다”는 말을 남겼습니다.',
  },
  A2: {
    headline: '뮤지컬부 22학번 · 2대 기록',
    body: '교내 페스티벌과 지역 연합 공연까지 포함해 기록을 18회로 늘렸습니다. 1대 기록을 넘기기까지 2년간 주말마다 연습실을 지켰습니다.',
  },
  A3: {
    headline: '나(현재) · 3대 기록',
    body: '졸업 앞두고 마지막 페스티벌까지 모두 섰습니다. 선배들이 남긴 발자국 위에 한 번 더 올라 20회를 찍었습니다. 기록이 깨져도 이 여정은 기록실에 남습니다.',
  },
  B1: {
    headline: '체육부장 19학번 · 1대 기록',
    body: '방과 후 매일 코트를 지켰고, 교내 리그와 친선전 골을 모두 합산했습니다. 부상 없이 3년을 뛰며 1,204골을 기록했습니다.',
  },
  B2: {
    headline: '동아리 PG 21학번 · 2대 기록',
    body: '1대 기록을 보며 “언젠가 넘겨야지” 다짐했습니다. 졸업 전 마지막 대회에서 역전승을 거듭하며 1,350골로 갱신했습니다.',
  },
  C1: {
    headline: '수험생 23학번 · 심사 중인 1대 기록',
    body: '새벽부터 밤까지 같은 자리에서 공부한 시간을 스스로 기록했습니다. 학생회·도서위원회 검증이 끝나면 명예의 전당에 정식 등재될 예정입니다.',
  },
}

function isFiniteGeneration(n: unknown): n is number {
  return typeof n === 'number' && Number.isFinite(n)
}

/** 로컬 스토리지·레거시 데이터용 미디어 보정 */
export function coerceRecordMedia(m: unknown): RecordMedia {
  if (m != null && typeof m === 'object' && 'url' in m) {
    const url =
      typeof (m as RecordMedia).url === 'string' &&
      (m as RecordMedia).url.trim() !== ''
        ? (m as RecordMedia).url
        : FALLBACK_MEDIA.url
    const type = (m as RecordMedia).type === 'video' ? 'video' : 'image'
    return { type, url }
  }
  return FALLBACK_MEDIA
}

export function getCurrentHolder(
  history: RecordGeneration[] | null | undefined,
): RecordGeneration {
  const list = [...(history ?? [])].filter(
    (h): h is RecordGeneration =>
      h != null && typeof h === 'object' && isFiniteGeneration(h.generation),
  )
  if (list.length === 0) return FALLBACK_GENERATION
  const top = [...list].sort((a, b) => b.generation - a.generation)[0]
  const routines =
    Array.isArray(top.dailyRoutines) && top.dailyRoutines.length
      ? top.dailyRoutines
          .filter(
            (s): s is string => typeof s === 'string' && s.trim() !== '',
          )
          .map((s) => s.trim())
      : undefined
  const crisis =
    typeof top.crisisMethodology === 'string' && top.crisisMethodology.trim()
      ? top.crisisMethodology.trim()
      : undefined
  const note =
    typeof top.journeyNote === 'string' && top.journeyNote.trim()
      ? top.journeyNote.trim()
      : undefined
  return {
    ...top,
    media: coerceRecordMedia(top.media),
    name: typeof top.name === 'string' && top.name ? top.name : '—',
    recordValue:
      typeof top.recordValue === 'string' && top.recordValue
        ? top.recordValue
        : '—',
    journeyId:
      typeof top.journeyId === 'string' && top.journeyId
        ? top.journeyId
        : 'unknown',
    ...(routines?.length ? { dailyRoutines: routines } : {}),
    ...(crisis ? { crisisMethodology: crisis } : {}),
    ...(note ? { journeyNote: note } : {}),
  }
}

export function getHistoryChronological(
  history: RecordGeneration[] | null | undefined,
): RecordGeneration[] {
  const list = [...(history ?? [])].filter(
    (h): h is RecordGeneration =>
      h != null && typeof h === 'object' && isFiniteGeneration(h.generation),
  )
  if (list.length === 0) return []
  return [...list]
    .sort((a, b) => a.generation - b.generation)
    .map((h) => {
      const routines =
        Array.isArray(h.dailyRoutines) && h.dailyRoutines.length
          ? h.dailyRoutines
              .filter(
                (s): s is string =>
                  typeof s === 'string' && s.trim() !== '',
              )
              .map((s) => s.trim())
          : undefined
      const crisis =
        typeof h.crisisMethodology === 'string' && h.crisisMethodology.trim()
          ? h.crisisMethodology.trim()
          : undefined
      const note =
        typeof h.journeyNote === 'string' && h.journeyNote.trim()
          ? h.journeyNote.trim()
          : undefined
      return {
        ...h,
        media: coerceRecordMedia(h.media),
        name: typeof h.name === 'string' && h.name ? h.name : '—',
        recordValue:
          typeof h.recordValue === 'string' && h.recordValue ? h.recordValue : '—',
        journeyId:
          typeof h.journeyId === 'string' && h.journeyId ? h.journeyId : 'unknown',
        ...(routines?.length ? { dailyRoutines: routines } : {}),
        ...(crisis ? { crisisMethodology: crisis } : {}),
        ...(note ? { journeyNote: note } : {}),
      }
    })
}
