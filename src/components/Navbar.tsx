import React, { useState } from 'react';
import { Award, Volume2, VolumeX, Copy, Check, LogOut, KeyRound } from 'lucide-react';

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
  const [copied, setCopied] = useState(false);

  const handleCopyPin = () => {
    if (!pin) return;
    navigator.clipboard.writeText(String(pin));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <header className="bg-slate-900/95 border-b border-indigo-500/20 sticky top-0 z-50 text-white shadow-2xl backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 h-14 sm:h-16 flex items-center justify-between gap-2 sm:gap-3">
        {/* Brand / Logo */}
        <div
          onClick={() => setViewMode('TEACHER')}
          className="flex items-center gap-2 sm:gap-3 cursor-pointer group min-w-0 shrink"
        >
          <div className="w-9 h-9 sm:w-11 sm:h-11 bg-indigo-600 rounded-xl flex items-center justify-center shadow-[0_0_20px_rgba(79,70,229,0.5)] group-hover:scale-105 transition-transform shrink-0 border border-indigo-400/40">
            <Award className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-black text-xs sm:text-base md:text-lg tracking-tight text-white uppercase truncate">
                RAQAMLI VIKTORINA <span className="text-indigo-400 font-mono text-[10px] sm:text-xs font-bold">v2.0</span>
              </span>
              <span className="text-[10px] uppercase font-extrabold tracking-wider px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 hidden lg:inline-block shrink-0">
                {viewMode === 'TEACHER' ? "O'qituvchi Boshqaruvi" : "O'quvchi Tizimi"}
              </span>
            </div>
            <p className="text-[10px] sm:text-xs text-slate-300 font-mono font-medium tracking-wide uppercase hidden md:block truncate">
              Interaktiv chempionat o'quv tizimi
            </p>
          </div>
        </div>

        {/* Center: Interactive PIN Badge */}
        {pin && viewMode === 'TEACHER' && isTeacherAuth && (
          <button
            onClick={handleCopyPin}
            className="flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl bg-slate-950 hover:bg-slate-800 border border-indigo-500/50 shadow-[0_0_15px_rgba(79,70,229,0.25)] transition-all cursor-pointer group shrink-0"
            title="PIN-kodni (raqamlarni) nusxalash uchun bosing"
          >
            <span className="text-[11px] text-slate-300 uppercase font-extrabold tracking-wider hidden md:inline">
              PIN-kod:
            </span>
            <span className="font-mono font-black text-indigo-400 text-base sm:text-xl md:text-2xl tracking-widest">
              {pin}
            </span>
            {copied ? (
              <Check className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-400 shrink-0" />
            ) : (
              <Copy className="w-4 h-4 sm:w-5 sm:h-5 text-slate-400 group-hover:text-indigo-300 transition-colors shrink-0" />
            )}
            {copied && (
              <span className="text-xs text-emerald-400 font-black uppercase tracking-wider hidden sm:inline">
                Nusxalandi!
              </span>
            )}
          </button>
        )}

        {/* Right Controls */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Teacher Actions */}
          {viewMode === 'TEACHER' && isTeacherAuth && (
            <>
              {onChangePasswordTeacher && (
                <button
                  onClick={onChangePasswordTeacher}
                  aria-label="O'qituvchi parolini o'zgartirish"
                  className="flex items-center gap-1.5 px-2.5 py-2 sm:px-3.5 sm:py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/35 text-amber-300 border border-amber-500/40 text-[11px] sm:text-sm font-bold uppercase tracking-wider transition-all cursor-pointer"
                  title="O'qituvchi parolini o'zgartirish"
                >
                  <KeyRound className="w-4 h-4 sm:w-5 sm:h-5 text-amber-400 shrink-0" />
                  <span className="hidden md:inline">Parol</span>
                </button>
              )}
              {onLogoutTeacher && (
                <button
                  onClick={onLogoutTeacher}
                  aria-label="O'qituvchi seansidan chiqish"
                  className="flex items-center gap-1.5 px-2.5 py-2 sm:px-3.5 sm:py-2 rounded-xl bg-rose-500/20 hover:bg-rose-500/35 text-rose-300 border border-rose-500/40 text-[11px] sm:text-sm font-bold uppercase tracking-wider transition-all cursor-pointer"
                  title="O'qituvchi seansidan chiqish"
                >
                  <LogOut className="w-4 h-4 sm:w-5 sm:h-5 text-rose-400 shrink-0" />
                  <span className="hidden md:inline">Chiqish</span>
                </button>
              )}
            </>
          )}

          {/* Sound Mute/Unmute */}
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            aria-label={soundEnabled ? "Ovozni o'chirish" : "Ovozni yoqish"}
            className="p-2 sm:p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white transition-all border border-white/10 shrink-0 cursor-pointer"
            title={soundEnabled ? "Ovozni o'chirish" : "Ovozni yoqish"}
          >
            {soundEnabled ? (
              <Volume2 className="w-5 h-5 sm:w-6 sm:h-6 text-indigo-400" />
            ) : (
              <VolumeX className="w-5 h-5 sm:w-6 sm:h-6 text-slate-400" />
            )}
          </button>
        </div>
      </div>
    </header>
  );
};


