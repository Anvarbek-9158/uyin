import React from 'react';
import { Question } from '../types';
import { Clock, HelpCircle, Sparkles, CheckCircle2 } from 'lucide-react';

interface QuestionCardProps {
  question: Question;
  questionIndex: number;
  totalQuestions: number;
  timerSeconds: number;
  isAnsweringUnlocked: boolean;
  selectedOption?: string;
  onSelectOption?: (option: string) => void;
  isLeader?: boolean;
}

export const QuestionCard: React.FC<QuestionCardProps> = ({
  question,
  questionIndex,
  totalQuestions,
  timerSeconds,
  isAnsweringUnlocked,
  selectedOption,
  onSelectOption,
  isLeader = false,
}) => {
  const percentLeft = Math.max(0, Math.min(100, (timerSeconds / question.timeLimit) * 100));

  return (
    <div className="bg-indigo-600/10 border border-indigo-500/30 rounded-2xl p-6 sm:p-8 shadow-[0_0_30px_rgba(79,70,229,0.15)] relative overflow-hidden backdrop-blur-md">
      {/* Background ambient glows */}
      <div className="absolute -top-24 -right-24 w-64 h-64 bg-indigo-500/10 blur-3xl rounded-full pointer-events-none" />
      <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-indigo-500/10 blur-3xl rounded-full pointer-events-none" />

      {/* Top Banner & Category */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6 pb-4 border-b border-white/10 relative z-10">
        <div className="flex items-center gap-2">
          <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-indigo-500 text-white shadow-[0_0_10px_rgba(99,102,241,0.5)]">
            {question.category || 'Aktiv Savol'}
          </span>
          <span className="text-[10px] font-mono uppercase font-bold text-slate-400 tracking-wider">
            Savollar Navbati ({questionIndex + 1}/{totalQuestions})
          </span>
        </div>

        {/* Timer Badge */}
        <div
          className={`flex items-center gap-2 px-4 py-1.5 rounded-xl border transition-all ${
            timerSeconds <= 5
              ? 'bg-rose-500/20 border-rose-500/50 text-rose-400 animate-pulse shadow-[0_0_12px_rgba(244,63,94,0.4)]'
              : 'bg-slate-900/80 border-indigo-500/40 text-indigo-300 shadow-[0_0_12px_rgba(79,70,229,0.2)]'
          }`}
        >
          <Clock className="w-4 h-4" />
          <span className="font-mono font-black text-base sm:text-lg">
            {timerSeconds}s
          </span>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="w-full bg-slate-950/80 h-2 rounded-full mb-6 overflow-hidden border border-white/5 relative z-10">
        <div
          className={`h-full transition-all duration-1000 ease-linear ${
            timerSeconds <= 5
              ? 'bg-rose-500 shadow-[0_0_10px_#f43f5e]'
              : 'bg-indigo-500 shadow-[0_0_12px_rgba(99,102,241,0.6)]'
          }`}
          style={{ width: `${percentLeft}%` }}
        />
      </div>

      {/* Question Text */}
      <div className="mb-8 relative z-10">
        <div className="flex items-start gap-4">
          <div className="p-3 rounded-xl bg-indigo-600 text-white shadow-[0_0_15px_rgba(79,70,229,0.5)] shrink-0 mt-1">
            <HelpCircle className="w-6 h-6" />
          </div>
          <h2 className="text-2xl sm:text-3xl font-serif leading-tight text-white">
            {question.text}
          </h2>
        </div>
      </div>

      {/* Multiple Choice Options if present */}
      {question.options && question.options.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-2 relative z-10">
          {question.options.map((opt, idx) => {
            const letters = ['A', 'B', 'C', 'D'];
            const isSelected = selectedOption === opt;

            return (
              <button
                key={idx}
                disabled={!isAnsweringUnlocked || !isLeader}
                onClick={() => onSelectOption && onSelectOption(opt)}
                className={`flex items-center justify-between p-4 rounded-xl border text-left transition-all ${
                  isSelected
                    ? 'bg-indigo-500/20 border-indigo-500 text-white ring-1 ring-indigo-500/50 shadow-[0_0_15px_rgba(79,70,229,0.3)]'
                    : 'bg-slate-900/60 border-white/10 text-slate-200 hover:bg-slate-900 hover:border-indigo-500/40'
                } ${
                  !isAnsweringUnlocked || !isLeader
                    ? 'cursor-not-allowed opacity-90'
                    : 'cursor-pointer'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className={`w-8 h-8 rounded-lg font-bold text-xs flex items-center justify-center shrink-0 ${
                    isSelected ? 'bg-indigo-500 text-white shadow-[0_0_8px_rgba(99,102,241,0.6)]' : 'bg-slate-800 text-slate-300'
                  }`}>
                    {letters[idx] || idx + 1}
                  </span>
                  <span className="font-semibold text-sm sm:text-base">{opt}</span>
                </div>
                {isSelected && <CheckCircle2 className="w-5 h-5 text-indigo-400 shrink-0" />}
              </button>
            );
          })}
        </div>
      ) : (
        <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs font-semibold flex items-center gap-2 mb-2 relative z-10">
          <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
          <span>Ushbu savol ochiq javobli (variantsiz). Guruh sardori o'z javobini quyida matn ko'rinishida yozib yuboradi, o'qituvchi o'qib tekshiradi.</span>
        </div>
      )}
    </div>
  );
};
