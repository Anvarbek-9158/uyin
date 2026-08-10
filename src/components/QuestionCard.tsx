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
    <div className="bg-slate-900/90 border-2 border-indigo-500/40 rounded-3xl p-6 sm:p-10 shadow-[0_0_40px_rgba(79,70,229,0.25)] relative overflow-hidden backdrop-blur-xl">
      {/* Background ambient glows */}
      <div className="absolute -top-24 -right-24 w-72 h-72 bg-indigo-500/15 blur-3xl rounded-full pointer-events-none" />
      <div className="absolute -bottom-24 -left-24 w-72 h-72 bg-indigo-500/15 blur-3xl rounded-full pointer-events-none" />

      {/* Top Banner & Category */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6 pb-5 border-b-2 border-white/10 relative z-10">
        <div className="flex items-center gap-3">
          <span className="px-4 py-1.5 rounded-full text-xs sm:text-sm font-black uppercase tracking-wider bg-indigo-600 text-white shadow-[0_0_15px_rgba(99,102,241,0.6)] border border-indigo-400/40">
            {question.category || 'Aktiv Savol'}
          </span>
          <span className="text-xs sm:text-sm font-mono uppercase font-extrabold text-indigo-300 tracking-wider">
            Savollar Navbati ({questionIndex + 1}/{totalQuestions})
          </span>
        </div>

        {/* Timer Badge */}
        <div
          className={`flex items-center gap-2.5 px-5 py-2 sm:py-2.5 rounded-2xl border-2 transition-all ${
            timerSeconds <= 5
              ? 'bg-rose-500/25 border-rose-500 text-rose-300 animate-pulse shadow-[0_0_20px_rgba(244,63,94,0.5)]'
              : 'bg-slate-950 border-indigo-500/60 text-indigo-300 shadow-[0_0_15px_rgba(79,70,229,0.3)]'
          }`}
        >
          <Clock className="w-5 h-5 sm:w-6 sm:h-6 shrink-0 text-amber-400" />
          <span className="font-mono font-black text-lg sm:text-xl md:text-2xl">
            {timerSeconds}s
          </span>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="w-full bg-slate-950 h-3 rounded-full mb-8 overflow-hidden border border-white/10 relative z-10">
        <div
          className={`h-full transition-all duration-1000 ease-linear ${
            timerSeconds <= 5
              ? 'bg-rose-500 shadow-[0_0_15px_#f43f5e]'
              : 'bg-gradient-to-r from-indigo-500 to-purple-500 shadow-[0_0_15px_rgba(99,102,241,0.8)]'
          }`}
          style={{ width: `${percentLeft}%` }}
        />
      </div>

      {/* Question Text */}
      <div className="mb-10 relative z-10">
        <div className="flex items-start gap-4 sm:gap-5">
          <div className="p-3.5 sm:p-4 rounded-2xl bg-indigo-600 text-white shadow-[0_0_20px_rgba(79,70,229,0.6)] border border-indigo-400/50 shrink-0 mt-1">
            <HelpCircle className="w-7 h-7 sm:w-9 sm:h-9" />
          </div>
          <h2 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-extrabold leading-snug tracking-tight text-white">
            {question.text}
          </h2>
        </div>
      </div>

      {/* Multiple Choice Options if present */}
      {question.options && question.options.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5 mb-2 relative z-10">
          {question.options.map((opt, idx) => {
            const letters = ['A', 'B', 'C', 'D'];
            const isSelected = selectedOption === opt;

            return (
              <button
                key={idx}
                disabled={!isAnsweringUnlocked || !isLeader}
                onClick={() => onSelectOption && onSelectOption(opt)}
                className={`flex items-center justify-between p-5 sm:p-6 rounded-2xl border-2 text-left transition-all ${
                  isSelected
                    ? 'bg-indigo-600/30 border-indigo-400 text-white ring-2 ring-indigo-400/60 shadow-[0_0_25px_rgba(79,70,229,0.4)]'
                    : 'bg-slate-950/80 border-white/15 text-slate-100 hover:bg-slate-900 hover:border-indigo-500/60'
                } ${
                  !isAnsweringUnlocked || !isLeader
                    ? 'cursor-not-allowed opacity-90'
                    : 'cursor-pointer'
                }`}
              >
                <div className="flex items-center gap-4 min-w-0">
                  <span className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl font-black text-base sm:text-lg flex items-center justify-center shrink-0 border ${
                    isSelected ? 'bg-indigo-600 text-white border-indigo-300 shadow-[0_0_12px_rgba(99,102,241,0.8)]' : 'bg-slate-800 text-slate-200 border-white/10'
                  }`}>
                    {letters[idx] || idx + 1}
                  </span>
                  <span className="font-bold text-base sm:text-xl md:text-2xl leading-snug break-words">{opt}</span>
                </div>
                {isSelected && <CheckCircle2 className="w-6 h-6 sm:w-7 sm:h-7 text-indigo-400 shrink-0 ml-2" />}
              </button>
            );
          })}
        </div>
      ) : (
        <div className="p-5 rounded-2xl bg-amber-500/15 border-2 border-amber-500/40 text-amber-200 text-sm sm:text-base font-bold flex items-center gap-3 mb-2 relative z-10 shadow-lg">
          <Sparkles className="w-6 h-6 text-amber-400 shrink-0" />
          <span>Ushbu savol ochiq javobli (variantsiz). Guruh sardori o'z javobini quyida matn ko'rinishida yozib yuboradi, o'qituvchi o'qib tekshiradi.</span>
        </div>
      )}
    </div>
  );
};
