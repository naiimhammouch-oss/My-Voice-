import React, { useState } from 'react';
import { Mic, Radio, Users, Library, Info, Sparkles, X, Volume2, Shield } from 'lucide-react';

interface NavbarProps {
  currentTab: 'clone' | 'studio' | 'dialogue' | 'library';
  onTabChange: (tab: 'clone' | 'studio' | 'dialogue' | 'library') => void;
  activeVoiceCount: number;
}

export const Navbar: React.FC<NavbarProps> = ({ currentTab, onTabChange, activeVoiceCount }) => {
  const [showInfoModal, setShowInfoModal] = useState(false);

  return (
    <>
      <header className="sticky top-0 z-40 bg-slate-950/80 backdrop-blur-xl border-b border-slate-800/80">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          {/* Logo & Brand */}
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => onTabChange('clone')}>
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-500 via-blue-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-cyan-500/20 text-white font-black text-lg">
              <Mic className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-extrabold text-base tracking-tight text-white">صوتي AI</span>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 font-mono">
                  PRO
                </span>
              </div>
              <span className="text-[11px] text-slate-400 block -mt-0.5">استوديو استنساخ الصوت الذكي</span>
            </div>
          </div>

          {/* Navigation Tabs */}
          <nav className="hidden md:flex items-center gap-1 p-1 bg-slate-900/90 border border-slate-800 rounded-xl">
            <button
              onClick={() => onTabChange('clone')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition ${
                currentTab === 'clone'
                  ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/25'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <Mic className="w-3.5 h-3.5" />
              <span>استنساخ صوت جديد</span>
            </button>

            <button
              onClick={() => onTabChange('studio')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition ${
                currentTab === 'studio'
                  ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/25'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <Radio className="w-3.5 h-3.5" />
              <span>استوديو التوليد الصوتي</span>
            </button>

            <button
              onClick={() => onTabChange('dialogue')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition ${
                currentTab === 'dialogue'
                  ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/25'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>حوار مزدوج</span>
            </button>

            <button
              onClick={() => onTabChange('library')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition ${
                currentTab === 'library'
                  ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/25'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <Library className="w-3.5 h-3.5" />
              <span>المكتبة ({activeVoiceCount})</span>
            </button>
          </nav>

          {/* Right Action: Status & Info */}
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 px-2.5 py-1 rounded-full bg-emerald-950/40 border border-emerald-500/30 text-[11px] text-emerald-400 font-medium">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>Gemini 3.8 Flash TTS</span>
            </div>

            <button
              onClick={() => setShowInfoModal(true)}
              className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-cyan-400 hover:bg-slate-800 transition cursor-pointer"
              title="دليل استخدام الاستنساخ الصوتي"
            >
              <Info className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Mobile Navigation Bar */}
        <div className="md:hidden flex items-center justify-around p-2 border-t border-slate-800/80 bg-slate-950">
          <button
            onClick={() => onTabChange('clone')}
            className={`flex flex-col items-center gap-1 text-[10px] font-medium p-1.5 rounded-lg ${
              currentTab === 'clone' ? 'text-cyan-400' : 'text-slate-400'
            }`}
          >
            <Mic className="w-4 h-4" />
            <span>استنساخ</span>
          </button>
          <button
            onClick={() => onTabChange('studio')}
            className={`flex flex-col items-center gap-1 text-[10px] font-medium p-1.5 rounded-lg ${
              currentTab === 'studio' ? 'text-cyan-400' : 'text-slate-400'
            }`}
          >
            <Radio className="w-4 h-4" />
            <span>التوليد</span>
          </button>
          <button
            onClick={() => onTabChange('dialogue')}
            className={`flex flex-col items-center gap-1 text-[10px] font-medium p-1.5 rounded-lg ${
              currentTab === 'dialogue' ? 'text-cyan-400' : 'text-slate-400'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>حوار</span>
          </button>
          <button
            onClick={() => onTabChange('library')}
            className={`flex flex-col items-center gap-1 text-[10px] font-medium p-1.5 rounded-lg ${
              currentTab === 'library' ? 'text-cyan-400' : 'text-slate-400'
            }`}
          >
            <Library className="w-4 h-4" />
            <span>المكتبة</span>
          </button>
        </div>
      </header>

      {/* Info Modal */}
      {showInfoModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl relative space-y-4">
            <button
              onClick={() => setShowInfoModal(false)}
              className="absolute top-4 left-4 p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2.5 text-cyan-400">
              <Sparkles className="w-5 h-5" />
              <h3 className="text-lg font-bold text-white">كيف يعمل استنساخ الصوت في صوتي AI؟</h3>
            </div>

            <div className="space-y-3 text-xs text-slate-300 leading-relaxed">
              <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800/80">
                <span className="font-bold text-cyan-300 block mb-1">1. استخراج البصمة الصوتية (Voice Fingerprint):</span>
                عند تسجيل صوتك أو رفع عينة، يقوم نموذج التحليل الصوتي باستخراج التردد الأساسي (Pitch في الهرتز)، الرنين البلعومي والصدر (Formants)، الإيقاع الزمني (Tempo)، ومخارج الحروف العربية.
              </div>

              <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800/80">
                <span className="font-bold text-amber-300 block mb-1">2. التوليد العصبي (Neural TTS Synthesis):</span>
                تتم ترجمة البصمة إلى موجهات نطق فائقة الدقة تُوجَّه إلى محرك Gemini 3.8 Flash TTS لإنتاج صوت مطابق لنبرتك بأي نص أو لهجة.
              </div>

              <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800/80">
                <span className="font-bold text-violet-300 block mb-1">3. ميكسر الاستوديو الصوتي (DSP Effects):</span>
                تعديل السرعة، تضخيم الباس (الدفء)، إبراز النقاء، وإضافة صدى الاستوديو في الوقت الفعلي لتحصل على مقطع جاهز للإذاعة والنشر.
              </div>
            </div>

            <button
              onClick={() => setShowInfoModal(false)}
              className="w-full py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs transition cursor-pointer"
            >
              فهمت ذلك، هيا نبدأ!
            </button>
          </div>
        </div>
      )}
    </>
  );
};
