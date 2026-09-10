import React, { useState } from 'react';
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-md animate-fade-in">
      <div className="bg-slate-900 border border-white/10 rounded-2xl max-w-3xl w-full p-5 sm:p-6 shadow-2xl relative flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/10 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-500 text-slate-950 shadow-[0_0_15px_rgba(16,185,129,0.4)]">
              <Play className="w-5 h-5 fill-current" />
            </div>
            <div>
              <h3 className="text-lg sm:text-xl font-bold text-white uppercase tracking-tight">
                {t('qsm_title')}
              </h3>
              <p className="text-xs text-slate-400 font-mono">
                {t('qsm_sub')}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1.5 rounded-xl hover:bg-slate-800 transition-colors"
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
                ? 'bg-indigo-600 text-white border-indigo-500 shadow-[0_0_15px_rgba(79,70,229,0.5)]'
                : 'bg-slate-950 border-white/10 text-slate-300 hover:text-white'
            }`}
          >
            {t('qsm_all')} ({questions.length})
          </button>

          <button
            type="button"
            onClick={() => setSelectedDifficulty('Oson')}
            className={`py-2.5 px-4 rounded-xl border text-xs sm:text-sm font-extrabold transition-all flex items-center justify-center gap-2 cursor-pointer ${
              selectedDifficulty === 'Oson'
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/80 shadow-[0_0_15px_rgba(16,185,129,0.3)]'
                : 'bg-slate-950 border-white/10 text-slate-300 hover:text-white'
            }`}
          >
            🟢 {translateDiplicity('Oson', lang)} ({osonCount})
          </button>

          <button
            type="button"
            onClick={() => setSelectedDifficulty("O'rta")}
            className={`py-2.5 px-4 rounded-xl border text-xs sm:text-sm font-extrabold transition-all flex items-center justify-center gap-2 cursor-pointer ${
              selectedDifficulty === "O'rta"
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/80 shadow-[0_0_15px_rgba(245,158,11,0.3)]'
                : 'bg-slate-950 border-white/10 text-slate-300 hover:text-white'
            }`}
          >
            🟡 {translateDiplicity("O'rta", lang)} ({ortaCount})
          </button>

          <button
            type="button"
            onClick={() => setSelectedDifficulty('Qiyin')}
            className={`py-2.5 px-4 rounded-xl border text-xs sm:text-sm font-extrabold transition-all flex items-center justify-center gap-2 cursor-pointer ${
              selectedDifficulty === 'Qiyin'
                ? 'bg-rose-500/20 text-rose-300 border-rose-500/80 shadow-[0_0_15px_rgba(244,63,94,0.3)]'
                : 'bg-slate-950 border-white/10 text-slate-300 hover:text-white'
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
                <div className="p-8 text-center rounded-2xl bg-slate-950/60 border border-dashed border-white/10 text-slate-400">
                  {t('qsm_empty_bank')}
                </div>
              );
            }

            if (filteredQuestions.length === 0) {
              return (
                <div className="p-8 text-center rounded-2xl bg-slate-950/60 border border-dashed border-white/10 text-slate-400">
                  {t('qsm_empty_section')}
                </div>
              );
            }

            return (
              <>
                {remainingCount === 0 && (
                  <div className="p-4 text-center rounded-2xl bg-amber-500/10 border border-amber-500/40 text-amber-300 text-sm font-bold">
                    {t('qsm_all_used')}
                  </div>
                )}

                {filteredQuestions.map(({ q, originalIndex }) => {
                  const diff = q.difficulty || "O'rta";
                  const used = usedSet.has(q.id);
                  const qq = getQuestionInLanguage(q, lang);
                  const diffBadgeClass =
                    diff === 'Oson'
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                      : diff === 'Qiyin'
                      ? 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                      : 'bg-amber-500/20 text-amber-300 border-amber-500/30';

                  return (
                    <div
                      key={q.id || originalIndex}
                      className={`p-4 rounded-xl bg-slate-950 border transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 group ${
                        used ? 'border-white/5 opacity-50' : 'border-white/10 hover:border-emerald-500/40'
                      }`}
                    >
                      <div className="space-y-1.5 flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-xs font-bold text-indigo-400">
                            {t('qsm_question')}{originalIndex + 1}
                          </span>

                          <span className={`text-[11px] px-2 py-0.5 rounded border font-bold uppercase ${diffBadgeClass}`}>
                            {translateDiplicity(diff, lang)}
                          </span>

                          {q.category && (
                            <span className="text-[11px] px-2 py-0.5 rounded bg-slate-900 border border-white/10 text-slate-400 flex items-center gap-1 font-mono">
                              <Tag className="w-3 h-3 text-slate-500" />
                              {translateCategory(q.category, lang)}
                            </span>
                          )}

                          <span className="text-[11px] px-2 py-0.5 rounded bg-slate-900 border border-white/10 text-slate-400 flex items-center gap-1 font-mono">
                            <Clock className="w-3 h-3 text-slate-500" />
                            {q.timeLimit} {t('qsm_seconds')}
                          </span>
                        </div>

                        <p className="text-sm font-semibold text-white leading-relaxed">
                          {qq.text}
                        </p>

                        <div className="text-[11px] text-slate-500 font-mono italic">
                          {t('qsm_hidden')}
                        </div>
                      </div>

                      {used ? (
                        <span className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-slate-800 text-slate-400 font-black text-xs uppercase tracking-wider shrink-0 text-center">
                          ✓ {t('qsm_used')}
                        </span>
                      ) : (
                        <button
                          data-testid="q-start"
                          onClick={() => {
                            onSelectQuestion(originalIndex);
                            onClose();
                          }}
                          className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs uppercase tracking-wider shadow-[0_0_15px_rgba(16,185,129,0.3)] transition-all cursor-pointer flex items-center justify-center gap-2 shrink-0 group-hover:scale-105"
                        >
                          <Play className="w-4 h-4 fill-slate-950" />
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
        <div className="pt-4 border-t border-white/10 flex justify-end shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-slate-400 hover:text-white text-xs font-bold uppercase tracking-wider"
          >
            {t('close')}
          </button>
        </div>
      </div>
    </div>
  );
};
