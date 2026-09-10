import React from 'react';
import { Crown, LogOut, Play, Plus, RefreshCw, Trash2, UserX, Users, VolumeX } from 'lucide-react';
import { Student, Team } from '../types';
import { useLang } from '../i18n';

interface TeamSetupSectionProps {
  teamList: Team[];
  students: Record<string, Student>;
  unassignedStudents: Student[];
  selectedStudentIds: string[];
  newTeamName: string;
  onSelectStudents: (ids: string[]) => void;
  onNewTeamNameChange: (name: string) => void;
  onCreateTeam: (e: React.FormEvent) => void;
  onOpenQuestionSelect: () => void;
  onReconnectStudent: (studentId: string) => void;
  onAssignStudent: (studentId: string, teamId: string | null) => void;
  onBulkAssign: (studentIds: string[], teamId: string) => void;
  onMakeLeader: (studentId: string, teamId: string) => void;
  onKickStudent: (studentId: string) => void;
  onPenalizeTeam: (teamId: string) => void;
  onDeleteTeam: (teamId: string) => void;
}

// Presentational screen for the pre-game phase: the unassigned-students waiting
// room (with bulk selection + assignment) and the team cards (create teams, pick
// leaders, move members, penalize/remove). All state and API calls live in
// TeacherView; this component only renders and forwards actions.
export const TeamSetupSection: React.FC<TeamSetupSectionProps> = ({
  teamList,
  students,
  unassignedStudents,
  selectedStudentIds,
  newTeamName,
  onSelectStudents,
  onNewTeamNameChange,
  onCreateTeam,
  onOpenQuestionSelect,
  onReconnectStudent,
  onAssignStudent,
  onBulkAssign,
  onMakeLeader,
  onKickStudent,
  onPenalizeTeam,
  onDeleteTeam,
}) => {
  const { t } = useLang();
  const accentColors = ['#06b6d4', '#f59e0b', '#f43f5e', '#6366f1', '#10b981'];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      {/* Left: Unassigned Students in Waiting Room */}
      <div className="bg-slate-900/60 border border-white/10 rounded-2xl p-6 shadow-xl space-y-4 backdrop-blur-md">
        <div className="flex items-center justify-between pb-3 border-b border-white/10">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-indigo-400" />
            <h3 className="font-bold text-white text-base uppercase tracking-wider">
              {t('tv_waiting_room')}
            </h3>
          </div>
          <span className="px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 font-mono font-bold text-xs border border-indigo-500/30">
            {unassignedStudents.length} TA
          </span>
        </div>

        {/* Bulk Selection Bar */}
        {unassignedStudents.length > 0 && (
          <div className="flex flex-col gap-2 p-2.5 rounded-xl bg-slate-950/80 border border-white/10 text-xs">
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-slate-300 font-semibold cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={
                    unassignedStudents.length > 0 &&
                    selectedStudentIds.length === unassignedStudents.length
                  }
                  onChange={(e) => {
                    if (e.target.checked) {
                      onSelectStudents(unassignedStudents.map((s) => s.id));
                    } else {
                      onSelectStudents([]);
                    }
                  }}
                  className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 bg-slate-900 border-white/20 cursor-pointer"
                />
                <span>{t('tv_select_all_teams')} ({selectedStudentIds.length})</span>
              </label>

              {selectedStudentIds.length > 0 && (
                <button
                  onClick={() => onSelectStudents([])}
                  className="text-[11px] text-slate-400 hover:text-white uppercase font-bold"
                >
                  {t('tv_clear')}
                </button>
              )}
            </div>

            {selectedStudentIds.length > 0 && teamList.length > 0 && (
              <div className="pt-2 border-t border-white/5 flex items-center gap-2">
                <span className="text-[11px] text-indigo-300 font-bold uppercase">{t('tv_assign_group')}</span>
                <select
                  onChange={(e) => {
                    if (e.target.value) {
                      onBulkAssign(selectedStudentIds, e.target.value);
                      e.target.value = '';
                    }
                  }}
                  className="flex-1 px-2 py-1 rounded bg-indigo-600 text-white font-bold text-xs focus:outline-none cursor-pointer"
                >
                  <option value="">{t('tv_select_team')}</option>
                  {teamList.map((te) => (
                    <option key={te.id} value={te.id}>
                      {te.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        )}

        {unassignedStudents.length === 0 ? (
          <p className="text-xs text-slate-500 text-center py-6 font-mono uppercase tracking-widest">
            {t('tv_all_assigned')}
          </p>
        ) : (
          <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
            {unassignedStudents.map((st) => {
              const isChecked = selectedStudentIds.includes(st.id);
              return (
                <div
                  key={st.id}
                  className={`flex items-center justify-between p-3 rounded-xl border transition-all text-xs ${
                    isChecked
                      ? 'bg-indigo-500/20 border-indigo-500/50 text-white'
                      : 'bg-slate-950/60 border-white/5 text-slate-200'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={(e) => {
                        if (e.target.checked) {
                          onSelectStudents([...selectedStudentIds, st.id]);
                        } else {
                          onSelectStudents(selectedStudentIds.filter((id) => id !== st.id));
                        }
                      }}
                      className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 bg-slate-900 border-white/20 cursor-pointer"
                    />
                    <span className="font-semibold text-sm">{st.name}</span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => onReconnectStudent(st.id)}
                      className="p-1 px-2 rounded bg-sky-500/10 hover:bg-sky-500/30 text-sky-300 border border-sky-500/20 text-[11px] font-bold uppercase transition-all flex items-center gap-1"
                    >
                      <RefreshCw className="w-3 h-3" />
                      {t('tv_reconnect')}
                    </button>
                    <button
                      onClick={() => onKickStudent(st.id)}
                      className="p-1 px-2 rounded bg-rose-500/10 hover:bg-rose-500/30 text-rose-300 border border-rose-500/20 text-[11px] font-bold uppercase transition-all flex items-center gap-1"
                    >
                      <UserX className="w-3 h-3" />
                      {t('tv_kick')}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Center/Right: Team Creation & Assigning */}
      <div className="lg:col-span-2 space-y-6">
        <div className="bg-slate-900/60 border border-white/10 rounded-2xl p-6 shadow-xl space-y-6 backdrop-blur-md">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="min-w-0">
              <h3 className="font-bold text-white text-xl uppercase tracking-tight">
                {t('tv_team_setup_title')}
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                {t('tv_team_setup_sub')}
              </p>
            </div>

            {teamList.length > 0 && (
              <button
                onClick={onOpenQuestionSelect}
                className="flex items-center gap-2 px-6 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs uppercase tracking-widest shadow-[0_0_20px_rgba(16,185,129,0.4)] transition-all scale-105 cursor-pointer"
              >
                <Play className="w-4 h-4 fill-slate-950" />
                {t('tv_start_quiz')}
              </button>
            )}
          </div>

          {/* Add Team Form */}
          <form onSubmit={onCreateTeam} className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              value={newTeamName}
              onChange={(e) => onNewTeamNameChange(e.target.value)}
              placeholder={t('tv_new_team_placeholder')}
              className="flex-1 px-4 py-2.5 rounded-xl bg-slate-950 border border-white/10 text-white text-sm focus:outline-none focus:border-indigo-500 w-full"
            />
            <button
              type="submit"
              className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs uppercase tracking-wider shadow-[0_0_12px_rgba(79,70,229,0.4)] flex items-center justify-center gap-1.5 transition-all shrink-0"
            >
              <Plus className="w-4 h-4" /> {t('tv_add_team')}
            </button>
          </form>

          {/* Teams Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {teamList.map((team, idx) => {
              const teamAccent = team.color || accentColors[idx % accentColors.length];

              return (
                <div
                  key={team.id}
                  className="p-5 rounded-2xl bg-slate-900/80 border border-white/10 space-y-4 relative overflow-hidden group"
                >
                  <div
                    className="absolute top-0 left-0 w-1.5 h-full"
                    style={{ backgroundColor: teamAccent }}
                  />

                  <div className="flex items-center justify-between pl-2">
                    <div className="flex items-center gap-2">
                      <span
                        className="w-3.5 h-3.5 rounded-full"
                        style={{ backgroundColor: teamAccent }}
                      />
                      <h4 className="font-bold text-white text-base">
                        {team.name}
                      </h4>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => onPenalizeTeam(team.id)}
                        className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-500/10 hover:bg-rose-500/30 text-rose-300 border border-rose-500/20 text-[11px] font-bold uppercase transition-all"
                        title="Shovqin qilgani uchun 5 ball ayirish"
                      >
                        <VolumeX className="w-3.5 h-3.5 text-rose-400" />
                        {t('tv_penalize_noise')}
                      </button>

                      <button
                        onClick={() => onDeleteTeam(team.id)}
                        className="text-slate-500 hover:text-rose-400 p-1 rounded hover:bg-slate-800 transition-colors"
                        title="Guruhni o'chirish"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Members & Leader Selector */}
                  <div className="space-y-2 pl-2">
                    <div className="text-[11px] font-bold uppercase tracking-widest text-slate-500">
                      {t('tv_members_leader')}
                    </div>
                    {team.memberIds.length === 0 ? (
                      <p className="text-xs text-slate-500 italic">
                        {t('tv_no_members')}
                      </p>
                    ) : (
                      <div className="space-y-1.5">
                        {team.memberIds.map((mId) => {
                          const st = students[mId];
                          if (!st) return null;
                          const isLeader = st.isLeader;

                          return (
                            <div
                              key={st.id}
                              className={`flex items-center justify-between p-2 rounded-lg text-xs border ${
                                isLeader
                                  ? 'bg-indigo-500/20 border-indigo-500/40 text-indigo-200'
                                  : 'bg-slate-950/80 border-white/5 text-slate-200'
                              }`}
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                {isLeader && (
                                  <Crown className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                                )}
                                <span className="font-semibold truncate">{st.name}</span>
                              </div>

                              <div className="flex items-center gap-1 shrink-0 ml-2">
                                {!isLeader && (
                                  <button
                                    onClick={() => onMakeLeader(st.id, team.id)}
                                    className="px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 hover:bg-indigo-500/30 text-[11px] font-bold uppercase"
                                  >
                                    {t('tv_make_leader')}
                                  </button>
                                )}
                                <button
                                  onClick={() => onAssignStudent(st.id, null)}
                                  className="px-2 py-1 rounded bg-amber-500/15 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 text-[11px] font-bold uppercase flex items-center gap-1 transition-all cursor-pointer"
                                  title="Guruhdan chiqarib, kutish zaliga qaytarish"
                                >
                                  <LogOut className="w-3 h-3 text-amber-400" />
                                  <span>{t('tv_to_waiting')}</span>
                                </button>
                                <button
                                  onClick={() => onKickStudent(st.id)}
                                  className="p-1 rounded bg-rose-500/10 hover:bg-rose-500/25 text-rose-400 hover:text-rose-300 transition-colors"
                                  title="Tizimdan/o'yindan butunlay o'chirish"
                                >
                                  <UserX className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Quick Assign Dropdown */}
                  {unassignedStudents.length > 0 && (
                    <div className="pt-2 border-t border-white/5 pl-2">
                      <select
                        onChange={(e) => {
                          if (e.target.value) {
                            onAssignStudent(e.target.value, team.id);
                            e.target.value = '';
                          }
                        }}
                        className="w-full px-3 py-1.5 rounded-lg bg-slate-950 border border-white/10 text-xs text-slate-300 focus:outline-none"
                      >
                        <option value="">{t('tv_add_student_team')}</option>
                        {unassignedStudents.map((st) => (
                          <option key={st.id} value={st.id}>
                            {st.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};