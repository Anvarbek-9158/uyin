import React from 'react';
import { Team, Student } from '../types';
import { Trophy, Crown, CheckCircle2, Skull } from 'lucide-react';
import { useLang } from '../i18n';
import { ACCENT_COLORS } from '../utils/teamColors';

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
    <div className="bg-surface/95 border-2 border-brand-300 rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-xl">
      <div className="flex flex-wrap items-center justify-between gap-2 pb-5 mb-5 border-b-2 border-line">
        <div className="flex items-center gap-3">
          <Trophy className="w-6 h-6 sm:w-7 sm:h-7 text-warn-400 shrink-0" />
          <h3 className="font-extrabold text-ink text-xl sm:text-2xl uppercase tracking-tight">
            {t('lb_title')}
          </h3>
        </div>
        <span className="text-xs sm:text-sm font-black uppercase tracking-wider px-3.5 py-1.5 rounded-full bg-brand-500/20 text-brand-300 border border-brand-300">
          {teamList.length} {t('lb_teams')}
        </span>
      </div>

      {teamList.length === 0 ? (
        <div className="text-center py-10 text-ink-faint text-sm sm:text-base uppercase tracking-widest font-bold">
          {t('lb_empty')}
        </div>
      ) : (
        <div className="space-y-4">
          {teamList.map((team, index) => {
            const leader = team.leaderClientId ? students[team.leaderClientId] : null;
            const isEliminated = team.isEliminated || team.score <= 0;
            const teamAccent = team.color || ACCENT_COLORS[index % ACCENT_COLORS.length];

            return (
              <div
                key={team.id}
                className={`p-4 sm:p-5 rounded-2xl border-2 relative overflow-hidden transition-all ${
                  isEliminated
                    ? 'bg-surface-sunken border-danger-600/50 opacity-70'
                    : index === 0
                    ? 'bg-brand-700/40 border-warn-500/60 shadow-[0_0_25px_rgba(245,158,11,0.2)] ring-1 ring-warn-500/50'
                    : 'bg-surface-sunken border-line hover:border-line'
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
                        className={`w-10 h-10 sm:w-11 sm:h-11 rounded-xl font-black text-sm flex items-center justify-center shrink-0 border ${
                          index === 0
                            ? 'bg-warn-400 text-surface-sunken border-warn-400 shadow-[0_0_15px_rgba(245,158,11,0.6)]'
                            : index === 1
                            ? 'bg-line text-surface-sunken border-white'
                            : index === 2
                            ? 'bg-warn-500 text-ink border-warn-500'
                            : 'bg-surface-raised text-ink-soft border-line'
                        }`}
                      >
                        {String(index + 1).padStart(2, '0')}
                      </span>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className="w-3 h-3 rounded-full shrink-0 shadow-sm border border-line"
                            style={{ backgroundColor: teamAccent }}
                          />
                          <h4 className="font-extrabold text-ink text-lg sm:text-xl truncate">
                            {team.name}
                          </h4>
                        </div>
                        {isEliminated && (
                          <span className="inline-flex items-center gap-1 mt-1 text-xs font-black uppercase px-2 py-0.5 rounded-md bg-danger-500/20 text-danger-400 border border-danger-500/40">
                            <Skull className="w-3 h-3" /> {t('lb_exited')}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Score badge (right-aligned, always visible) */}
                    <div className="bg-surface-sunken px-3.5 py-1.5 sm:px-4 sm:py-2 rounded-2xl border-2 border-brand-300 shadow-inner shrink-0 text-right">
                      <div className="text-xs uppercase font-black text-ink-faint tracking-widest">
                        {t('lb_points')}
                      </div>
                      <div className=" font-black text-brand-400 text-xl sm:text-2xl leading-none text-center">
                        {team.score}
                      </div>
                    </div>
                  </div>

                  {/* ROW 2: leader + members + bet / answer status meta line */}
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 mt-2.5 text-xs sm:text-sm text-ink-soft">
                    {leader && (
                      <span className="flex items-center gap-1.5 text-brand-300 font-bold min-w-0">
                        <Crown className="w-4 h-4 text-warn-400 shrink-0" />
                        <span className="truncate">{t('lb_leader')}{leader.name}</span>
                      </span>
                    )}
                    <span className="text-xs font-bold text-ink-faint uppercase whitespace-nowrap">
                      {team.memberIds.length} {t('lb_member')}
                    </span>

                    {team.currentBet !== null && (
                      <span className="inline-flex items-center gap-1.5 text-xs font-black text-warn-400 uppercase tracking-wider whitespace-nowrap">
                        <span>{t('lb_bet')}</span>
                        <span className=" text-sm">🔥 {team.currentBet}</span>
                      </span>
                    )}

                    {currentPhase === 'ANSWERING' &&
                      (team.currentAnswer ? (
                        <span className="inline-flex items-center gap-1 text-xs uppercase font-extrabold px-2.5 py-1 rounded-full bg-play-500/20 text-play-400 border border-play-500/40 whitespace-nowrap">
                          <CheckCircle2 className="w-3.5 h-3.5 text-play-400" /> {t('lb_submitted')}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs uppercase font-extrabold px-2.5 py-1 rounded-full bg-surface-raised text-ink-soft border border-line animate-pulse whitespace-nowrap">
                          {t('lb_thinking')}
                        </span>
                      ))}
                  </div>

                  {/* ROW 3 (only after a round): separated result strip */}
                  {team.lastResult && (
                    <div
                      className={`mt-3 rounded-xl px-3 py-2 text-xs font-semibold flex items-center justify-between gap-3 border ${
                        team.lastResult.isCorrect
                          ? 'bg-play-500/10 border-play-500/30 text-play-400'
                          : 'bg-danger-500/10 border-danger-500/30 text-danger-400'
                      }`}
                    >
                      <span className="truncate">
                        {team.lastResult.isCorrect ? t('lb_correct') : t('lb_wrong')} (
                        {team.lastResult.answer})
                      </span>
                      <span className=" font-extrabold whitespace-nowrap shrink-0">
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
