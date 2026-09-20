import {LayoutGrid, Gamepad2, BarChart3, BookOpenCheck, UserCircle2, HelpCircle, Rocket} from 'lucide-react';
import {useLang} from '../i18n';

export type TeacherTab = 'home' | 'games' | 'results' | 'questions' | 'account' | 'help';

const ITEMS: {id: TeacherTab; label: string; icon: typeof LayoutGrid}[] = [
  {id: 'home', label: 'tside_home', icon: LayoutGrid},
  {id: 'games', label: 'tside_my_games', icon: Gamepad2},
  {id: 'results', label: 'tside_results', icon: BarChart3},
  {id: 'questions', label: 'tside_question_bank', icon: BookOpenCheck},
  {id: 'account', label: 'tside_account', icon: UserCircle2},
  {id: 'help', label: 'tside_help', icon: HelpCircle},
];

export interface TeacherSidebarProps {
  active: TeacherTab;
  onSelect: (tab: TeacherTab) => void;
}

export function TeacherMobileTabs({active, onSelect}: TeacherSidebarProps) {
  const {t} = useLang();
  return (
    <div className="flex gap-1.5 overflow-x-auto border-b-2 border-line bg-surface px-3 py-2 lg:hidden">
      {ITEMS.map((item) => {
        const isActive = active === item.id;
        const Icon = item.icon;
        return (
          <button
            key={item.id}
            onClick={() => onSelect(item.id)}
            className={[
              'flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold whitespace-nowrap transition-colors',
              isActive ? 'bg-gradient-to-r from-brand-600 to-violet-600 text-white' : 'bg-surface-raised text-ink-soft',
            ].join(' ')}
          >
            <Icon className="h-3.5 w-3.5" />
            {t(item.label)}
          </button>
        );
      })}
    </div>
  );
}
// Persistent dashboard shell for the teacher console — this is what was
// missing before: the console used to be a single bare page with no
// wayfinding, which read as a different, disconnected product from the
// rest of the site. "Akkaunt" (account) intentionally replaces a separate
// "Sozlamalar" (settings) entry: clicking it opens one panel with both the
// profile card and the app preferences (sound, language, plan, logout)
// together, instead of splitting them across two places.
export function TeacherSidebar({active, onSelect}: TeacherSidebarProps) {
  const {t} = useLang();
  return (
    <aside className="hidden w-64 shrink-0 flex-col border-r-2 border-line bg-surface lg:flex">
      <nav className="flex-1 space-y-1 p-3 pt-5">
        {ITEMS.map((item) => {
          const isActive = active === item.id;
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              onClick={() => onSelect(item.id)}
              className={[
                'flex w-full items-center gap-3 rounded-2xl px-3.5 py-2.5 text-left text-sm font-bold transition-colors',
                isActive
                  ? 'bg-gradient-to-r from-brand-600 to-violet-600 text-white shadow-[var(--shadow-pop-brand)]'
                  : 'text-ink-soft hover:bg-surface-raised hover:text-ink',
              ].join(' ')}
            >
              <Icon className="h-[18px] w-[18px] shrink-0" />
              {t(item.label)}
            </button>
          );
        })}
      </nav>

      <div className="m-3 overflow-hidden rounded-2xl border-2 border-violet-500/30 bg-gradient-to-br from-brand-600/20 to-violet-600/20 p-4 text-center">
        <Rocket className="mx-auto h-8 w-8 text-violet-400" />
        <p className="mt-2 font-display text-sm font-bold text-ink">{t('tside_tagline_title')}</p>
        <p className="mt-1 text-xs text-ink-faint">{t('tside_tagline_sub')}</p>
      </div>
    </aside>
  );
}
