import React, { useState } from 'react';
import {
  Library,
  Play,
  Trash2,
  Download,
  Sparkles,
  Search,
  Filter,
  Share2,
  Clock,
  CheckCircle,
  FileCode,
  Music,
} from 'lucide-react';
import { VoiceProfile, GenerationHistoryItem } from '../types/voice';
import { downloadWavFile } from '../utils/audioUtils';

interface VoiceLibraryProps {
  voices: VoiceProfile[];
  onSelectVoiceForStudio: (voice: VoiceProfile) => void;
  onDeleteVoice: (id: string) => void;
  historyItems: GenerationHistoryItem[];
}

export const VoiceLibrary: React.FC<VoiceLibraryProps> = ({
  voices,
  onSelectVoiceForStudio,
  onDeleteVoice,
  historyItems,
}) => {
  const [activeTab, setActiveTab] = useState<'voices' | 'history'>('voices');
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const filteredVoices = voices.filter((v) => {
    const matchSearch =
      v.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      v.detectedPitch.toLowerCase().includes(searchQuery.toLowerCase()) ||
      v.detectedTimbre.toLowerCase().includes(searchQuery.toLowerCase());
    const matchCat = categoryFilter === 'all' || v.category === categoryFilter;
    return matchSearch && matchCat;
  });

  const exportVoiceJson = (voice: VoiceProfile) => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(voice, null, 2));
    const dlAnchorElem = document.createElement('a');
    dlAnchorElem.setAttribute('href', dataStr);
    dlAnchorElem.setAttribute('download', `${voice.name}_voiceprint.json`);
    dlAnchorElem.click();
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-slate-900/90 via-slate-900/70 to-slate-950 p-6 rounded-2xl border border-slate-800 shadow-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-xs font-medium mb-2">
            <Library className="w-3.5 h-3.5" />
            مخزن البصمات الصوتية المسجلة
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-white">
            مكتبة الأصوات وسجل التوليد
          </h2>
          <p className="text-slate-400 text-sm mt-1 max-w-2xl leading-relaxed">
            استعرض البصمات الصوتية المستنسخة، صَدّر خصائص الرنين الصوتي، أو استمع للمقاطع السابقة التي تم إنتاجها.
          </p>
        </div>

        {/* Tab switch */}
        <div className="flex items-center gap-2 p-1 bg-slate-950 border border-slate-800 rounded-xl">
          <button
            onClick={() => setActiveTab('voices')}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition ${
              activeTab === 'voices'
                ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/25'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            الأصوات المستنسخة ({voices.length})
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition ${
              activeTab === 'history'
                ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/25'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            سجل الإنتاج ({historyItems.length})
          </button>
        </div>
      </div>

      {activeTab === 'voices' ? (
        <div className="space-y-6">
          {/* Filters & Search */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 absolute right-3.5 top-3 text-slate-500" />
              <input
                type="text"
                placeholder="ابحث بالاسم أو الطبقة..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pr-10 pl-4 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div className="flex items-center gap-2 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0 text-xs">
              {[
                { id: 'all', label: 'الكل' },
                { id: 'documentary', label: 'وثائقي' },
                { id: 'broadcast', label: 'إخباري' },
                { id: 'storytelling', label: 'قصص' },
                { id: 'commercial', label: 'تجاري' },
                { id: 'custom', label: 'مخصص' },
              ].map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setCategoryFilter(cat.id)}
                  className={`px-3 py-1.5 rounded-lg border whitespace-nowrap transition cursor-pointer ${
                    categoryFilter === cat.id
                      ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-300 font-semibold'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          {/* Voices Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredVoices.map((voice) => (
              <div
                key={voice.id}
                className="bg-slate-900/70 border border-slate-800 hover:border-slate-700 rounded-2xl p-5 shadow-xl transition-all space-y-4 relative group"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-3xl p-2.5 rounded-xl bg-slate-800/80 group-hover:scale-105 transition-transform">
                      {voice.avatar}
                    </span>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-white text-base">{voice.name}</h3>
                        {voice.isPreset && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 font-medium">
                            نموذج أصلي
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-cyan-400 font-mono block mt-0.5">
                        {voice.detectedPitch}
                      </span>
                    </div>
                  </div>

                  {/* Actions dropdown / buttons */}
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => exportVoiceJson(voice)}
                      className="p-1.5 text-slate-400 hover:text-cyan-400 hover:bg-slate-800 rounded-lg transition"
                      title="تصدير البصمة الصوتية (JSON)"
                    >
                      <FileCode className="w-4 h-4" />
                    </button>
                    {!voice.isPreset && (
                      <button
                        onClick={() => onDeleteVoice(voice.id)}
                        className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition"
                        title="حذف الصوت"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                <p className="text-xs text-slate-300 leading-relaxed bg-slate-950/60 p-3 rounded-xl border border-slate-800/60">
                  {voice.summaryArabic || voice.description}
                </p>

                {/* Acoustic traits pills */}
                <div className="grid grid-cols-3 gap-2 text-center text-[11px]">
                  <div className="bg-slate-950/50 p-2 rounded-lg border border-slate-800/50">
                    <span className="text-slate-500 block">الدفء</span>
                    <span className="font-mono text-amber-400 font-bold">{voice.acousticMetrics.warmth}%</span>
                  </div>
                  <div className="bg-slate-950/50 p-2 rounded-lg border border-slate-800/50">
                    <span className="text-slate-500 block">النقاء</span>
                    <span className="font-mono text-cyan-400 font-bold">{voice.acousticMetrics.clarity}%</span>
                  </div>
                  <div className="bg-slate-950/50 p-2 rounded-lg border border-slate-800/50">
                    <span className="text-slate-500 block">الطاقة</span>
                    <span className="font-mono text-violet-400 font-bold">{voice.acousticMetrics.energy}%</span>
                  </div>
                </div>

                {/* Primary Action Button */}
                <button
                  onClick={() => onSelectVoiceForStudio(voice)}
                  className="w-full py-2.5 rounded-xl bg-gradient-to-r from-cyan-500/20 to-blue-600/20 hover:from-cyan-500 hover:to-blue-600 text-cyan-300 hover:text-white border border-cyan-500/40 font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>استخدام هذا الصوت في استوديو التوليد</span>
                </button>
              </div>
            ))}
          </div>
        </div>
      ) : (
        /* History Section */
        <div className="space-y-4">
          {historyItems.length === 0 ? (
            <div className="p-12 text-center rounded-2xl bg-slate-900/50 border border-slate-800 text-slate-400">
              <Music className="w-12 h-12 mx-auto text-slate-600 mb-3" />
              <p className="text-base font-bold text-slate-300 mb-1">لا توجد تسجيلات منشأة بعد في هذه الجلسة</p>
              <p className="text-xs text-slate-500">اذهب إلى استوديو التوليد واكتب نصاً لبدء القراءة الصوتية بالذكاء الاصطناعي.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {historyItems.map((item) => (
                <div
                  key={item.id}
                  className="p-4 rounded-xl bg-slate-900/70 border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
                >
                  <div className="space-y-1 max-w-xl">
                    <div className="flex items-center gap-2 text-xs">
                      <span className="font-bold text-cyan-400">{item.voiceName}</span>
                      <span className="text-slate-600">•</span>
                      <span className="text-slate-400 flex items-center gap-1 font-mono text-[11px]">
                        <Clock className="w-3 h-3" />
                        {new Date(item.createdAt).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <p className="text-xs text-slate-300 line-clamp-2 font-serif italic">
                      "{item.text}"
                    </p>
                  </div>

                  <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                    <button
                      onClick={() => {
                        const a = new Audio(`data:audio/wav;base64,${item.audioBase64}`);
                        a.play();
                      }}
                      className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-300 text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition"
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span>تشغيل</span>
                    </button>

                    <button
                      onClick={() => downloadWavFile(item.audioBase64, `cloned_${item.voiceName}.wav`)}
                      className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition cursor-pointer"
                      title="تحميل المقطع الصوتي"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
