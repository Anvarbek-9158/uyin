import {BarChart3} from 'lucide-react';
import {Leaderboard} from './Leaderboard';
import {useLang} from '../i18n';
import type {Team, Student} from '../types';
import {Card} from '../ui/Card';

interface TeacherResultsPanelProps {
  teams: Record<string, Team>;
  students: Record<string, Student>;
  hasActiveGame: boolean;
}

export function TeacherResultsPanel({teams, students, hasActiveGame}: TeacherResultsPanelProps) {
  const {t} = useLang();

  if (!hasActiveGame || Object.keys(teams || {}).length === 0) {
    return (
      <div className="mx-auto max-w-2xl p-4 sm:p-6">
        <Card className="flex flex-col items-center gap-3 p-10 text-center">
          <BarChart3 className="h-10 w-10 text-ink-faint" />
          <p className="text-sm font-semibold text-ink-soft">{t('tresults_empty')}</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl p-4 sm:p-6">
      <h2 className="mb-5 font-display text-xl font-bold text-ink">{t('tside_results')}</h2>
      <Leaderboard teams={teams} students={students} />
    </div>
  );
}
