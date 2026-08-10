import React, { useState } from 'react';
import { Award, Volume2, VolumeX, Copy, Check, LogOut, Shield, KeyRound } from 'lucide-react';

interface NavbarProps {
  viewMode: 'LANDING' | 'TEACHER' | 'STUDENT';
  setViewMode: (mode: 'LANDING' | 'TEACHER' | 'STUDENT') => void;
  pin: string | null;
  soundEnabled: boolean;
  setSoundEnabled: (enabled: boolean) => void;
  onResetGame?: () => void;
  isTeacherAuth?: boolean;
  onLogoutTeacher?: () => void;
  onChangePasswordTeacher?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  viewMode,
  setViewMode,
  pin,
  soundEnabled,
  setSoundEnabled,
  isTeacherAuth,
  onLogoutTeacher,
  onChangePasswordTeacher,
}) => {
  const [copiedLink, setCopiedLink] = useState(false);

  const handleCopyStudentLink = () => {
    if (!pin) return;
    const studentUrl = `${window.location.origin}/student?pin=${pin}`;
    navigator.clipboard.writeText(studentUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  return (
    <header className="bg-slate-900/90 border-b border-white/10 sticky top-0 z-50 text-white shadow-2xl backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 h-16 sm:h-20 flex items-center justify-between gap-2 sm:gap-4">
        {/* Brand / Logo */}
        <div
          onClick={() => setViewMode('TEACHER')}
          className="flex items-center gap-2 sm:gap-3 cursor-pointer group min-w-0 shrink"
        >
          <div className="w-9 h-9 sm:w-10 sm:h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-[0_0_15px_rgba(79,70,229,0.5)] group-hover:scale-105 transition-transform shrink-0">
            <Award className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 sm:gap-2">
              <span className="font-bold text-xs sm:text-base md:text-lg tracking-tight text-white uppercase truncate">
                RAQAMLI VIKTORINA <span className="text-indigo-400 font-mono text-[10px] sm:text-xs">v2.0</span>
              </span>
              <span className="text-[10px] uppercase font-bold tracking-widest px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 hidden lg:inline-block shrink-0">
                {viewMode === 'TEACHER' ? "O'qituvchi Boshqaruvi" : "O'quvchi Tizimi"}
              </span>
            </div>
            <p className="text-[10px] text-slate-400 font-mono tracking-widest uppercase hidden md:block truncate">
              Interaktiv chempionat o'quv tizimi
            </p>
          </div>
        </div>

        {/* Center: Interactive PIN Badge */}
        {pin && viewMode === 'TEACHER' && isTeacherAuth && (
          <button
            onClick={handleCopyStudentLink}
            className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3.5 py-1.5 rounded-xl bg-slate-950 hover:bg-slate-800 border border-indigo-500/30 shadow-[0_0_15px_rgba(79,70,229,0.15)] transition-all cursor-pointer group shrink-0"
            title="O'quvchi linkini nusxalash uchun bosing"
          >
            <span className="text-[10px] text-slate-400 uppercase font-bold tracking-widest hidden md:inline">
              PIN-kod:
            </span>
            <span className="font-mono font-black text-indigo-400 text-sm sm:text-lg md:text-xl tracking-wider sm:tracking-widest">
              {pin}
            </span>
            {copiedLink ? (
              <Check className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-400 shrink-0" />
            ) : (
              <Copy className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-slate-500 group-hover:text-indigo-300 transition-colors shrink-0" />
            )}
            {copiedLink && (
              <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider hidden xs:inline">
                Nusxalandi!
              </span>
            )}
          </button>
        )}

        {/* Right Controls */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* Teacher Actions */}
          {viewMode === 'TEACHER' && isTeacherAuth && (
            <>
              {onChangePasswordTeacher && (
                <button
                  onClick={onChangePasswordTeacher}
                  className="flex items-center gap-1.5 p-2 sm:px-3 sm:py-2 rounded-xl bg-amber-500/15 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 text-xs font-bold uppercase tracking-wider transition-all cursor-pointer"
                  title="O'qituvchi parolini o'zgartirish"
                >
                  <KeyRound className="w-4 h-4 text-amber-400 shrink-0" />
                  <span className="hidden md:inline">Parolni o'zgartirish</span>
                </button>
              )}
              {onLogoutTeacher && (
                <button
                  onClick={onLogoutTeacher}
                  className="flex items-center gap-1.5 p-2 sm:px-3 sm:py-2 rounded-xl bg-rose-500/15 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 text-xs font-bold uppercase tracking-wider transition-all cursor-pointer"
                  title="O'qituvchi seansidan chiqish"
                >
                  <LogOut className="w-4 h-4 text-rose-400 shrink-0" />
                  <span className="hidden md:inline">Chiqish</span>
                </button>
              )}
            </>
          )}

          {/* Sound Mute/Unmute */}
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className="p-2 sm:p-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white transition-all border border-white/10 shrink-0 cursor-pointer"
            title={soundEnabled ? "Ovozni o'chirish" : "Ovozni yoqish"}
          >
            {soundEnabled ? (
              <Volume2 className="w-4 h-4 sm:w-5 sm:h-5 text-indigo-400" />
            ) : (
              <VolumeX className="w-4 h-4 sm:w-5 sm:h-5 text-slate-500" />
            )}
          </button>
        </div>
      </div>
    </header>
  );
};
