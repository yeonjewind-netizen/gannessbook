import { Component, type ErrorInfo, type ReactNode } from 'react'
import { clearGannessBookLocalStorage } from '../data/gannessPersistence'

type Props = { children: ReactNode }

type State = { error: Error | null }

export class GannessRecordsErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[GannessRecordsErrorBoundary]', error, info.componentStack)
  }

  handleReset = () => {
    clearGannessBookLocalStorage()
    window.location.reload()
  }

  render() {
    if (this.state.error != null) {
      const message =
        this.state.error instanceof Error
          ? this.state.error.message
          : String(this.state.error)

      return (
        <div className="flex min-h-svh flex-col items-center justify-center bg-slate-100 px-4 py-12 pb-32">
          <div className="w-full max-w-md rounded-2xl border border-rose-200 bg-white p-6 text-center shadow-xl shadow-rose-100/50">
            <p className="text-base font-semibold text-slate-900">
              기록실을 불러오는 중 문제가 발생했습니다
            </p>
            <p className="mt-4 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
              오류 메시지
            </p>
            <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap break-words rounded-xl bg-slate-900/90 p-3 text-left text-xs text-amber-100">
              {message}
            </pre>
            <button
              type="button"
              onClick={this.handleReset}
              className="mt-6 w-full rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 py-3 text-sm font-bold text-white shadow-md transition hover:brightness-110"
            >
              데이터 초기화 및 새로고침
            </button>
            <p className="mt-3 text-xs leading-relaxed text-slate-500">
              명예의 전당 관련 로컬 데이터만 지우고 페이지를 다시 불러옵니다. 다른
              탭 데이터는 그대로입니다.
            </p>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
