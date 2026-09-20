import {useEffect, useRef, useState} from 'react';
import {Languages, Check} from 'lucide-react';
import {useLang, type Language} from '../i18n';

const LANG_OPTIONS: {value: Language; label: string}[] = [
  {value: 'uz', label: 'UZB'},
  {value: 'ru', label: 'RUS'},
  {value: 'en', label: 'ENG'},
];

// A single component used for BOTH desktop and mobile — the old app broke
// language switching because it rendered two separate LangDropdown copies
// (desktop + mobile) with two separate refs, and a shared "click outside"
// handler treated a click inside EITHER one as "outside the other", closing
// the menu before the selection was ever read. Here there is only ever one
// instance mounted at a time (the caller decides where to render it), one
// ref, and one state — so that entire bug class cannot happen again.
export function LangSwitcher({compact = false}: {compact?: boolean}) {
  const {lang, setLang} = useLang();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onOutside = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onEscape = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onOutside);
    document.addEventListener('keydown', onEscape);
    return () => {
      document.removeEventListener('mousedown', onOutside);
      document.removeEventListener('keydown', onEscape);
    };
  }, [open]);

  const current = LANG_OPTIONS.find((o) => o.value === lang) ?? LANG_OPTIONS[0];

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={[
          'inline-flex h-10 items-center gap-1.5 rounded-xl border border-line bg-surface-raised text-xs font-bold uppercase tracking-wider text-ink-soft transition-colors hover:text-ink hover:border-line-strong',
          compact ? 'w-10 justify-center' : 'px-3',
        ].join(' ')}
      >
        <Languages className="h-4 w-4" />
        {!compact && current.label}
      </button>
      {open && (
        <div
          role="listbox"
          className="absolute right-0 top-full z-30 mt-2 w-32 overflow-hidden rounded-xl border border-line bg-surface-raised shadow-[var(--shadow-card-hover)] animate-[var(--animate-fade-up)]"
        >
          {LANG_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              role="option"
              aria-selected={opt.value === lang}
              onClick={() => {
                setLang(opt.value);
                setOpen(false);
              }}
              className="flex w-full items-center justify-between gap-2 px-4 py-2.5 text-left text-sm font-bold text-ink-soft transition-colors hover:bg-surface hover:text-ink"
            >
              <span className="uppercase tracking-wider">{opt.label}</span>
              {opt.value === lang && <Check className="h-4 w-4 text-brand-400" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
