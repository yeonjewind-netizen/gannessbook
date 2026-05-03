import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Upload, X } from 'lucide-react'
import type { GannessRecordCategory } from '../data/gannessRecords'
import {
  registerCustomRecordCategory,
  submitRecordApplication,
  type VoyageDiarySnapshotItem,
} from '../data/gannessPersistence'
import {
  aggregateDefaultCheersForDiaryIds,
  loadCheerReactions,
} from '../voyage/cheerReactionsStorage'
import { TAG_LABEL } from '../voyage/constants'
import { timelineEntryArticleClassFlat } from '../voyage/timelineMood'
import { formatShortDate } from '../voyage/dateFormat'
import MediaLightbox, {
  type LightboxMedia,
} from './MediaLightbox'
import { DiaryMediaPreviewGrid } from './DiaryMediaPreviewGrid'
import { TimelineMoodRibbon } from './TimelineMoodRibbon'
import type { LogEntry } from '../voyage/types'
import { getVoyageEntriesForCurrentGoal } from '../voyage/voyageGoalDiary'
import { loadMyVoyage } from '../voyage/myVoyageStorage'
import { saveProfileApplicantName } from '../voyage/profileApplicantStorage'
import { getOrCreateUserId } from '../voyage/userIdentity'

const NEW_TOPIC_VALUE = '__new_topic__'

/** 항해 완료 → 기록 신청으로 넘길 때 스냅샷 (일지·카테고리·추천 수치) */
export type VoyageRecordPrefill = {
  diaryEntries: LogEntry[]
  excludedDiaryIds: string[]
  initialCategoryId?: string | null
  goalNameSnapshot: string
  recordValueSuggestion?: string
  reflectionSeed?: string
  /** 항해 완료 시점 스냅샷 — 공동체 응원 집계 */
  communityCheerTotal?: number
  communityCheerByEmoji?: Record<string, number>
}

function makeUploadId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

type UploadEntry = {
  id: string
  file: File
  url: string
}

type RecordSubmissionFormProps = {
  open: boolean
  onClose: () => void
  categories: GannessRecordCategory[]
  /** 상위(명예의 전당)에서 고른 기본 카테고리 */
  initialCategoryId?: string
  /** 항해 완료 직후 라우팅으로 전달된 스냅샷 — 일지·필터·추천값 자동 반영 */
  voyagePrefill?: VoyageRecordPrefill | null
}

function isVideoFile(file: File) {
  return file.type.startsWith('video/')
}

