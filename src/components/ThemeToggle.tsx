import {Moon, Sun} from 'lucide-react';
import {useTheme} from '../context/ThemeContext';
import {useLang} from '../i18n';

export default function ThemeToggle() {
  const {theme, toggleTheme} = useTheme();
  const {t} = useLang();
  const isDark = theme === 'dark';

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isDark ? t('theme_switch_to_light') : t('theme_switch_to_dark')}
      title={isDark ? t('theme_light') : t('theme_dark')}
      className="relative inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-sm transition-colors hover:bg-slate-100 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-white"
    >
      <span className="transition-transform duration-300" key={theme}>
        {isDark ? (
          <Sun className="h-5 w-5 animate-pop" />
        ) : (
          <Moon className="h-5 w-5 animate-pop" />
        )}
      </span>
    </button>
  );
}
