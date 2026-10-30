import React, { useState, useRef, useEffect } from 'react';
import { Users, Plus, Trash2, Play, Pause, Download, Sparkles, RefreshCw, Volume2, MessageSquare } from 'lucide-react';
import { VoiceProfile, DialogueTurn } from '../types/voice';
import { StudioAudioEngine, downloadWavFile } from '../utils/audioUtils';
import { AudioWaveVisualizer } from './AudioWaveVisualizer';

interface DialogueStudioProps {
  voices: VoiceProfile[];
}

const DEFAULT_TURNS: DialogueTurn[] = [
  {
    id: 'turn-1',
    speaker: 'speaker1',
    text: 'مرحباً بكم مستمعينا الأعزاء في حلقة اليوم من بودكاست آفاق الذكاء الاصطناعي. معنا اليوم ضيفنا المميز للحديث عن مستقبل استنساخ الصوت البشري.',
  },
  {
    id: 'turn-2',
    speaker: 'speaker2',
    text: 'أهلاً بك وبجميع المتابعين! يسعدني جداً التواجد معكم. ما نشهده اليوم ليس مجرد تقليد للصوت، بل محاكاة حقيقية للمشاعر الإنسانية ورنين الحبال الصوتية بدقة مذهلة.',
  },
  {
    id: 'turn-3',
    speaker: 'speaker1',
    text: 'بالتأكيد، وهذا يفتح آفاقاً واسعة في إنتاج الأفلام والكتب الصوتية ومساعدة من فقدوا أصواتهم أيضاً.',
  },
  {
    id: 'turn-4',
    speaker: 'speaker2',
    text: 'صحيح تماماً، التقنية تخدم الإنسانية عندما تُستخدم في مواضعها الصحيحة وبإبداع.',
  },
];

