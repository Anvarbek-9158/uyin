import React, { useEffect, useState } from 'react';
import { Play, X, HelpCircle, Clock, Tag } from 'lucide-react';
import { Question } from '../types';
import { useLang, getQuestionInLanguage, translateDiplicity, translateCategory } from '../i18n';

interface QuestionSelectModalProps {
  isOpen: boolean;
  onClose: () => void;
  questions: Question[];
  onSelectQuestion: (originalIndex: number) => void;
  usedQuestionIds?: string[];
}

export const QuestionSelectModal: React.FC<QuestionSelectModalProps> = ({
  isOpen,
  onClose,
  questions,
  onSelectQuestion,
  usedQuestionIds = [],
}) => {
  const { lang, t } = useLang();
  const [selectedDifficulty, setSelectedDifficulty] = useState<'Barchasi' | 'Oson' | "O'rta" | 'Qiyin'>('Barchasi');

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const osonCount = questions.filter((q) => (q.difficulty || "O'rta") === 'Oson').length;
  const ortaCount = questions.filter((q) => (q.difficulty || "O'rta") === "O'rta").length;
  const qiyinCount = questions.filter((q) => (q.difficulty || "O'rta") === 'Qiyin').length;

  const filteredQuestions = questions.map((q, idx) => ({ q, originalIndex: idx })).filter(({ q }) => {
    const diff = q.difficulty || "O'rta";
    if (selectedDifficulty === 'Barchasi') return true;
    return diff === selectedDifficulty;
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-surface-sunken backdrop-blur-md animate-[var(--animate-fade-in)]"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-surface border border-line rounded-2xl max-w-3xl w-full p-5 sm:p-6 shadow-2xl relative flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-line shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-play-500 text-surface-sunken shadow-[var(--shadow-pop-play)]">
              <Play className="w-5 h-5 fill-current" />
            </div>
            <div>
              <h3 className="text-lg sm:text-xl font-bold text-ink uppercase tracking-tight">
                {t('qsm_title')}
              </h3>
              <p className="text-xs text-ink-faint">
                {t('qsm_sub')}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            aria-label={t('close')}
            className="inline-flex items-center justify-center h-10 w-10 text-ink-faint hover:text-ink rounded-xl hover:bg-surface-raised transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Difficulty Category Tabs */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 py-4 shrink-0">
          <button
            type="button"
            onClick={() => setSelectedDifficulty('Barchasi')}
            className={`py-2.5 px-4 rounded-xl border text-xs sm:text-sm font-extrabold transition-all flex items-center justify-center gap-2 cursor-pointer ${
              selectedDifficulty === 'Barchasi'
                ? 'bg-brand-600 text-ink border-brand-500 shadow-[var(--shadow-pop-brand)]'
                : 'bg-surface-sunken border-line text-ink-soft hover:text-ink'
            }`}
          >
            {t('qsm_all')} ({questions.length})
          </button>

          <button
            type="button"
            onClick={() => setSelectedDifficulty('Oson')}
            className={`py-2.5 px-4 rounded-xl border text-xs sm:text-sm font-extrabold transition-all flex items-center justify-center gap-2 cursor-pointer ${
              selectedDifficulty === 'Oson'
                ? 'bg-play-500/20 text-play-400 border-play-500/80 shadow-[var(--shadow-pop-play)]'
                : 'bg-surface-sunken border-line text-ink-soft hover:text-ink'
            }`}
          >
            🟢 {translateDiplicity('Oson', lang)} ({osonCount})
          </button>

          <button
            type="button"
            onClick={() => setSelectedDifficulty("O'rta")}
            className={`py-2.5 px-4 rounded-xl border text-xs sm:text-sm font-extrabold transition-all flex items-center justify-center gap-2 cursor-pointer ${
              selectedDifficulty === "O'rta"
                ? 'bg-warn-500/20 text-warn-400 border-warn-500/80 shadow-[0_0_15px_rgba(245,158,11,0.3)]'
                : 'bg-surface-sunken border-line text-ink-soft hover:text-ink'
            }`}
          >
            🟡 {translateDiplicity("O'rta", lang)} ({ortaCount})
          </button>

          <button
            type="button"
            onClick={() => setSelectedDifficulty('Qiyin')}
            className={`py-2.5 px-4 rounded-xl border text-xs sm:text-sm font-extrabold transition-all flex items-center justify-center gap-2 cursor-pointer ${
              selectedDifficulty === 'Qiyin'
                ? 'bg-danger-500/20 text-danger-400 border-danger-500/80 shadow-[0_0_15px_rgba(244,63,94,0.3)]'
                : 'bg-surface-sunken border-line text-ink-soft hover:text-ink'
            }`}
          >
            🔴 {translateDiplicity('Qiyin', lang)} ({qiyinCount})
          </button>
        </div>

        {/* Questions list */}
        <div className="overflow-y-auto pr-1 space-y-3 flex-1">
          {(() => {
            const usedSet = new Set(usedQuestionIds);
            const remainingCount = questions.filter((q) => !usedSet.has(q.id)).length;

            if (questions.length === 0) {
              return (
                <div className="p-8 text-center rounded-2xl bg-surface-sunken border border-dashed border-line text-ink-faint">
                  {t('qsm_empty_bank')}
                </div>
              );
            }

            if (filteredQuestions.length === 0) {
              return (
                <div className="p-8 text-center rounded-2xl bg-surface-sunken border border-dashed border-line text-ink-faint">
                  {t('qsm_empty_section')}
                </div>
              );
            }

            return (
              <>
                {remainingCount === 0 && (
                  <div className="p-4 text-center rounded-2xl bg-warn-500/10 border border-warn-500/40 text-warn-400 text-sm font-bold">
                    {t('qsm_all_used')}
                  </div>
                )}

                {filteredQuestions.map(({ q, originalIndex }) => {
                  const diff = q.difficulty || "O'rta";
                  const used = usedSet.has(q.id);
                  const qq = getQuestionInLanguage(q, lang);
                  const diffBadgeClass =
                    diff === 'Oson'
                      ? 'bg-play-500/20 text-play-400 border-play-500/30'
                      : diff === 'Qiyin'
                      ? 'bg-danger-500/20 text-danger-400 border-danger-500/30'
                      : 'bg-warn-500/20 text-warn-400 border-warn-500/30';

                  return (
                    <div
                      key={q.id || originalIndex}
                      className={`p-4 rounded-xl bg-surface-sunken border transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 group ${
                        used ? 'border-line opacity-50' : 'border-line hover:border-play-500/40'
                      }`}
                    >
                      <div className="space-y-1.5 flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className=" text-xs font-bold text-brand-400">
                            {t('qsm_question')}{originalIndex + 1}
                          </span>

                          <span className={`text-xs px-2 py-1 rounded border font-bold uppercase ${diffBadgeClass}`}>
                            {translateDiplicity(diff, lang)}
                          </span>

                          {q.category && (
                            <span className="text-xs px-2 py-1 rounded bg-surface border border-line text-ink-faint flex items-center gap-1">
                              <Tag className="w-3 h-3 text-ink-faint" />
                              {translateCategory(q.category, lang)}
                            </span>
                          )}

                          <span className="text-xs px-2 py-1 rounded bg-surface border border-line text-ink-faint flex items-center gap-1">
                            <Clock className="w-3 h-3 text-ink-faint" />
                            {q.timeLimit} {t('qsm_seconds')}
                          </span>
                        </div>

                        <p className="text-sm font-semibold text-ink leading-relaxed">
                          {qq.text}
                        </p>

                        <div className="text-xs text-ink-faint italic">
                          {t('qsm_hidden')}
                        </div>
                      </div>

                      {used ? (
                        <span className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-surface-raised text-ink-faint font-black text-xs uppercase tracking-wider shrink-0 text-center">
                          ✅ {t('qsm_used')}
                        </span>
                      ) : (
                        <button
                          data-testid="q-start"
                          onClick={() => {
                            onSelectQuestion(originalIndex);
                            onClose();
                          }}
                          className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-play-500 hover:bg-play-400 text-surface-sunken font-black text-xs uppercase tracking-wider shadow-[var(--shadow-pop-play)] transition-all cursor-pointer flex items-center justify-center gap-2 shrink-0 group-hover:scale-105"
                        >
                          <Play className="w-4 h-4 fill-surface-sunken" />
                          {t('qsm_select_start')}
                        </button>
                      )}
                    </div>
                  );
                })}
              </>
            );
          })()}
        </div>

        {/* Modal Footer */}
        <div className="pt-4 border-t border-line flex justify-end shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-ink-faint hover:text-ink text-xs font-bold uppercase tracking-wider"
          >
            {t('close')}
          </button>
        </div>
      </div>
    </div>
  );
};
