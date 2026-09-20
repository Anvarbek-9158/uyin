import React from 'react';
import { Crown, LogOut, Play, Plus, RefreshCw, Trash2, UserX, Users, VolumeX } from 'lucide-react';
import { Student, Team } from '../types';
import { useLang } from '../i18n';
import { ACCENT_COLORS } from '../utils/teamColors';

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

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      {/* Left: Unassigned Students in Waiting Room */}
      <div className="bg-surface/95 border border-line rounded-2xl p-6 shadow-xl space-y-4 backdrop-blur-md">
        <div className="flex items-center justify-between pb-3 border-b border-line">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-brand-400" />
            <h3 className="font-bold text-ink text-base uppercase tracking-wider">
              {t('tv_waiting_room')}
            </h3>
          </div>
          <span className="px-3 py-1 rounded-full bg-brand-500/20 text-brand-300 font-bold text-xs border border-brand-300">
            {unassignedStudents.length} {t('tv_ta_unit')}
          </span>
        </div>

        {/* Bulk Selection Bar */}
        {unassignedStudents.length > 0 && (
          <div className="flex flex-col gap-2 p-2.5 rounded-xl bg-surface-sunken border border-line text-xs">
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-ink-soft font-semibold cursor-pointer select-none">
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
                  className="w-4 h-4 rounded text-brand-400 focus:ring-brand-500 bg-surface border-line cursor-pointer"
                />
                <span>{t('tv_select_all_teams')} ({selectedStudentIds.length})</span>
              </label>

              {selectedStudentIds.length > 0 && (
                <button
                  onClick={() => onSelectStudents([])}
                  className="text-xs text-ink-faint hover:text-ink uppercase font-bold"
                >
                  {t('tv_clear')}
                </button>
              )}
            </div>

            {selectedStudentIds.length > 0 && teamList.length > 0 && (
              <div className="pt-2 border-t border-line flex items-center gap-2">
                <span className="text-xs text-brand-300 font-bold uppercase">{t('tv_assign_group')}</span>
                <select
                  onChange={(e) => {
                    if (e.target.value) {
                      onBulkAssign(selectedStudentIds, e.target.value);
                      e.target.value = '';
                    }
                  }}
                  className="flex-1 px-2 py-1 rounded bg-brand-600 text-ink font-bold text-xs focus:outline-none cursor-pointer"
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
          <p className="text-xs text-ink-faint text-center py-6 uppercase tracking-widest">
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
                      ? 'bg-brand-500/20 border-brand-300 text-ink'
                      : 'bg-surface-sunken border-line text-ink'
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
                      className="w-4 h-4 rounded text-brand-400 focus:ring-brand-500 bg-surface border-line cursor-pointer"
                    />
                    <span className="font-semibold text-sm">{st.name}</span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => onReconnectStudent(st.id)}
                      className="p-1 px-2.5 rounded bg-sky-500/10 hover:bg-sky-500/30 text-sky-300 border border-sky-500/20 text-xs font-bold uppercase transition-all flex items-center gap-1 h-10"
                    >
                      <RefreshCw className="w-3 h-3" />
                      {t('tv_reconnect')}
                    </button>
                    <button
                      onClick={() => onKickStudent(st.id)}
                      className="p-1 px-2.5 rounded bg-danger-500/10 hover:bg-danger-500/30 text-danger-400 border border-danger-500/20 text-xs font-bold uppercase transition-all flex items-center gap-1 h-10"
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
        <div className="bg-surface/95 border border-line rounded-2xl p-6 shadow-xl space-y-6 backdrop-blur-md">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="min-w-0">
              <h3 className="font-bold text-ink text-xl uppercase tracking-tight">
                {t('tv_team_setup_title')}
              </h3>
              <p className="text-xs text-ink-faint mt-1">
                {t('tv_team_setup_sub')}
              </p>
            </div>

            {teamList.length > 0 && (
              <button
                onClick={onOpenQuestionSelect}
                data-testid="start-quiz"
                className="flex items-center gap-2 px-6 py-3 rounded-xl bg-play-500 hover:bg-play-400 text-surface-sunken font-black text-xs uppercase tracking-widest shadow-[var(--shadow-pop-play)] transition-all scale-105 cursor-pointer"
              >
                <Play className="w-4 h-4 fill-surface-sunken" />
                {t('tv_start_quiz')}
              </button>
            )}
          </div>

          {/* Add Team Form */}
          <form onSubmit={onCreateTeam} className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              data-testid="team-name"
              value={newTeamName}
              onChange={(e) => onNewTeamNameChange(e.target.value)}
              placeholder={t('tv_new_team_placeholder')}
              className="flex-1 px-4 py-2.5 rounded-xl bg-surface-sunken border border-line text-ink text-sm focus:outline-none focus:border-brand-500 w-full"
            />
            <button
              type="submit"
              data-testid="add-team"
              className="h-10 px-6 rounded-xl bg-brand-600 hover:bg-brand-500 text-ink font-bold text-xs uppercase tracking-wider shadow-[var(--shadow-pop-brand)] flex items-center justify-center gap-1.5 transition-all shrink-0"
            >
              <Plus className="w-4 h-4" /> {t('tv_add_team')}
            </button>
          </form>

          {/* Teams Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {teamList.map((team, idx) => {
              const teamAccent = team.color || ACCENT_COLORS[idx % ACCENT_COLORS.length];

              return (
                <div
                  key={team.id}
                  className="p-5 rounded-2xl bg-surface/95 border border-line space-y-4 relative overflow-hidden group"
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
                      <h4 className="font-bold text-ink text-base">
                        {team.name}
                      </h4>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => onPenalizeTeam(team.id)}
                        className="flex items-center gap-1 px-2.5 rounded-lg bg-danger-500/10 hover:bg-danger-500/30 text-danger-400 border border-danger-500/20 text-xs font-bold uppercase transition-all h-10"
                        title={t('tv_penalize_title')}
                      >
                        <VolumeX className="w-3.5 h-3.5 text-danger-400" />
                        {t('tv_penalize_noise')}
                      </button>

                      <button
onClick={() => onDeleteTeam(team.id)}
          className="inline-flex items-center justify-center h-10 w-10 text-ink-faint hover:text-danger-400 rounded-xl hover:bg-surface-raised transition-colors"
          title={t('tv_delete_team_title')}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Members & Leader Selector */}
                  <div className="space-y-2 pl-2">
                    <div className="text-xs font-bold uppercase tracking-widest text-ink-faint">
                      {t('tv_members_leader')}
                    </div>
                    {team.memberIds.length === 0 ? (
                      <p className="text-xs text-ink-faint italic">
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
                                  ? 'bg-brand-500/20 border-brand-300 text-brand-300'
                                  : 'bg-surface-sunken border-line text-ink'
                              }`}
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                {isLeader && (
                                  <Crown className="w-3.5 h-3.5 text-warn-400 shrink-0" />
                                )}
                                <span className="font-semibold truncate">{st.name}</span>
                              </div>

                              <div className="flex items-center gap-1 shrink-0 ml-2">
                                {!isLeader && (
                                  <button
                                    data-testid="make-leader"
                                    onClick={() => onMakeLeader(st.id, team.id)}
                                    className="px-2.5 h-9 rounded bg-brand-500/20 text-brand-300 hover:bg-brand-500/30 text-xs font-bold uppercase"
                                  >
                                    {t('tv_make_leader')}
                                  </button>
                                )}
                                <button
                                  onClick={() => onAssignStudent(st.id, null)}
                                  className="px-2.5 h-9 rounded bg-warn-500/15 hover:bg-warn-500/30 text-warn-400 border border-warn-500/30 text-xs font-bold uppercase flex items-center gap-1 transition-all cursor-pointer"
                                  title={t('tv_to_waiting_title')}
                                >
                                  <LogOut className="w-3 h-3 text-warn-400" />
                                  <span>{t('tv_to_waiting')}</span>
                                </button>
                                <button
                                  onClick={() => onKickStudent(st.id)}
                                  className="inline-flex items-center justify-center h-10 w-10 rounded-lg bg-danger-500/10 hover:bg-danger-500/25 text-danger-400 hover:text-danger-400 transition-colors"
                                  title={t('tv_kick_title')}
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
                    <div className="pt-2 border-t border-line pl-2">
                      <select
                        data-testid="assign-select"
                        onChange={(e) => {
                          if (e.target.value) {
                            onAssignStudent(e.target.value, team.id);
                            e.target.value = '';
                          }
                        }}
                        className="w-full px-3 py-1.5 rounded-lg bg-surface-sunken border border-line text-xs text-ink-soft focus:outline-none"
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