import React from 'react';
import { Team, Student } from '../types';
import { Trophy, Crown, CheckCircle2, Skull } from 'lucide-react';
import { useLang } from '../i18n';

interface LeaderboardProps {
  teams: Record<string, Team>;
  students: Record<string, Student>;
  currentPhase?: string;
}

export const Leaderboard: React.FC<LeaderboardProps> = ({
  teams,
  students,
  currentPhase,
}) => {
  const { t } = useLang();
  const teamList = (Object.values(teams || {}) as Team[]).sort((a, b) => b.score - a.score);

  return (
    <div className="bg-slate-900/90 border-2 border-indigo-500/30 rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-xl">
      <div className="flex flex-wrap items-center justify-between gap-2 pb-5 mb-5 border-b-2 border-white/10">
        <div className="flex items-center gap-3">
          <Trophy className="w-6 h-6 sm:w-7 sm:h-7 text-amber-400 shrink-0" />
          <h3 className="font-extrabold text-white text-xl sm:text-2xl uppercase tracking-tight">
            {t('lb_title')}
          </h3>
        </div>
        <span className="text-xs sm:text-sm font-mono font-black uppercase tracking-wider px-3.5 py-1.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/40">
          {teamList.length} {t('lb_teams')}
        </span>
      </div>

      {teamList.length === 0 ? (
        <div className="text-center py-10 text-slate-400 text-sm sm:text-base font-mono uppercase tracking-widest font-bold">
          {t('lb_empty')}
        </div>
      ) : (
        <div className="space-y-4">
          {teamList.map((team, index) => {
            const leader = team.leaderClientId ? students[team.leaderClientId] : null;
            const isEliminated = team.isEliminated || team.score <= 0;
            const accentColors = ['#06b6d4', '#f59e0b', '#f43f5e', '#6366f1', '#10b981', '#a855f7'];
            const teamAccent = team.color || accentColors[index % accentColors.length];

            return (
              <div
                key={team.id}
                className={`p-4 sm:p-5 rounded-2xl border-2 relative overflow-hidden transition-all ${
                  isEliminated
                    ? 'bg-slate-950/80 border-rose-900/50 opacity-70'
                    : index === 0
                    ? 'bg-indigo-950/40 border-amber-500/60 shadow-[0_0_25px_rgba(245,158,11,0.2)] ring-1 ring-amber-500/50'
                    : 'bg-slate-950/70 border-white/10 hover:border-white/20'
                }`}
              >
                {/* Left vertical team color accent bar */}
                <div
                  className="absolute top-0 left-0 w-2 h-full"
                  style={{ backgroundColor: teamAccent }}
                />

                <div className="pl-3">
                  {/* ROW 1: rank + name + eliminated badge (left) | score badge (right) */}
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <span
                        className={`w-10 h-10 sm:w-11 sm:h-11 rounded-xl font-black font-mono text-sm flex items-center justify-center shrink-0 border ${
                          index === 0
                            ? 'bg-amber-400 text-slate-950 border-amber-300 shadow-[0_0_15px_rgba(245,158,11,0.6)]'
                            : index === 1
                            ? 'bg-slate-200 text-slate-950 border-white'
                            : index === 2
                            ? 'bg-amber-700 text-white border-amber-500'
                            : 'bg-slate-800 text-slate-300 border-white/10'
                        }`}
                      >
                        {String(index + 1).padStart(2, '0')}
                      </span>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className="w-3 h-3 rounded-full shrink-0 shadow-sm border border-white/20"
                            style={{ backgroundColor: teamAccent }}
                          />
                          <h4 className="font-extrabold text-white text-lg sm:text-xl truncate">
                            {team.name}
                          </h4>
                        </div>
                        {isEliminated && (
                          <span className="inline-flex items-center gap-1 mt-1 text-xs font-black uppercase px-2 py-0.5 rounded-md bg-rose-500/20 text-rose-300 border border-rose-500/40">
                            <Skull className="w-3 h-3" /> {t('lb_exited')}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Score badge (right-aligned, always visible) */}
                    <div className="bg-slate-950 px-3.5 py-1.5 sm:px-4 sm:py-2 rounded-2xl border-2 border-indigo-500/40 shadow-inner shrink-0 text-right">
                      <div className="text-xs uppercase font-black text-slate-400 tracking-widest">
                        {t('lb_points')}
                      </div>
                      <div className="font-mono font-black text-indigo-400 text-xl sm:text-2xl leading-none text-center">
                        {team.score}
                      </div>
                    </div>
                  </div>

                  {/* ROW 2: leader + members + bet / answer status meta line */}
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 mt-2.5 text-xs sm:text-sm text-slate-300">
                    {leader && (
                      <span className="flex items-center gap-1.5 text-indigo-300 font-bold min-w-0">
                        <Crown className="w-4 h-4 text-amber-400 shrink-0" />
                        <span className="truncate">{t('lb_leader')}{leader.name}</span>
                      </span>
                    )}
                    <span className="text-xs font-mono font-bold text-slate-400 uppercase whitespace-nowrap">
                      {team.memberIds.length} {t('lb_member')}
                    </span>

                    {team.currentBet !== null && (
                      <span className="inline-flex items-center gap-1.5 text-xs font-black text-amber-400 uppercase tracking-wider whitespace-nowrap">
                        <span>{t('lb_bet')}</span>
                        <span className="font-mono text-sm">🔥 {team.currentBet}</span>
                      </span>
                    )}

                    {currentPhase === 'ANSWERING' &&
                      (team.currentAnswer ? (
                        <span className="inline-flex items-center gap-1 text-xs uppercase font-extrabold px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 whitespace-nowrap">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> {t('lb_submitted')}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs uppercase font-extrabold px-2.5 py-1 rounded-full bg-slate-800 text-slate-300 border border-slate-700 animate-pulse whitespace-nowrap">
                          {t('lb_thinking')}
                        </span>
                      ))}
                  </div>

                  {/* ROW 3 (only after a round): separated result strip */}
                  {team.lastResult && (
                    <div
                      className={`mt-3 rounded-xl px-3 py-2 text-xs font-semibold flex items-center justify-between gap-3 border ${
                        team.lastResult.isCorrect
                          ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                          : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                      }`}
                    >
                      <span className="truncate">
                        {team.lastResult.isCorrect ? t('lb_correct') : t('lb_wrong')} (
                        {team.lastResult.answer})
                      </span>
                      <span className="font-mono font-extrabold whitespace-nowrap shrink-0">
                        {team.lastResult.isCorrect ? '+' : ''}
                        {team.lastResult.pointsDelta} {t('lb_points')}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
