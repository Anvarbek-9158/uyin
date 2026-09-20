import React, { useEffect, useState } from 'react';
import { StudentFeedback } from '../types';
import { MessageSquare, X } from 'lucide-react';
import { useLang } from '../i18n';

interface FeedbackListModalProps {
  isOpen: boolean;
  onClose: () => void;
  feedbacks: StudentFeedback[];
}

export const FeedbackListModal: React.FC<FeedbackListModalProps> = ({
  isOpen,
  onClose,
  feedbacks = [],
}) => {
  const { t } = useLang();
  const [filterRating, setFilterRating] = useState<'Barchasi' | 'Yaxshi' | 'Yomon' | "A'lo">('Barchasi');

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const filteredFeedbacks = feedbacks.filter((f) => {
    if (filterRating === 'Barchasi') return true;
    return f.rating === filterRating;
  });

  const aloCount = feedbacks.filter((f) => f.rating === "A'lo").length;
  const yaxshiCount = feedbacks.filter((f) => f.rating === 'Yaxshi').length;
  const yomonCount = feedbacks.filter((f) => f.rating === 'Yomon').length;

  const rateText = (r: string) =>
    r === "A'lo" ? t('sv_rate_excellent') : r === 'Yaxshi' ? t('sv_rate_good') : t('sv_rate_bad');

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-surface-sunken backdrop-blur-md animate-[var(--animate-fade-in)]"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-surface border border-line rounded-3xl max-w-3xl w-full p-5 sm:p-6 shadow-2xl relative flex flex-col max-h-[85vh]"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-line shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-brand-600 text-ink shadow-[var(--shadow-pop-brand)]">
              <MessageSquare className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg sm:text-xl font-bold text-ink uppercase tracking-tight">
                {t('flm_title')} ({feedbacks.length})
              </h3>
              <p className="text-xs text-ink-faint">
                {t('flm_sub')}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            aria-label={t('close')}
            className="inline-flex items-center justify-center h-10 w-10 text-ink-faint hover:text-ink rounded-xl hover:bg-surface-raised transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filter Tabs */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 py-4 shrink-0">
          <button
            type="button"
            onClick={() => setFilterRating('Barchasi')}
            className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              filterRating === 'Barchasi'
                ? 'bg-brand-600 text-ink border-brand-500 shadow-[var(--shadow-pop-brand)]'
                : 'bg-surface-sunken border-line text-ink-faint hover:text-ink'
            }`}
          >
            {t('qsm_all')} ({feedbacks.length})
          </button>

          <button
            type="button"
            onClick={() => setFilterRating("A'lo")}
            className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              filterRating === "A'lo"
                ? 'bg-play-500/20 text-play-400 border-play-500/60 shadow-[var(--shadow-pop-play)]'
                : 'bg-surface-sunken border-line text-ink-faint hover:text-ink'
            }`}
          >
            🟢 {t('sv_rate_excellent')} ({aloCount})
          </button>

          <button
            type="button"
            onClick={() => setFilterRating('Yaxshi')}
            className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              filterRating === 'Yaxshi'
                ? 'bg-warn-500/20 text-warn-400 border-warn-500/60 shadow-[0_0_12px_rgba(245,158,11,0.2)]'
                : 'bg-surface-sunken border-line text-ink-faint hover:text-ink'
            }`}
          >
            🟡 {t('sv_rate_good')} ({yaxshiCount})
          </button>

          <button
            type="button"
            onClick={() => setFilterRating('Yomon')}
            className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              filterRating === 'Yomon'
                ? 'bg-danger-500/20 text-danger-400 border-danger-500/60 shadow-[0_0_12px_rgba(244,63,94,0.2)]'
                : 'bg-surface-sunken border-line text-ink-faint hover:text-ink'
            }`}
          >
            🔴 {t('sv_rate_bad')} ({yomonCount})
          </button>
        </div>

        {/* List */}
        <div className="overflow-y-auto pr-1 space-y-3 flex-1">
          {filteredFeedbacks.length === 0 ? (
            <div className="p-8 text-center rounded-2xl bg-surface-sunken border border-dashed border-line text-ink-faint">
              {t('flm_none')}
            </div>
          ) : (
            filteredFeedbacks.map((fb) => {
              const ratingBadge =
                fb.rating === "A'lo"
                  ? 'bg-play-500/20 text-play-400 border-play-500/40'
                  : fb.rating === 'Yomon'
                  ? 'bg-danger-500/20 text-danger-400 border-danger-500/40'
                  : 'bg-warn-500/20 text-warn-400 border-warn-500/40';

              return (
                <div
                  key={fb.id}
                  className="p-4 rounded-2xl bg-surface-sunken border border-line space-y-2 shadow-sm"
                >
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-ink text-sm">
                        {fb.studentName}
                      </span>
                      <span className="text-xs px-2.5 py-1 rounded-full bg-brand-500/15 border border-brand-300 text-brand-300 font-bold">
                        {fb.teamName}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className={`text-xs px-2.5 py-1 rounded-full border font-bold uppercase tracking-wider ${ratingBadge}`}>
                        {fb.rating === "A'lo" && `🟢 ${t('sv_rate_excellent')}`}
                        {fb.rating === 'Yaxshi' && `🟡 ${t('sv_rate_good')}`}
                        {fb.rating === 'Yomon' && `🔴 ${t('sv_rate_bad')}`}
                      </span>
                      <span className="text-xs text-ink-faint">
                        {new Date(fb.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>

                  {fb.comment ? (
                    <p className="text-xs text-ink-soft bg-surface/95 p-3 rounded-xl border border-line italic">
                      "{fb.comment}"
                    </p>
                  ) : (
                    <p className="text-xs text-ink-faint italic">
                      {t('flm_no_comment')}
                    </p>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Modal Footer */}
        <div className="pt-4 border-t border-line flex justify-end shrink-0">
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-surface-raised hover:bg-surface-raised text-ink text-xs font-bold uppercase tracking-wider cursor-pointer"
          >
            {t('flm_close')}
          </button>
        </div>
      </div>
    </div>
  );
};
