import React from 'react';
import { Team, Student } from '../types';
import { Trophy, Crown, User, CheckCircle2, AlertTriangle, Skull, Flame } from 'lucide-react';

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
    <div className="bg-slate-900/60 border border-white/10 rounded-2xl p-6 shadow-2xl backdrop-blur-md">
      <div className="flex items-center justify-between pb-4 mb-4 border-b border-white/10">
        <div className="flex items-center gap-2">
          <Trophy className="w-5 h-5 text-indigo-400" />
          <h3 className="font-bold text-white text-lg uppercase tracking-tight">
            Jamoalar Turnir Jadvali
          </h3>
        </div>
        <span className="text-[10px] font-mono font-bold uppercase tracking-widest px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
          {teamList.length} TA JAMOA
        </span>
      </div>

      {teamList.length === 0 ? (
        <div className="text-center py-8 text-slate-500 text-xs font-mono uppercase tracking-widest">
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
                className={`p-5 rounded-2xl border relative overflow-hidden transition-all ${
                  isEliminated
                    ? 'bg-slate-950/60 border-rose-900/40 opacity-70'
                    : index === 0
                    ? 'bg-slate-900/80 border-indigo-500/50 shadow-[0_0_20px_rgba(79,70,229,0.2)] ring-1 ring-indigo-500/40'
                    : 'bg-slate-900/40 border-white/5 hover:border-white/10'
                }`}
              >
                {/* Left vertical team color accent bar */}
                <div
                  className="absolute top-0 left-0 w-1.5 h-full"
                  style={{ backgroundColor: teamAccent }}
                />

                <div className="flex items-center justify-between gap-3 pl-2">
                  {/* Rank & Team Name */}
                  <div className="flex items-center gap-3 min-w-0">
                    <span
                      className={`w-8 h-8 rounded-lg font-black font-mono text-xs flex items-center justify-center shrink-0 ${
                        index === 0
                          ? 'bg-indigo-500 text-white shadow-[0_0_10px_rgba(99,102,241,0.6)]'
                          : index === 1
                          ? 'bg-slate-200 text-slate-950'
                          : index === 2
                          ? 'bg-amber-600 text-white'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      0{index + 1}
                    </span>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span
                          className="w-3 h-3 rounded-full shrink-0 shadow-sm"
                          style={{ backgroundColor: teamAccent }}
                        />
                        <h4 className="font-bold text-white text-base truncate">
                          {team.name}
                        </h4>
                        {isEliminated && (
                          <span className="flex items-center gap-1 text-[10px] font-extrabold uppercase px-2 py-0.5 rounded bg-rose-500/20 text-rose-400 border border-rose-500/30">
                            <Skull className="w-3 h-3" /> Chiqdi
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-400">
                        {leader && (
                          <span className="flex items-center gap-1 text-indigo-300 font-medium">
                            <Crown className="w-3 h-3 text-amber-400" /> Sardor: {leader.name}
                          </span>
                        )}
                        <span>•</span>
                        <span className="text-[10px] font-mono text-slate-500 uppercase">{team.memberIds.length} a'zo</span>
                      </div>
                    </div>
                  </div>

                  {/* Bet status & Score */}
                  <div className="text-right shrink-0 flex items-center gap-3">
                    {/* Bet badge if active */}
                    {team.currentBet !== null && (
                      <div className="text-right hidden sm:block">
                        <div className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                          Tikilgan
                        </div>
                        <div className="font-mono font-bold text-amber-400 text-sm">
                          🔥 {team.currentBet}
                        </div>
                      </div>
                    )}

                    {/* Answer Status */}
                    {currentPhase === 'ANSWERING' && (
                      <div>
                        {team.currentAnswer ? (
                          <span className="inline-flex items-center gap-1 text-[10px] uppercase font-bold px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Yubordi
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] uppercase font-bold px-2.5 py-1 rounded-full bg-slate-800 text-slate-400 border border-slate-700 animate-pulse">
                            O'ylamoqda...
                          </span>
                        )}
                      </div>
                    )}

                    {/* Score */}
                    <div className="bg-slate-950 px-3.5 py-1.5 rounded-xl border border-white/10 shadow-inner">
                      <div className="text-[9px] uppercase font-bold text-slate-500 text-center tracking-widest">
                        BALL
                      </div>
                      <div className="font-mono font-black text-indigo-400 text-lg sm:text-xl text-center">
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