export default function RecordSubmissionForm({
  open,
  onClose,
  categories,
  initialCategoryId,
  voyagePrefill,
}: RecordSubmissionFormProps) {
  const [applicantName, setApplicantName] = useState('')
  const [categorySelect, setCategorySelect] = useState('')
  const [customCategoryTitle, setCustomCategoryTitle] = useState('')
  const [recordValue, setRecordValue] = useState('')
  const [reflectionNote, setReflectionNote] = useState('')
  const [dailyRoutines, setDailyRoutines] = useState<string[]>([''])
  const [crisisMethodology, setCrisisMethodology] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [uploadEntries, setUploadEntries] = useState<UploadEntry[]>([])
  const [dropActive, setDropActive] = useState(false)
  const [excludedDiaryIds, setExcludedDiaryIds] = useState<Set<string>>(
    () => new Set(),
  )
  const [lightboxMedia, setLightboxMedia] = useState<LightboxMedia | null>(
    null,
  )

  const fileInputRef = useRef<HTMLInputElement>(null)
  const entriesRef = useRef<UploadEntry[]>([])

  useEffect(() => {
    entriesRef.current = uploadEntries
  }, [uploadEntries])

  useEffect(() => {
    return () => {
      entriesRef.current.forEach((e) => URL.revokeObjectURL(e.url))
    }
  }, [])

  const linkedDiaries = useMemo(() => {
    if (!open) return []
    if (voyagePrefill?.diaryEntries?.length) {
      return [...voyagePrefill.diaryEntries].sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      )
    }
    return [...getVoyageEntriesForCurrentGoal()].sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    )
  }, [open, voyagePrefill])

  const profileGoalHint = useMemo(() => {
    if (!open) return ''
    if (voyagePrefill?.goalNameSnapshot?.trim()) {
      return voyagePrefill.goalNameSnapshot.trim()
    }
    const p = loadMyVoyage()
    return p.goalName.trim() || ''
  }, [open, voyagePrefill])

  const includedCheerPreview = useMemo(() => {
    const ids = linkedDiaries
      .filter((e) => !excludedDiaryIds.has(e.id))
      .map((e) => e.id)
    return aggregateDefaultCheersForDiaryIds(ids, loadCheerReactions())
  }, [linkedDiaries, excludedDiaryIds])

  useEffect(() => {
    if (!open) return
    setApplicantName('')
    setSubmitting(false)
    setCustomCategoryTitle('')
    setUploadEntries((prev) => {
      prev.forEach((e) => URL.revokeObjectURL(e.url))
      return []
    })
    setDropActive(false)
    if (fileInputRef.current) fileInputRef.current.value = ''

    const firstId = categories[0]?.id ?? ''

    if (voyagePrefill) {
      setExcludedDiaryIds(new Set(voyagePrefill.excludedDiaryIds))
      setReflectionNote(voyagePrefill.reflectionSeed ?? '')
      setDailyRoutines([''])
      setCrisisMethodology('')
      setRecordValue(voyagePrefill.recordValueSuggestion ?? '')
      const catInit =
        voyagePrefill.initialCategoryId &&
        categories.some((c) => c.id === voyagePrefill.initialCategoryId)
          ? voyagePrefill.initialCategoryId
          : initialCategoryId &&
              categories.some((c) => c.id === initialCategoryId)
            ? initialCategoryId
            : firstId
      setCategorySelect(catInit || firstId)
    } else {
      setExcludedDiaryIds(new Set())
      setReflectionNote('')
      setDailyRoutines([''])
      setCrisisMethodology('')
      setRecordValue('')
      const initial =
        initialCategoryId && categories.some((c) => c.id === initialCategoryId)
          ? initialCategoryId
          : firstId
      setCategorySelect(initial || firstId)
    }
  }, [open, initialCategoryId, categories, voyagePrefill])

  useEffect(() => {
    if (!open) return
    if (categorySelect) return
    const firstId = categories[0]?.id ?? ''
    if (firstId) setCategorySelect(firstId)
  }, [open, categories, categorySelect])

  const onFiles = useCallback((files: FileList | null) => {
    if (!files?.length) return
    setUploadEntries((prev) => [
      ...prev,
      ...Array.from(files).map((file) => ({
        id: makeUploadId(),
        file,
        url: URL.createObjectURL(file),
      })),
    ])
  }, [])

  const removeUpload = useCallback((id: string) => {
    setUploadEntries((prev) => {
      const target = prev.find((e) => e.id === id)
      if (target) URL.revokeObjectURL(target.url)
      return prev.filter((e) => e.id !== id)
    })
  }, [])

  function toggleExclude(id: string) {
    setExcludedDiaryIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function handleSubmit() {
    if (!applicantName.trim()) {
      window.alert('신청자 이름을 입력해 주세요.')
      return
    }

    let resolvedCategoryId = categorySelect
    if (categorySelect === NEW_TOPIC_VALUE) {
      const title = customCategoryTitle.trim()
      if (!title) {
        window.alert('새 기록 주제 제목을 입력해 주세요.')
        return
      }
      resolvedCategoryId = registerCustomRecordCategory(title)
      if (!resolvedCategoryId) {
        window.alert('주제 등록에 실패했습니다.')
        return
      }
    }

    if (!resolvedCategoryId) {
      window.alert('카테고리를 선택해 주세요.')
      return
    }
    if (!recordValue.trim()) {
      window.alert('기록 수치를 입력해 주세요.')
      return
    }

    const included = linkedDiaries.filter((e) => !excludedDiaryIds.has(e.id))
    const cheerAgg = aggregateDefaultCheersForDiaryIds(
      included.map((e) => e.id),
      loadCheerReactions(),
    )
    const voyageDiarySnapshots: VoyageDiarySnapshotItem[] = included.map(
      (e) => {
        const mediaItems =
          e.attachments?.map((a) => ({
            type: a.type,
            dataUrl: a.dataUrl,
          })) ?? []
        return {
          id: e.id,
          createdAt: e.createdAt,
          tag: TAG_LABEL[e.tag],
          moodTag: e.tag,
          body: e.body,
          ...(mediaItems.length ? { mediaItems } : {}),
        }
      },
    )

    setSubmitting(true)
    try {
      const routinesFiltered = dailyRoutines.map((r) => r.trim()).filter(Boolean)
      await submitRecordApplication({
        applicantName,
        categoryId: resolvedCategoryId,
        recordValue,
        journeyNote: reflectionNote,
        files: uploadEntries.map((e) => e.file),
        ...(voyageDiarySnapshots.length
          ? { voyageDiarySnapshots }
          : {}),
        ...(cheerAgg.total > 0
          ? {
              communityCheerTotal: cheerAgg.total,
              communityCheerByEmoji: cheerAgg.byEmoji,
            }
          : {}),
        ...(routinesFiltered.length ? { dailyRoutines: routinesFiltered } : {}),
        ...(crisisMethodology.trim()
          ? { crisisMethodology: crisisMethodology.trim() }
          : {}),
        submitterUserId: getOrCreateUserId(),
      })
      saveProfileApplicantName(applicantName.trim())
      window.alert(
        '신청이 접수되었습니다.\n학생회 심사 후 명예의 전당에 반영됩니다.',
      )
      onClose()
    } catch {
      window.alert('저장에 실패했습니다. 잠시 후 다시 시도해 주세요.')
      setSubmitting(false)
    }
  }

  if (!open) return null

  const safeUploads = uploadEntries

  return (
    <div
      className="fixed inset-0 z-[85] flex items-end justify-center p-4 sm:items-center"
      role="presentation"
    >
      <MediaLightbox
        open={lightboxMedia != null}
        media={lightboxMedia}
        onClose={() => setLightboxMedia(null)}
      />
      <button
        type="button"
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-[2px]"
        aria-label="닫기"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="record-submission-title"
        className="animate-challenge-modal-in relative max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-indigo-100 bg-white p-5 shadow-2xl sm:max-h-[85vh]"
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 rounded-lg p-1 text-slate-500 hover:bg-slate-100"
          aria-label="닫기"
        >
          <X className="h-5 w-5" />
        </button>
        <h2
          id="record-submission-title"
          className="pr-10 text-lg font-bold text-slate-900"
        >
          기록 도전 신청
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          학생회(관리자) 승인 후 명예의 전당에 반영됩니다. 제출 즉시{' '}
          <strong className="font-semibold text-amber-800">
            심사 대기(pending)
          </strong>{' '}
          상태로 저장됩니다.
        </p>

        <label className="mt-5 block">
          <span className="text-xs font-bold uppercase tracking-wide text-slate-500">
            신청자 이름
          </span>
          <input
            type="text"
            value={applicantName}
            onChange={(e) => setApplicantName(e.target.value)}
            placeholder="실명 또는 표시명"
            className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-200"
          />
        </label>

        <label className="mt-4 block">
          <span className="text-xs font-bold uppercase tracking-wide text-slate-500">
            도전할 기록 (카테고리)
          </span>
          <select
            value={categorySelect}
            onChange={(e) => setCategorySelect(e.target.value)}
            className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2.5 text-sm text-slate-900 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-200"
          >
            {categories.map((c, optIdx) => (
              <option key={c?.id ?? `opt-${optIdx}`} value={c?.id ?? ''}>
                {c?.title ?? '—'}
              </option>
            ))}
            <option value={NEW_TOPIC_VALUE}>+ 새로운 주제 직접 입력</option>
          </select>
        </label>

        {categorySelect === NEW_TOPIC_VALUE && (
          <label className="mt-3 block">
            <span className="text-xs font-bold uppercase tracking-wide text-slate-500">
              새 주제 이름
            </span>
            <input
              type="text"
              value={customCategoryTitle}
              onChange={(e) => setCustomCategoryTitle(e.target.value)}
              placeholder="기록실에 올릴 새 기네스 주제를 적어 주세요."
              className="mt-2 w-full rounded-xl border border-indigo-200 bg-indigo-50/50 px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-200"
            />
          </label>
        )}

        <label className="mt-4 block">
          <span className="text-xs font-bold uppercase tracking-wide text-slate-500">
            기록 수치
          </span>
          <input
            type="text"
            value={recordValue}
            onChange={(e) => setRecordValue(e.target.value)}
            placeholder="예: 22회, 1,400골, 500시간"
            className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-200"
          />
        </label>

        <div className="mt-5 rounded-xl border border-sky-100 bg-sky-50/40 p-3">
          <p className="text-xs font-bold uppercase tracking-wide text-sky-800">
            여정 일지
          </p>
          <p className="mt-1 text-[11px] leading-relaxed text-sky-900/85">
            {voyagePrefill
              ? '항해를 마칠 때 모은 타임라인입니다. 글은 수정할 수 없으며, 「공개」를 끄면 그 일지는 신청서 제출 본문에서 제외됩니다.'
              : '나의 바다에서 기록한 일지를 불러옵니다. 공개 여부를 조정해 제출에 포함할 항목만 골라 주세요.'}
          </p>
          {profileGoalHint ? (
            <p className="mt-2 text-xs text-sky-900/80">
              {voyagePrefill ? '완료한 목표: ' : '현재 목표: '}
              <strong>{profileGoalHint}</strong>
            </p>
          ) : (
            <p className="mt-2 text-xs text-amber-800">
              나의 바다에서 목표를 설정하면 이곳에 일지가 불러와집니다.
            </p>
          )}
          {includedCheerPreview.total > 0 && (
            <p className="mt-2 rounded-lg border border-amber-200/80 bg-amber-50/90 px-2.5 py-2 text-xs leading-relaxed text-amber-950">
              <span className="font-bold">공동체 응원</span> — 공개로 제출하는
              일지에 총{' '}
              <strong className="tabular-nums">
                {includedCheerPreview.total}번
              </strong>
              의 응원이 누적 반영됩니다. 심사 화면에도 함께 전달됩니다.
            </p>
          )}

          {linkedDiaries.length === 0 ? (
            <p className="mt-3 text-sm text-slate-600">
              불러올 일지가 없습니다. 나의 바다에서 파도·순풍 기록을 남겨 보세요.
            </p>
          ) : (
            <ul className="mt-3 space-y-3" aria-label="연결된 나의 바다 일지">
              {linkedDiaries.map((entry) => {
                const excluded = excludedDiaryIds.has(entry.id)
                return (
                  <li
                    key={entry.id}
                    className={`rounded-2xl border p-3 shadow-sm ${timelineEntryArticleClassFlat(
                      entry.tag,
                    )}`}
                  >
                    <div className="flex flex-wrap items-start gap-x-3 gap-y-2">
                      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2 text-xs text-slate-600">
                        <time dateTime={entry.createdAt}>
                          {formatShortDate(entry.createdAt)}
                        </time>
                        <TimelineMoodRibbon
                          moodTag={entry.tag}
                          surface="surface"
                          tagLabel={TAG_LABEL[entry.tag]}
                        />
                      </div>
                      <label className="flex shrink-0 cursor-pointer items-center gap-2 rounded-lg border border-slate-200/90 bg-white/90 px-2.5 py-1.5 text-xs font-semibold text-slate-800 shadow-sm">
                        <input
                          type="checkbox"
                          checked={!excluded}
                          onChange={() => toggleExclude(entry.id)}
                          className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                        />
                        공개
                      </label>
                    </div>
                    <label className="mt-2 block">
                      <span className="sr-only">일지 원문 (읽기 전용)</span>
                      <textarea
                        readOnly
                        value={entry.body}
                        rows={Math.min(
                          12,
                          Math.max(3, Math.ceil(entry.body.length / 42)),
                        )}
                        className="w-full cursor-default resize-none rounded-lg border border-slate-100 bg-slate-50/90 px-3 py-2 text-sm text-slate-800"
                      />
                    </label>
                    {entry.attachments && entry.attachments.length > 0 && (
                      <div className="mt-2">
                        <DiaryMediaPreviewGrid
                          items={entry.attachments.map((a) => ({
                            type: a.type,
                            dataUrl: a.dataUrl,
                          }))}
                          layout="compact"
                          rowKeyPrefix={entry.id}
                          onOpen={setLightboxMedia}
                        />
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        <div className="mt-5 rounded-xl border border-indigo-100 bg-indigo-50/40 px-3 py-3">
          <p className="text-xs font-bold uppercase tracking-wide text-indigo-900">
            나의 루틴 · 항해사의 비망록
          </p>
          <p className="mt-2 text-sm font-semibold text-slate-800">
            목표 달성을 위해 매일 실천한 습관을 한 줄씩 적어 주세요.
          </p>
          <ul className="mt-2 space-y-2" aria-label="나의 루틴 목록">
            {dailyRoutines.map((line, idx) => (
              <li key={`routine-${idx}`} className="flex gap-2">
                <span className="mt-2.5 shrink-0 text-xs font-bold text-indigo-600">
                  {idx + 1}.
                </span>
                <input
                  type="text"
                  value={line}
                  onChange={(e) => {
                    const v = e.target.value
                    setDailyRoutines((prev) =>
                      prev.map((s, i) => (i === idx ? v : s)),
                    )
                  }}
                  placeholder="예: 새벽 30분 스트레칭, 주간 회고 노트"
                  className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                />
                <button
                  type="button"
                  onClick={() =>
                    setDailyRoutines((prev) =>
                      prev.length > 1 ? prev.filter((_, i) => i !== idx) : prev,
                    )
                  }
                  className="shrink-0 self-center rounded-lg px-2 text-xs font-semibold text-slate-500 hover:bg-white hover:text-rose-700"
                  aria-label={`루틴 ${idx + 1} 삭제`}
                >
                  삭제
                </button>
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={() => setDailyRoutines((prev) => [...prev, ''])}
            className="mt-2 text-xs font-bold text-indigo-700 underline decoration-indigo-300 hover:text-indigo-900"
          >
            + 습관 한 줄 더 추가
          </button>

          <label className="mt-4 block">
            <span className="text-sm font-semibold text-slate-800">
              태풍(위기)을 만났을 때 나만의 극복 방법은 무엇인가요?
            </span>
            <textarea
              value={crisisMethodology}
              onChange={(e) => setCrisisMethodology(e.target.value)}
              rows={3}
              placeholder="짧게라도 좋아요. 나중에 등대로 나를 따르는 선원들이 참고할 수 있어요."
              className="mt-2 w-full resize-y rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-200"
            />
          </label>
        </div>

        <label className="mt-4 block">
          <span className="text-xs font-bold uppercase tracking-wide text-slate-500">
            전체 소감 (추가만 가능)
          </span>
          <textarea
            value={reflectionNote}
            onChange={(e) => setReflectionNote(e.target.value)}
            rows={4}
            placeholder="일지 원문은 위에서 읽기 전용입니다. 여기에는 전체적인 소감만 자유롭게 적어 주세요."
            className="mt-2 w-full resize-y rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-200"
          />
        </label>

        <div className="mt-5">
          <span className="text-xs font-bold uppercase tracking-wide text-slate-500">
            증명 자료 (사진·영상)
          </span>
          <div
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click()
            }}
            onDragEnter={(e) => {
              e.preventDefault()
              setDropActive(true)
            }}
            onDragOver={(e) => {
              e.preventDefault()
              setDropActive(true)
            }}
            onDragLeave={() => setDropActive(false)}
            onDrop={(e) => {
              e.preventDefault()
              setDropActive(false)
              onFiles(e.dataTransfer.files)
            }}
            onClick={() => fileInputRef.current?.click()}
            className={`mt-2 flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-4 py-10 transition ${
              dropActive
                ? 'border-indigo-500 bg-indigo-50/80'
                : 'border-slate-300 bg-slate-50/50 hover:border-indigo-300 hover:bg-indigo-50/40'
            }`}
          >
            <Upload
              className="mb-2 h-10 w-10 text-slate-400"
              strokeWidth={1.5}
              aria-hidden
            />
            <p className="text-center text-sm font-semibold text-slate-700">
              여기로 드래그하거나 탭해서 파일 선택
            </p>
            <p className="mt-1 text-center text-xs text-slate-500">
              JPG, PNG, MP4 등
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,video/*"
              multiple
              className="sr-only"
              onChange={(e) => {
                onFiles(e.target.files)
                e.target.value = ''
              }}
            />
          </div>

          {safeUploads.length > 0 && (
            <ul className="mt-4 space-y-4" aria-label="첨부 미리보기">
              {safeUploads.map((entry) => (
                <li
                  key={entry.id}
                  className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50/90 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-2 border-b border-slate-100 bg-white/80 px-3 py-2">
                    <p className="min-w-0 flex-1 truncate text-xs font-medium text-slate-800">
                      {entry.file.name}
                      <span className="ml-1 font-normal text-slate-500">
                        ({Math.round(entry.file.size / 1024)} KB)
                      </span>
                    </p>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        removeUpload(entry.id)
                      }}
                      className="shrink-0 rounded-lg p-1 text-slate-500 hover:bg-slate-200 hover:text-slate-800"
                      aria-label={`${entry.file.name} 제거`}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="flex justify-center bg-black/90 p-2">
                    {isVideoFile(entry.file) ? (
                      <video
                        src={entry.url}
                        className="max-h-80 w-full object-contain"
                        controls
                        playsInline
                        preload="metadata"
                      />
                    ) : (
                      <img
                        src={entry.url}
                        alt={`${entry.file.name} 미리보기`}
                        className="max-h-80 w-full object-contain"
                      />
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            취소
          </button>
          <button
            type="button"
            disabled={submitting}
            onClick={handleSubmit}
            className="rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-2.5 text-sm font-bold text-white shadow-md hover:brightness-110 disabled:opacity-60"
          >
            {submitting ? '제출 중…' : '신청서 제출'}
          </button>
        </div>
      </div>
    </div>
  )
}
