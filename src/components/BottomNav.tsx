import { NavLink } from 'react-router-dom'
import { Anchor, Globe, Trophy, User } from 'lucide-react'

export function BottomNav() {
  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 border-t border-slate-200/90 bg-white/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_24px_rgba(15,23,42,0.06)] backdrop-blur-md"
      aria-label="주요 메뉴"
    >
      <div className="mx-auto flex max-w-lg">
        <NavLink
          to="/"
          end
          className={({ isActive }) =>
            `flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 px-0.5 py-2 text-[10px] font-medium leading-tight transition-colors sm:gap-1 sm:text-xs ${
              isActive ? 'text-slate-900' : 'text-slate-400'
            }`
          }
        >
          {({ isActive }) => (
            <>
              <Anchor
                className="h-5 w-5 shrink-0 sm:h-6 sm:w-6"
                strokeWidth={isActive ? 2.25 : 1.75}
                aria-hidden
              />
              <span>나의 바다</span>
            </>
          )}
        </NavLink>
        <NavLink
          to="/shared"
          className={({ isActive }) =>
            `flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 px-0.5 py-2 text-[10px] font-medium leading-tight transition-colors sm:gap-1 sm:text-xs ${
              isActive ? 'text-slate-900' : 'text-slate-400'
            }`
          }
        >
          {({ isActive }) => (
            <>
              <Globe
                className="h-5 w-5 shrink-0 sm:h-6 sm:w-6"
                strokeWidth={isActive ? 2.25 : 1.75}
                aria-hidden
              />
              <span>공동의 바다</span>
            </>
          )}
        </NavLink>
        <NavLink
          to="/records"
          className={({ isActive }) =>
            `flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 px-0.5 py-2 text-[10px] font-medium leading-tight transition-colors sm:gap-1 sm:text-xs ${
              isActive ? 'text-slate-900' : 'text-slate-400'
            }`
          }
        >
          {({ isActive }) => (
            <>
              <Trophy
                className="h-5 w-5 shrink-0 sm:h-6 sm:w-6"
                strokeWidth={isActive ? 2.25 : 1.75}
                aria-hidden
              />
              <span className="text-center">명예의 전당</span>
            </>
          )}
        </NavLink>
        <NavLink
          to="/profile"
          className={({ isActive }) =>
            `flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 px-0.5 py-2 text-[10px] font-medium leading-tight transition-colors sm:gap-1 sm:text-xs ${
              isActive ? 'text-slate-900' : 'text-slate-400'
            }`
          }
        >
          {({ isActive }) => (
            <>
              <User
                className="h-5 w-5 shrink-0 sm:h-6 sm:w-6"
                strokeWidth={isActive ? 2.25 : 1.75}
                aria-hidden
              />
              <span>프로필</span>
            </>
          )}
        </NavLink>
      </div>
    </nav>
  )
}
