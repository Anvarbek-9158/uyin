import React from 'react';
import { Team, Student } from '../types';
import { Trophy, Crown, CheckCircle2, Skull } from 'lucide-react';

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
  const teamList = (Object.values(teams || {}) as Team[]).sort((a, b) => b.score - a.score);

  return (
    <div className="bg-slate-900/90 border-2 border-indigo-500/30 rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-xl">
      <div className="flex flex-wrap items-center justify-between gap-2 pb-5 mb-5 border-b-2 border-white/10">
        <div className="flex items-center gap-3">
          <Trophy className="w-6 h-6 sm:w-7 sm:h-7 text-amber-400 shrink-0" />
          <h3 className="font-extrabold text-white text-xl sm:text-2xl uppercase tracking-tight">
            Jamoalar Turnir Jadvali
          </h3>
        </div>
        <span className="text-xs sm:text-sm font-mono font-black uppercase tracking-wider px-3.5 py-1.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/40">
          {teamList.length} TA JAMOA
        </span>
      </div>

      {teamList.length === 0 ? (
        <div className="text-center py-10 text-slate-400 text-sm sm:text-base font-mono uppercase tracking-widest font-bold">
          Hali jamoalar shakllantirilmadi
        </div>
      ) : (
        <div className="space-y-4">
          {teamList.map((team, index) => {
            const leader = team.leaderSocketId ? students[team.leaderSocketId] : null;
            const isEliminated = team.isEliminated || team.score <= 0;
            const accentColors = ['#06b6d4', '#f59e0b', '#f43f5e', '#6366f1', '#10b981', '#a855f7'];
            const teamAccent = team.color || accentColors[index % accentColors.length];

            return (
              <div
                key={team.id}
                className={`p-5 sm:p-6 rounded-2xl border-2 relative overflow-hidden transition-all ${
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

                <div className="flex items-center justify-between gap-4 pl-3">
                  {/* Rank & Team Name */}
                  <div className="flex items-center gap-3.5 min-w-0">
                    <span
                      className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl font-black font-mono text-sm sm:text-base flex items-center justify-center shrink-0 border ${
                        index === 0
                          ? 'bg-amber-400 text-slate-950 border-amber-300 shadow-[0_0_15px_rgba(245,158,11,0.6)]'
                          : index === 1
                          ? 'bg-slate-200 text-slate-950 border-white'
                          : index === 2
                          ? 'bg-amber-700 text-white border-amber-500'
                          : 'bg-slate-800 text-slate-300 border-white/10'
                      }`}
                    >
                      0{index + 1}
                    </span>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2.5">
                        <span
                          className="w-3.5 h-3.5 rounded-full shrink-0 shadow-sm border border-white/20"
                          style={{ backgroundColor: teamAccent }}
                        />
                        <h4 className="font-extrabold text-white text-lg sm:text-xl md:text-2xl truncate">
                          {team.name}
                        </h4>
                        {isEliminated && (
                          <span className="flex items-center gap-1 text-xs font-black uppercase px-2.5 py-1 rounded-md bg-rose-500/20 text-rose-300 border border-rose-500/40">
                            <Skull className="w-3.5 h-3.5" /> Chiqdi
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-3 mt-1 text-xs sm:text-sm text-slate-300">
                        {leader && (
                          <span className="flex items-center gap-1.5 text-indigo-300 font-bold">
                            <Crown className="w-4 h-4 text-amber-400" /> Sardor: {leader.name}
                          </span>
                        )}
                        <span className="text-slate-500">•</span>
                        <span className="text-xs font-mono font-bold text-slate-400 uppercase">{team.memberIds.length} a'zo</span>
                      </div>
                    </div>
                  </div>

                  {/* Bet status & Score */}
                  <div className="text-right shrink-0 flex items-center gap-4">
                    {/* Bet badge if active */}
                    {team.currentBet !== null && (
                      <div className="text-right hidden sm:block">
                        <div className="text-xs uppercase font-black text-slate-400 tracking-wider">
                          Tikilgan
                        </div>
                        <div className="font-mono font-black text-amber-400 text-base sm:text-lg">
                          🔥 {team.currentBet}
                        </div>
                      </div>
                    )}

                    {/* Answer Status */}
                    {currentPhase === 'ANSWERING' && (
                      <div>
                        {team.currentAnswer ? (
                          <span className="inline-flex items-center gap-1.5 text-xs uppercase font-extrabold px-3 py-1.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                            <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Yubordi
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-xs uppercase font-extrabold px-3 py-1.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700 animate-pulse">
                            O'ylamoqda...
                          </span>
                        )}
                      </div>
                    )}

                    {/* Score */}
                    <div className="bg-slate-950 px-4 py-2 sm:px-5 sm:py-2.5 rounded-2xl border-2 border-indigo-500/40 shadow-inner">
                      <div className="text-[11px] uppercase font-black text-slate-400 text-center tracking-widest">
                        BALL
                      </div>
                      <div className="font-mono font-black text-indigo-400 text-xl sm:text-2xl md:text-3xl text-center">
                        {team.score}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Round Result Delta if present */}
                {team.lastResult && (
                  <div
                    className={`mt-3 pt-2.5 border-t text-xs font-semibold flex items-center justify-between pl-2 ${
                      team.lastResult.isCorrect
                        ? 'border-emerald-500/20 text-emerald-400'
                        : 'border-rose-500/20 text-rose-400'
                    }`}
                  >
                    <span>
                      {team.lastResult.isCorrect
                        ? 'To\'g\'ri javob!'
                        : 'Xato javob!'} ({team.lastResult.answer})
                    </span>
                    <span className="font-mono font-extrabold">
                      {team.lastResult.isCorrect ? '+' : ''}
                      {team.lastResult.pointsDelta} ball
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
