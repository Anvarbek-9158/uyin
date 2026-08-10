import React, { useState, useEffect, useRef } from 'react';
import { Sparkles, X, Loader2, AlertCircle, Image as ImageIcon, Upload, RefreshCw, CheckCircle2, Trash2 } from 'lucide-react';
import { Question } from '../types';

interface GeminiAiModalProps {
  isOpen: boolean;
  onClose: () => void;
  onQuestionsGenerated: (questions: Question[]) => void;
}

export const GeminiAiModal: React.FC<GeminiAiModalProps> = ({
  isOpen,
  onClose,
  onQuestionsGenerated,
}) => {
  const [topic, setTopic] = useState("Informatika va Raqamli Texnologiyalar");
  const [userPrompt, setUserPrompt] = useState("");
  const [count, setCount] = useState(10);
  const [difficulty, setDifficulty] = useState<'Oson' | "O'rta" | 'Qiyin'>("O'rta");
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generatedQuestions, setGeneratedQuestions] = useState<Question[] | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const handlePaste = (e: ClipboardEvent) => {
      if (e.clipboardData && e.clipboardData.files.length > 0) {
        const file = e.clipboardData.files[0];
        if (file.type.startsWith('image/')) {
          e.preventDefault();
          readAndSetImage(file);
        }
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [isOpen]);

  if (!isOpen) return null;

  const readAndSetImage = (file: File) => {
    if (!file.type.startsWith('image/')) {
      setError("Iltimos faqat rasm faylini tanlang!");
      return;
    }
    const reader = new FileReader();
    reader.onload = (evt) => {
      if (evt.target?.result) {
        setImagePreview(evt.target.result as string);
        setError(null);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      readAndSetImage(e.target.files[0]);
    }
  };

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);

    try {
      const backendUrl = import.meta.env.VITE_BACKEND_URL || '';
      const res = await fetch(`${backendUrl}/api/ai-generate-questions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic,
          userPrompt,
          count,
          difficulty,
          imageBase64: imagePreview,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Savollarni yaratib bo\'lmadi');
      }

      setGeneratedQuestions(data.questions);
    } catch (err: any) {
      setError(err.message || 'Xatolik yuz berdi');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveQuestions = () => {
    if (generatedQuestions && generatedQuestions.length > 0) {
      onQuestionsGenerated(generatedQuestions);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-md animate-fadeIn">
      <div className="bg-slate-900 border border-white/10 rounded-2xl max-w-2xl w-full p-5 sm:p-6 shadow-2xl relative overflow-hidden flex flex-col max-h-[90vh]">
        {/* Background glow */}
        <div className="absolute -top-20 -right-20 w-48 h-48 bg-indigo-500/15 blur-3xl rounded-full pointer-events-none" />

        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/10 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-indigo-600 text-white shadow-[0_0_15px_rgba(79,70,229,0.4)]">
              <Sparkles className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div>
              <h3 className="text-lg sm:text-xl font-bold text-white uppercase tracking-tight">
                AI Viktorina Generator
              </h3>
              <p className="text-[11px] sm:text-xs text-slate-400 font-mono">
                Gemini 3.6 Flash yordamida rasm yoki mavzudan 10 ta savol generatsiyasi
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1.5 rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="overflow-y-auto py-4 space-y-4 pr-1 flex-1">
          {error && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          {/* Form inputs */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">
                Mavzu yoki Fan nomi
              </label>
              <input
                type="text"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="Masalan: Informatika, Fizika, Matematika..."
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-white/10 text-white text-xs sm:text-sm focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">
                Savollar soni
              </label>
              <select
                value={count}
                onChange={(e) => setCount(Number(e.target.value))}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-white/10 text-white text-xs sm:text-sm focus:outline-none focus:border-indigo-500 font-bold"
              >
                <option value={10}>10 ta savol (Tavsiya)</option>
                <option value={5}>5 ta savol</option>
                <option value={15}>15 ta savol</option>
              </select>
            </div>
          </div>

          {/* Difficulty Level Selector */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1.5">
              Qiyinlik Darajasi (AI savollar tuzish uslubi)
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setDifficulty('Oson')}
                className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  difficulty === 'Oson'
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/60 shadow-[0_0_12px_rgba(16,185,129,0.3)]'
                    : 'bg-slate-950 border-white/10 text-slate-400 hover:text-white'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                🟢 Oson
              </button>

              <button
                type="button"
                onClick={() => setDifficulty("O'rta")}
                className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  difficulty === "O'rta"
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/60 shadow-[0_0_12px_rgba(245,158,11,0.3)]'
                    : 'bg-slate-950 border-white/10 text-slate-400 hover:text-white'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-amber-400" />
                🟡 O'rta
              </button>

              <button
                type="button"
                onClick={() => setDifficulty('Qiyin')}
                className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  difficulty === 'Qiyin'
                    ? 'bg-rose-500/20 text-rose-300 border-rose-500/60 shadow-[0_0_12px_rgba(244,63,94,0.3)]'
                    : 'bg-slate-950 border-white/10 text-slate-400 hover:text-white'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-rose-400" />
                🔴 Qiyin
              </button>
            </div>
          </div>

          {/* Prompt input */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">
              AI uchun maxsus ko'rsatma / Prompt (Ixtiyoriy)
            </label>
            <input
              type="text"
              value={userPrompt}
              onChange={(e) => setUserPrompt(e.target.value)}
              placeholder="Masalan: Faqat o'rta va qiyin darajadagi mantiqiy savollar bo'lsin..."
              className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-white/10 text-white text-xs focus:outline-none focus:border-indigo-500"
            />
          </div>

          {/* Image Upload & Clipboard Paste Zone */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">
              Rasm Biriktirish (Kompyuter xotirasidan yoki Clipboard / Paste Ctrl+V)
            </label>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileChange}
            />

            {imagePreview ? (
              <div className="relative p-2 rounded-xl bg-slate-950 border border-indigo-500/40 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 overflow-hidden">
                  <img
                    src={imagePreview}
                    alt="Yuklangan rasm"
                    className="w-16 h-16 object-cover rounded-lg border border-white/10 shrink-0"
                  />
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-indigo-300 truncate">
                      Rasm muvaffaqiyatli biriktirildi
                    </p>
                    <p className="text-[10px] text-slate-400">
                      AI ushbu rasm va topshiriqlarni tahlil qilib savol tuzadi
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setImagePreview(null)}
                  className="p-2 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 transition-colors shrink-0 cursor-pointer"
                  title="Rasmni o'chirish"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="p-4 rounded-xl bg-slate-950/60 border border-dashed border-white/15 hover:border-indigo-500/50 cursor-pointer transition-all flex flex-col items-center justify-center gap-1.5 text-center group"
              >
                <div className="w-9 h-9 rounded-full bg-indigo-500/10 flex items-center justify-center text-indigo-400 group-hover:scale-110 transition-transform">
                  <Upload className="w-4 h-4" />
                </div>
                <p className="text-xs font-semibold text-slate-300">
                  Kompyuter xotirasidan rasm yuklash uchun bosing
                </p>
                <p className="text-[10px] text-slate-500 font-mono">
                  yoki ekran rasmini oling va <span className="text-indigo-400 font-bold">Ctrl + V</span> bilan bu yerga qo'ying
                </p>
              </div>
            )}
          </div>

          {/* Generated Questions List Preview */}
          {generatedQuestions && generatedQuestions.length > 0 && (
            <div className="mt-4 pt-4 border-t border-white/10 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-emerald-400 text-xs uppercase tracking-wider flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" />
                  Yaratilgan {generatedQuestions.length} ta savol
                </h4>

                <button
                  onClick={handleGenerate}
                  disabled={loading}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-200 border border-indigo-500/40 text-[11px] font-bold uppercase transition-all cursor-pointer"
                  title="Xuddi shu so'rov bo'yicha yana 10 ta yangi savol generatsiya qilish"
                >
                  <RefreshCw className={`w-3.5 h-3.5 text-indigo-400 ${loading ? 'animate-spin' : ''}`} />
                  Yangi {count} ta savol olish
                </button>
              </div>

              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {generatedQuestions.map((q, idx) => (
                  <div
                    key={q.id || idx}
                    className="p-3 rounded-xl bg-slate-950/80 border border-white/10 text-xs space-y-1"
                  >
                    <div className="flex items-center justify-between font-bold text-indigo-300">
                      <span>{idx + 1}-SAVOL ({q.timeLimit}s)</span>
                      <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                        To'g'ri: {q.correctAnswer}
                      </span>
                    </div>
                    <p className="text-slate-200 font-medium">{q.text}</p>
                    <div className="grid grid-cols-2 gap-1.5 pt-1 text-[11px] text-slate-400">
                      {q.options?.map((opt, oIdx) => (
                        <div
                          key={oIdx}
                          className={`px-2 py-1 rounded bg-slate-900 border ${
                            opt === q.correctAnswer
                              ? 'border-emerald-500/50 text-emerald-300 font-bold'
                              : 'border-white/5'
                          }`}
                        >
                          {String.fromCharCode(65 + oIdx)}) {opt}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer Controls */}
        <div className="flex items-center justify-between gap-3 pt-4 border-t border-white/10 shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-slate-400 hover:text-white text-xs font-bold uppercase tracking-wider cursor-pointer"
          >
            Bekor qilish
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={handleGenerate}
              disabled={loading}
              className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-indigo-300 hover:text-white border border-white/10 transition-all cursor-pointer disabled:opacity-50"
              title="Qaytadan yangi 10 ta savol generatsiya qilish"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>

            {generatedQuestions && generatedQuestions.length > 0 ? (
              <button
                onClick={handleSaveQuestions}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs uppercase tracking-wider shadow-[0_0_15px_rgba(16,185,129,0.4)] transition-all cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" />
                Barcha {generatedQuestions.length} ta savolni saqlash
              </button>
            ) : (
              <button
                onClick={handleGenerate}
                disabled={loading || (!topic.trim() && !imagePreview)}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs uppercase tracking-wider shadow-[0_0_15px_rgba(79,70,229,0.4)] disabled:opacity-50 transition-all cursor-pointer"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    AI Generatsiya qilinmoqda...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    Savollarni Generatsiya Qilish
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
