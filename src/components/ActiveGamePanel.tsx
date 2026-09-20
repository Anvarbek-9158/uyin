import React from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Award,
  Check,
  CheckCircle2,
  Clock,
  Crown,
  Flag,
  Play,
  RefreshCw,
  Trophy,
  VolumeX,
  XCircle,
} from 'lucide-react';
import { GamePhase, Question, Student, Team } from '../types';
import { Leaderboard } from './Leaderboard';
import { useLang, translateCategory } from '../i18n';
import { ACCENT_COLORS } from '../utils/teamColors';

interface ActiveGamePanelProps {
  phase: GamePhase;
  round: number;
  currentQuestionIndex: number;
  questionsCount: number;
  displayQ: Question | null;
  timerSeconds: number;
  teams: Record<string, Team>;
  teamList: Team[];
  students: Record<string, Student>;
  winners: string[];
  onStartAnswering: () => void;
  onStopAnswering: () => void;
  onFinishRound: () => void;
  onNextQuestion: () => void;
  onEndGame: () => void;
  onStopKeepTeams: () => void;
  onNewRound: () => void;
  onPenalizeTeam: (teamId: string) => void;
  onGradeAnswer: (teamId: string, isCorrect: boolean) => void;
}

// Presentational in-game dashboard for the teacher: phase status + action
// controls, the live timer, bet/answer status per team with grading buttons,
// the winner banner on game over, and the Leaderboard column. All API calls and
// state live in TeacherView; this component only renders and forwards actions.
export const ActiveGamePanel: React.FC<ActiveGamePanelProps> = ({
  phase,
  round,
  currentQuestionIndex,
  questionsCount,
  displayQ,
  timerSeconds,
  teams,
  teamList,
  students,
  winners,
  onStartAnswering,
  onStopAnswering,
  onFinishRound,
  onNextQuestion,
  onEndGame,
  onStopKeepTeams,
  onNewRound,
  onPenalizeTeam,
  onGradeAnswer,
}) => {
  const { lang, t } = useLang();

  const activeTeams = teamList.filter((t) => !t.isEliminated);
  const teamsWithBets = activeTeams.filter((t) => t.currentBet !== null);
  const allBetPlaced = activeTeams.length > 0 && teamsWithBets.length === activeTeams.length;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      {/* Main Question & Phase Action */}
      <div className="lg:col-span-2 space-y-6">
        {/* Phase Status Banner */}
        <div className="bg-surface/95 border border-line rounded-2xl p-6 shadow-2xl space-y-4 backdrop-blur-md">
          <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-line">
            <div className="flex items-center gap-3">
              <span className="px-3 py-1 rounded-full bg-brand-500/20 text-brand-300 font-bold text-xs border border-brand-300">
                {t('tv_round')} {round}
              </span>
              <span className="px-3 py-1 rounded-full bg-brand-500/20 text-brand-300 font-bold text-xs border border-brand-300">
                {t('tv_question')} {currentQuestionIndex + 1} / {questionsCount}
              </span>
              <div className="text-xs text-ink-faint uppercase">
                {t('tv_phase_label')}{' '}
                <span className="font-bold text-brand-400">
                  {phase === 'BETTING' && t('tv_phase1')}
                  {phase === 'ANSWERING' && t('tv_phase2_answering')}
                  {phase === 'GRADING' && t('tv_phase3')}
                  {phase === 'ROUND_RESULT' && `${t('tv_phase4_prefix')}${round}${t('tv_phase4_suffix')}`}
                  {phase === 'GAME_OVER' && t('tv_phase5')}
                </span>
              </div>
            </div>

            {/* Phase Action Controls */}
            <div className="flex flex-wrap items-center gap-3">
              {phase === 'BETTING' && (
                <button
                  data-testid="start-answering"
                  onClick={onStartAnswering}
                  className={`flex items-center gap-2 px-6 py-3 rounded-xl font-black text-xs uppercase tracking-widest transition-all cursor-pointer ${
                    allBetPlaced
                      ? 'bg-brand-600 hover:bg-brand-500 text-ink shadow-[var(--shadow-pop-brand)] scale-105'
                      : 'bg-warn-500/80 hover:bg-warn-500 text-ink shadow-[0_0_20px_rgba(245,158,11,0.4)]'
                  }`}
                  title={
                    allBetPlaced
                      ? t('tv_start_reveal')
                      : t('tv_reveal_anyway')
                  }
                >
                  <Play className="w-4 h-4 fill-current" />
                  {allBetPlaced ? t('tv_start_reveal') : t('tv_reveal_anyway')}
                </button>
              )}

              {phase === 'ANSWERING' && (
                <button
                  onClick={onStopAnswering}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-danger-500 hover:bg-danger-400 text-ink font-bold text-xs uppercase tracking-wider shadow-[0_0_15px_rgba(244,63,94,0.4)]"
                >
                  <Clock className="w-4 h-4" />
                  {t('tv_stop_timer')}
                </button>
              )}

              {phase === 'GRADING' && (
                <button
                  data-testid="finish-round"
                  onClick={onFinishRound}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-play-500 hover:bg-play-400 text-surface-sunken font-black text-xs uppercase tracking-widest shadow-[var(--shadow-pop-play)]"
                >
                  <Check className="w-4 h-4" />
                  {t('tv_publish_round')}
                </button>
              )}

              {phase === 'ROUND_RESULT' && (
                <button
                  data-testid="next-question"
                  onClick={onNextQuestion}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-ink font-black text-xs uppercase tracking-widest shadow-[var(--shadow-pop-brand)] cursor-pointer"
                >
                  {t('tv_next_question')} <ArrowRight className="w-4 h-4" />
                </button>
              )}

              {/* End the game early and announce the winners (VAZIFA 6/QISM J) */}
              {phase !== 'GAME_OVER' && (
                <button
                  data-testid="end-game"
                  onClick={onEndGame}
                  className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-danger-500/10 hover:bg-danger-500/25 text-danger-400 border border-danger-500/40 font-bold text-xs uppercase tracking-wider transition-all"
                >
                  <Flag className="w-3.5 h-3.5 text-danger-400" />
                  {t('tv_end_game')}
                </button>
              )}

              {/* Reset/Stop game but keep teams button */}
              <button
                onClick={onStopKeepTeams}
                className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-warn-500/10 hover:bg-warn-500/20 text-warn-400 border border-warn-500/30 font-bold text-xs uppercase tracking-wider transition-all"
              >
                <RefreshCw className="w-3.5 h-3.5 text-warn-400" />
                {t('tv_stop_keep_teams')}
              </button>
            </div>
          </div>

          {/* BETTING PHASE STATUS NOTICE BANNER */}
          {phase === 'BETTING' && (
            <div className="w-full pt-1">
              {allBetPlaced ? (
                <div className="p-3.5 rounded-xl bg-play-500/20 border border-play-500/40 text-play-400 text-xs font-bold flex items-center justify-between gap-2 shadow-[var(--shadow-pop-play)] animate-pulse">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-play-400 shrink-0" />
                    <span>{t('tv_bets_100')}{t('tv_bets_100_sub_prefix')}{teamsWithBets.length}/{activeTeams.length}{t('tv_bets_100_sub_suffix')}</span>
                  </div>
                  <span className="text-xs uppercase tracking-wider bg-play-500/30 px-2.5 py-1 rounded text-play-400/30 shrink-0 font-extrabold">
                    {t('tv_bets_100_badge')}
                  </span>
                </div>
              ) : (
                <div className="p-3.5 rounded-xl bg-warn-500/20 border border-warn-500/40 text-warn-400 text-xs font-bold flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-warn-400 shrink-0" />
                    <span>{t('tv_bets_pending')}{t('tv_bets_pending_sub_prefix')}{teamsWithBets.length}/{activeTeams.length}{t('tv_bets_pending_sub_suffix')}</span>
                  </div>
                  <span className="text-xs uppercase tracking-wider bg-warn-500/30 px-2.5 py-1 rounded text-warn-400/30 shrink-0 font-extrabold">
                    {t('tv_bets_pending_badge')}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* LIVE TIMER COUNTDOWN DISPLAY FOR TEACHER */}
          {phase === 'ANSWERING' && (
            <div className={`p-5 rounded-2xl border flex items-center justify-between gap-4 transition-all shadow-xl ${
              timerSeconds <= 5
                ? 'bg-danger-500/20 border-danger-500/50 text-danger-400 animate-pulse ring-2 ring-danger-500/40'
                : 'bg-brand-600/20 border-brand-300 text-brand-300'
            }`}>
              <div className="flex items-center gap-4">
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center font-black text-2xl shadow-inner transition-transform ${
                  timerSeconds <= 5 ? 'bg-danger-600 text-ink animate-bounce scale-105' : 'bg-brand-600 text-ink'
                }`}>
                  <Clock className="w-7 h-7" />
                </div>
                <div>
                  <div className="text-xs font-bold uppercase tracking-widest text-ink-faint">
                    ⏱️ {t('tv_timer_running')}
                  </div>
                  <div className="text-3xl font-black tracking-tight flex items-baseline gap-2">
                    <span>{timerSeconds}</span>
                    <span className="text-xs font-semibold text-ink-faint uppercase tracking-widest">{t('tv_seconds_left')}</span>
                  </div>
                </div>
              </div>

              <div className="hidden sm:block text-right">
                <span className={`px-3.5 py-1.5 rounded-full text-xs font-black uppercase tracking-wider inline-block ${
                  timerSeconds <= 5 
                    ? 'bg-danger-500/30 text-danger-400/30 border border-danger-500/50 shadow-[0_0_15px_rgba(244,63,94,0.4)]' 
                    : 'bg-brand-500/30 text-brand-300 border border-brand-300 shadow-[var(--shadow-pop-brand)]'
                }`}>
{timerSeconds <= 5 ? `⚠️ ${t('tv_hurry')}` : `⏳ ${t('tv_answer_time')}`}
                </span>
              </div>
            </div>
          )}

          {/* GAME OVER BANNER FOR TEACHER */}
          {phase === 'GAME_OVER' && (
            <div className="p-5 rounded-2xl bg-warn-500/15 border border-warn-500/40 space-y-3 shadow-[0_0_25px_rgba(245,158,11,0.15)]">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <Trophy className="w-7 h-7 text-warn-400 shrink-0" />
                  <div>
                    <h4 className="font-black text-ink text-lg uppercase tracking-tight">
                      {t('tv_game_over_banner')}
                    </h4>
                    <p className="text-xs text-ink-soft">
                      {t('tv_final_table')}
                    </p>
                  </div>
                </div>
              </div>

              {/* Winners callout (QISM J) */}
              {(() => {
                if (winners.length === 0) {
                  return (
                    <p className="text-sm font-bold text-ink-soft">
                      {t('tv_no_winner')}
                    </p>
                  );
                }
                const names = winners
                  .map((id) => teams?.[id]?.name)
                  .filter(Boolean);
                return (
                  <div className="p-3.5 rounded-xl bg-warn-500/20 border border-warn-400/50 flex flex-wrap items-center gap-2">
                    <Crown className="w-5 h-5 text-warn-400 shrink-0" />
                    <span className="text-xs font-black uppercase tracking-widest text-warn-400">
                      {names.length > 1 ? t('tv_winners') : t('tv_winner_singular')}
                    </span>
                    <span className=" font-black text-ink text-base">
                      {names.join(', ') || '—'}
                    </span>
                  </div>
                );
              })()}

              <div className="flex flex-wrap items-center gap-2 pt-1">
                <button
                  onClick={onNewRound}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-warn-500 hover:bg-warn-400 text-surface-sunken font-black text-xs uppercase tracking-wider transition-all cursor-pointer"
                >
                  <RefreshCw className="w-4 h-4" /> {t('tv_new_round')}
                </button>
              </div>
            </div>
          )}

          {/* Active Question Display */}
          {displayQ && (
            <div className="p-5 rounded-2xl bg-brand-500/10 border border-brand-300 space-y-2 relative overflow-hidden">
              <div className="flex items-center justify-between text-xs font-bold uppercase tracking-widest text-brand-400">
                <span>{translateCategory(displayQ?.category, lang)} • {t('tv_answer_time')}: {displayQ?.timeLimit}s</span>
                {phase === 'ANSWERING' && (
                  <span className="text-warn-400 font-black animate-pulse">
                    ⏱️ {timerSeconds}s
                  </span>
                )}
              </div>
              <h3 className="text-xl font-extrabold text-ink">
                {displayQ?.text}
              </h3>
              {/* The correct answer is revealed to the teacher only once
                  grading begins — it stays hidden during BETTING (before
                  students bet) and ANSWERING (while students answer) so
                  the teacher cannot accidentally spoil it. */}
              {phase === 'GRADING' || phase === 'ROUND_RESULT' || phase === 'GAME_OVER' ? (
                <div className="text-xs text-play-400 font-medium pt-2 border-t border-line">
                  {t('tv_correct_answer')}: <span className="font-bold text-ink">{displayQ?.correctAnswer}</span>
                </div>
              ) : (
                <div className="text-xs text-ink-faint italic pt-2 border-t border-line">
                  {t('tv_correct_revealed_later')}
                </div>
              )}
            </div>
          )}
        </div>

        {/* GRADING / INCOMING ANSWERS PANEL */}
        <div className="bg-surface/95 border border-line rounded-2xl p-6 shadow-2xl space-y-4 backdrop-blur-md">
          <h3 className="font-bold text-ink text-lg uppercase tracking-tight flex items-center gap-2">
            <Award className="w-5 h-5 text-brand-400" />
            {t('tv_teams_bets_answers')}
          </h3>

          <div className="space-y-3">
            {teamList.map((team, idx) => {
              if (team.isEliminated) return null;
              const teamAccent = team.color || ACCENT_COLORS[idx % ACCENT_COLORS.length];

              return (
                <div
                  key={team.id}
                  className="p-4 rounded-2xl bg-surface/95 border border-line flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative overflow-hidden"
                >
                  <div className="absolute top-0 left-0 w-1 h-full" style={{ backgroundColor: teamAccent }} />
                  <div className="pl-2">
                    <div className="flex items-center gap-2">
                      <span
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: teamAccent }}
                      />
                      <h4 className="font-bold text-ink text-base">
                        {team.name}
                      </h4>
                      <span className="text-xs text-brand-300">
                        ({team.score} {t('lb_points')})
                      </span>

                      <button
                        onClick={() => onPenalizeTeam(team.id)}
                        className="ml-2 flex items-center gap-1 px-2 py-0.5 rounded bg-danger-500/10 hover:bg-danger-500/30 text-danger-400 border border-danger-500/20 text-xs font-bold uppercase transition-all"
                      >
                        <VolumeX className="w-3 h-3 text-danger-400" />
                        {t('tv_penalize_noise')}
                      </button>
                    </div>

                    <div className="mt-1 text-xs text-ink-soft">
                      {t('tv_bet_placed')}{' '}
                      <span className=" font-bold text-warn-400">
                        {team.currentBet !== null ? `${team.currentBet} ${t('lb_points')}` : t('tv_not_inserted')}
                      </span>
                    </div>

                    <div className="mt-1 text-sm font-semibold text-ink">
                      {t('tv_answer')}{' '}
                      {phase === 'ANSWERING' ? (
                        team.currentAnswer
                          ? <span className="text-play-400">{t('tv_submitted')}</span>
                          : <span className="text-ink-faint">{t('tv_not_answer')}</span>
                      ) : (
                        <span className="text-brand-300">
                          {team.currentAnswer || t('tv_not_answer2')}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Manual Grading Buttons during GRADING phase */}
                  {phase === 'GRADING' && team.currentBet !== null && (
                    <div className="flex items-center gap-2 shrink-0">
                      {team.lastResult !== null ? (
                        <span
                          className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider ${
                            team.lastResult.isCorrect
                              ? 'bg-play-500/30 text-play-400 border border-play-500/50'
                              : 'bg-danger-500/30 text-danger-400 border border-danger-500/50'
                          }`}
                        >
                          {team.lastResult.isCorrect ? (
                            <CheckCircle2 className="w-4 h-4" />
                          ) : (
                            <XCircle className="w-4 h-4" />
                          )}
                          {t('tv_graded')} ({team.lastResult.isCorrect ? '+' : ''}
                          {team.lastResult.pointsDelta})
                        </span>
                      ) : (
                        <>
                          <button
                            data-testid="grade-correct"
                            onClick={() => onGradeAnswer(team.id, true)}
                            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold uppercase transition-all bg-play-500/20 text-play-400 hover:bg-play-500/30 border border-play-500/30"
                          >
                            <CheckCircle2 className="w-4 h-4" /> {t('tv_correct_graded')} (+{team.currentBet})
                          </button>

                          <button
                            onClick={() => onGradeAnswer(team.id, false)}
                            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold uppercase transition-all bg-danger-500/20 text-danger-400 hover:bg-danger-500/30 border border-danger-500/30"
                          >
                            <XCircle className="w-4 h-4" /> {t('tv_wrong_graded')} (-{team.currentBet})
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Right Column: Leaderboard Standings */}
      <div>
        <Leaderboard teams={teams} students={students} currentPhase={phase} />
      </div>
    </div>
  );
};