export const DialogueStudio: React.FC<DialogueStudioProps> = ({ voices }) => {
  const [speaker1Id, setSpeaker1Id] = useState<string>(voices[0]?.id || '');
  const [speaker2Id, setSpeaker2Id] = useState<string>(voices[1]?.id || voices[0]?.id || '');
  const [turns, setTurns] = useState<DialogueTurn[]>(DEFAULT_TURNS);

  const [isSynthesizing, setIsSynthesizing] = useState(false);
  const [dialogueAudioBase64, setDialogueAudioBase64] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const audioEngineRef = useRef<StudioAudioEngine | null>(null);

  useEffect(() => {
    audioEngineRef.current = new StudioAudioEngine();
    return () => {
      if (audioEngineRef.current) {
        audioEngineRef.current.stop();
      }
    };
  }, []);

  const speaker1 = voices.find((v) => v.id === speaker1Id) || voices[0];
  const speaker2 = voices.find((v) => v.id === speaker2Id) || voices[1] || voices[0];

  const handleAddTurn = (speaker: 'speaker1' | 'speaker2') => {
    const newTurn: DialogueTurn = {
      id: `turn-${Date.now()}`,
      speaker,
      text: '',
    };
    setTurns([...turns, newTurn]);
  };

  const handleUpdateTurnText = (id: string, text: string) => {
    setTurns(turns.map((t) => (t.id === id ? { ...t, text } : t)));
  };

  const handleRemoveTurn = (id: string) => {
    if (turns.length <= 1) return;
    setTurns(turns.filter((t) => t.id !== id));
  };

  const handleToggleSpeaker = (id: string) => {
    setTurns(
      turns.map((t) =>
        t.id === id ? { ...t, speaker: t.speaker === 'speaker1' ? 'speaker2' : 'speaker1' } : t
      )
    );
  };

  const handleSynthesizeDialogue = async () => {
    const validTurns = turns.filter((t) => t.text.trim().length > 0);
    if (validTurns.length === 0) {
      setErrorMessage('يرجى كتابة نص حواري واحد على الأقل');
      return;
    }

    try {
      setErrorMessage(null);
      setIsSynthesizing(true);
      if (audioEngineRef.current) audioEngineRef.current.stop();
      setIsPlaying(false);

      const res = await fetch('/api/voice/dialogue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          speaker1Name: speaker1.name,
          speaker1Voice: speaker1.baseVoice,
          speaker1Style: speaker1.stylePrompt,
          speaker2Name: speaker2.name,
          speaker2Voice: speaker2.baseVoice,
          speaker2Style: speaker2.stylePrompt,
          turns: validTurns.map((t) => ({ speaker: t.speaker, text: t.text.trim() })),
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || 'فشل توليد الحوار الصوتي المزدوج');
      }

      const data = await res.json();
      if (!data.audioBase64) {
        throw new Error('لم يتم استلام بيانات صوتية من الخادم');
      }

      setDialogueAudioBase64(data.audioBase64);

      if (audioEngineRef.current) {
        await audioEngineRef.current.loadFromBase64(data.audioBase64);
        audioEngineRef.current.play(undefined, () => setIsPlaying(false));
        setIsPlaying(true);
      }
    } catch (err: any) {
      console.error('Dialogue error:', err);
      setErrorMessage(err.message || 'حدث خطأ أثناء إنتاج الحوار الصوتي');
    } finally {
      setIsSynthesizing(false);
    }
  };

  const togglePlayback = () => {
    if (!audioEngineRef.current || !dialogueAudioBase64) return;
    if (isPlaying) {
      audioEngineRef.current.pause();
      setIsPlaying(false);
    } else {
      audioEngineRef.current.play(undefined, () => setIsPlaying(false));
      setIsPlaying(true);
    }
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="bg-gradient-to-r from-slate-900/90 via-slate-900/70 to-slate-950 p-6 rounded-2xl border border-slate-800 shadow-2xl">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-medium mb-2">
              <Users className="w-3.5 h-3.5" />
              استوديو الحوار المزدوج المتقدم (Dual-Speaker Studio)
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white">
              حوار تفاعلي بين صوتين مستنسخين
            </h2>
            <p className="text-slate-400 text-sm mt-1 max-w-2xl leading-relaxed">
              اختر صوتين مختلفين من مكتبتك المستنسخة، وصمم سيناريو بودكاست، مقابلة إذاعية، أو مناظرة تفاعلية كاملة تُولد متزامنة بنموذج الذكاء الاصطناعي.
            </p>
          </div>
        </div>
      </div>

      {errorMessage && (
        <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-800/60 text-rose-300 text-sm">
          {errorMessage}
        </div>
      )}

      {/* Speaker Selectors */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Speaker 1 Card */}
        <div className="p-4 rounded-2xl bg-cyan-950/20 border border-cyan-500/30 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-cyan-400 uppercase tracking-wider flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-cyan-400" />
              المتحدث الأول (المقدم / المذيع)
            </span>
            <span className="text-2xl">{speaker1?.avatar}</span>
          </div>

          <select
            value={speaker1Id}
            onChange={(e) => setSpeaker1Id(e.target.value)}
            className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-cyan-500 cursor-pointer"
          >
            {voices.map((v) => (
              <option key={v.id} value={v.id}>
                {v.avatar} {v.name} ({v.detectedPitch})
              </option>
            ))}
          </select>
        </div>

        {/* Speaker 2 Card */}
        <div className="p-4 rounded-2xl bg-violet-950/20 border border-violet-500/30 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-violet-400 uppercase tracking-wider flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-violet-400" />
              المتحدث الثاني (الضيف / المحاور)
            </span>
            <span className="text-2xl">{speaker2?.avatar}</span>
          </div>

          <select
            value={speaker2Id}
            onChange={(e) => setSpeaker2Id(e.target.value)}
            className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-violet-500 cursor-pointer"
          >
            {voices.map((v) => (
              <option key={v.id} value={v.id}>
                {v.avatar} {v.name} ({v.detectedPitch})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Script Turns Builder */}
      <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-cyan-400" />
            <span>تسلسل الحوار والسيناريو</span>
          </h3>

          <div className="flex items-center gap-2">
            <button
              onClick={() => handleAddTurn('speaker1')}
              className="px-3 py-1.5 rounded-lg bg-cyan-950/50 hover:bg-cyan-900/60 border border-cyan-500/30 text-cyan-300 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>إضافة سطر للمتحدث 1</span>
            </button>
            <button
              onClick={() => handleAddTurn('speaker2')}
              className="px-3 py-1.5 rounded-lg bg-violet-950/50 hover:bg-violet-900/60 border border-violet-500/30 text-violet-300 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>إضافة سطر للمتحدث 2</span>
            </button>
          </div>
        </div>

        {/* List of Turns */}
        <div className="space-y-3">
          {turns.map((turn, index) => {
            const isSpk1 = turn.speaker === 'speaker1';
            const speakerObj = isSpk1 ? speaker1 : speaker2;

            return (
              <div
                key={turn.id}
                className={`p-4 rounded-xl border transition-all ${
                  isSpk1
                    ? 'bg-slate-950/70 border-cyan-500/20 hover:border-cyan-500/40'
                    : 'bg-slate-950/70 border-violet-500/20 hover:border-violet-500/40'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleToggleSpeaker(turn.id)}
                      className={`px-2.5 py-1 rounded-md text-xs font-bold flex items-center gap-1.5 cursor-pointer transition ${
                        isSpk1 ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30' : 'bg-violet-500/20 text-violet-300 border border-violet-500/30'
                      }`}
                      title="انقر للتبديل بين المتحدثين"
                    >
                      <span>{speakerObj?.avatar}</span>
                      <span>{isSpk1 ? 'المتحدث 1: ' : 'المتحدث 2: '} {speakerObj?.name.split(' ')[0]}</span>
                    </button>
                    <span className="text-[11px] text-slate-500">جولة {index + 1}</span>
                  </div>

                  <button
                    onClick={() => handleRemoveTurn(turn.id)}
                    className="p-1 text-slate-500 hover:text-rose-400 transition cursor-pointer"
                    title="حذف هذا السطر"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                <textarea
                  rows={2}
                  value={turn.text}
                  onChange={(e) => handleUpdateTurnText(turn.id, e.target.value)}
                  placeholder={`اكتب كلام ${speakerObj?.name.split(' ')[0]} هنا...`}
                  className="w-full p-2.5 bg-slate-900 border border-slate-800 rounded-lg text-slate-200 text-xs focus:outline-none focus:border-cyan-500 resize-none"
                  dir="auto"
                />
              </div>
            );
          })}
        </div>

        {/* Synthesize Button */}
        <button
          onClick={handleSynthesizeDialogue}
          disabled={isSynthesizing}
          className={`w-full py-4 rounded-xl font-bold text-base flex items-center justify-center gap-2.5 shadow-xl transition-all ${
            isSynthesizing
              ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
              : 'bg-gradient-to-r from-indigo-500 via-purple-600 to-pink-600 hover:from-indigo-400 hover:to-pink-500 text-white shadow-indigo-500/25 active:scale-98 cursor-pointer'
          }`}
        >
          {isSynthesizing ? (
            <>
              <RefreshCw className="w-5 h-5 animate-spin text-indigo-300" />
              <span>جاري إنتاج وتوليد الحوار المزدوج المتزامن...</span>
            </>
          ) : (
            <>
              <Sparkles className="w-5 h-5 text-indigo-300" />
              <span>إنتاج الحوار الصوتي الكامل الآن</span>
            </>
          )}
        </button>
      </div>

      {/* Generated Dialogue Player */}
      {dialogueAudioBase64 && (
        <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 border border-indigo-500/40 rounded-2xl p-6 shadow-2xl space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 flex items-center justify-center">
                <Volume2 className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-white text-base">تم إنتاج الحوار المزدوج بنجاح!</h4>
                <p className="text-xs text-slate-400">حوار متكامل بين {speaker1.name.split(' ')[0]} و {speaker2.name.split(' ')[0]}</p>
              </div>
            </div>

            <button
              onClick={() => downloadWavFile(dialogueAudioBase64, 'dual_voice_dialogue.wav')}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-2 shadow-lg shadow-emerald-600/20 transition cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>تحميل الحوار (WAV)</span>
            </button>
          </div>

          <AudioWaveVisualizer
            analyser={audioEngineRef.current?.getAnalyser()}
            isPlaying={isPlaying}
            height={75}
            barCount={52}
          />

          <div className="flex items-center gap-4 pt-1">
            <button
              onClick={togglePlayback}
              className="w-12 h-12 rounded-full bg-indigo-500 hover:bg-indigo-400 text-slate-950 flex items-center justify-center font-bold shadow-lg shadow-indigo-500/30 transition-transform active:scale-95 cursor-pointer"
            >
              {isPlaying ? <Pause className="w-6 h-6 fill-current" /> : <Play className="w-6 h-6 fill-current translate-x-[-1px]" />}
            </button>
            <span className="text-xs text-slate-300 font-medium">
              {isPlaying ? 'جاري الاستماع للحوار المزدوج...' : 'انقر للاستماع إلى النتيجة المنسقة'}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
