import React, { useState, useRef, useEffect } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  Download,
  Sparkles,
  Sliders,
  Volume2,
  RefreshCw,
  FileText,
  Copy,
  Check,
  Zap,
  Activity,
  Layers,
} from 'lucide-react';
import { VoiceProfile, GenerationHistoryItem } from '../types/voice';
import { SAMPLE_TEXTS } from '../data/presetVoices';
import { StudioAudioEngine, downloadWavFile, StudioDspEffects } from '../utils/audioUtils';
import { AudioWaveVisualizer } from './AudioWaveVisualizer';

interface SpeechStudioProps {
  voices: VoiceProfile[];
  activeVoice: VoiceProfile;
  onSelectVoice: (voice: VoiceProfile) => void;
  onAddToHistory: (item: GenerationHistoryItem) => void;
  onNavigateToClone: () => void;
}

export const SpeechStudio: React.FC<SpeechStudioProps> = ({
  voices,
  activeVoice,
  onSelectVoice,
  onAddToHistory,
  onNavigateToClone,
}) => {
  const [inputText, setInputText] = useState(SAMPLE_TEXTS[0].text);
  const [selectedEmotion, setSelectedEmotion] = useState('natural');
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0);
  const [bassBoost, setBassBoost] = useState(3); // dB
  const [trebleBoost, setTrebleBoost] = useState(2); // dB
  const [reverbAmount, setReverbAmount] = useState(0.15); // 0 to 0.7

  // Generation state
  const [isGenerating, setIsGenerating] = useState(false);
  const [isEnhancingText, setIsEnhancingText] = useState(false);
  const [generatedAudioBase64, setGeneratedAudioBase64] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copiedSuccess, setCopiedSuccess] = useState(false);

  // Playback state
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [totalDuration, setTotalDuration] = useState(0);
  const audioEngineRef = useRef<StudioAudioEngine | null>(null);
  const playProgressInterval = useRef<number | null>(null);

  // Initialize audio engine
  useEffect(() => {
    audioEngineRef.current = new StudioAudioEngine();
    return () => {
      if (audioEngineRef.current) {
        audioEngineRef.current.stop();
      }
      if (playProgressInterval.current) {
        clearInterval(playProgressInterval.current);
      }
    };
  }, []);

  // Update DSP parameters dynamically during playback
  useEffect(() => {
    if (audioEngineRef.current) {
      const effects: StudioDspEffects = {
        bassBoostDb: bassBoost,
        trebleClarityDb: trebleBoost,
        reverbAmount: reverbAmount,
        playbackSpeed: playbackSpeed,
      };
      audioEngineRef.current.applyEffects(effects);
    }
  }, [bassBoost, trebleBoost, reverbAmount, playbackSpeed]);

  // Handle Speech Generation
  const handleGenerate = async () => {
    if (!inputText.trim()) {
      setErrorMessage('يرجى كتابة نص لتوليد الصوت المستنسخ');
      return;
    }

    try {
      setErrorMessage(null);
      setIsGenerating(true);
      if (audioEngineRef.current) {
        audioEngineRef.current.stop();
      }
      setIsPlaying(false);

      const res = await fetch('/api/voice/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: inputText.trim(),
          baseVoice: activeVoice.baseVoice,
          styleDirective: activeVoice.stylePrompt,
          emotion: selectedEmotion,
          speed: playbackSpeed,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || 'فشل توليد الصوت المستنسخ');
      }

      const data = await res.json();
      if (!data.audioBase64) {
        throw new Error('لم يتم استلام بيانات صوتية');
      }

      setGeneratedAudioBase64(data.audioBase64);

      // Load into audio engine
      if (audioEngineRef.current) {
        const buffer = await audioEngineRef.current.loadFromBase64(data.audioBase64);
        setTotalDuration(buffer.duration);
        setCurrentTime(0);

        // Auto-play the synthesized speech
        const effects: StudioDspEffects = {
          bassBoostDb: bassBoost,
          trebleClarityDb: trebleBoost,
          reverbAmount: reverbAmount,
          playbackSpeed: playbackSpeed,
        };

        audioEngineRef.current.play(effects, () => {
          setIsPlaying(false);
          setCurrentTime(0);
        });
        setIsPlaying(true);
        startProgressTracking();
      }

      // Add to history
      onAddToHistory({
        id: `gen-${Date.now()}`,
        voiceProfileId: activeVoice.id,
        voiceName: activeVoice.name,
        text: inputText.trim(),
        audioBase64: data.audioBase64,
        mimeType: 'audio/wav',
        emotion: selectedEmotion,
        createdAt: new Date().toISOString(),
        durationSeconds: totalDuration || 10,
      });
    } catch (err: any) {
      console.error('Speech generation error:', err);
      setErrorMessage(err.message || 'حدث خطأ أثناء توليد الصوت');
    } finally {
      setIsGenerating(false);
    }
  };

  const startProgressTracking = () => {
    if (playProgressInterval.current) clearInterval(playProgressInterval.current);
    playProgressInterval.current = window.setInterval(() => {
      if (audioEngineRef.current) {
        setCurrentTime(audioEngineRef.current.getCurrentTime());
        if (!audioEngineRef.current.isAudioPlaying()) {
          setIsPlaying(false);
        }
      }
    }, 100);
  };

  const togglePlay = () => {
    if (!audioEngineRef.current || !generatedAudioBase64) return;
    if (isPlaying) {
      audioEngineRef.current.pause();
      setIsPlaying(false);
    } else {
      const effects: StudioDspEffects = {
        bassBoostDb: bassBoost,
        trebleClarityDb: trebleBoost,
        reverbAmount: reverbAmount,
        playbackSpeed: playbackSpeed,
      };
      audioEngineRef.current.play(effects, () => {
        setIsPlaying(false);
        setCurrentTime(0);
      });
      setIsPlaying(true);
      startProgressTracking();
    }
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!audioEngineRef.current || !totalDuration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const ratio = clickX / rect.width;
    const effects: StudioDspEffects = {
      bassBoostDb: bassBoost,
      trebleClarityDb: trebleBoost,
      reverbAmount: reverbAmount,
      playbackSpeed: playbackSpeed,
    };
    audioEngineRef.current.seek(ratio, effects);
    setCurrentTime(ratio * totalDuration);
  };

  // AI Text Enhancement (Diacritics or Dramatic pauses)
  const handleEnhanceText = async (mode: 'tashkeel' | 'broadcast') => {
    if (!inputText.trim()) return;
    try {
      setIsEnhancingText(true);
      const res = await fetch('/api/voice/enhance-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: inputText, mode }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.enhancedText) {
          setInputText(data.enhancedText);
        }
      }
    } catch (err) {
      console.error('Enhance text error:', err);
    } finally {
      setIsEnhancingText(false);
    }
  };

  const handleDownload = () => {
    if (!generatedAudioBase64) return;
    const safeName = activeVoice.name.replace(/[^a-zA-Z0-9\u0600-\u06FF]/g, '_');
    downloadWavFile(generatedAudioBase64, `${safeName}_cloned_voice.wav`);
  };

  const handleCopyText = () => {
    navigator.clipboard.writeText(inputText);
    setCopiedSuccess(true);
    setTimeout(() => setCopiedSuccess(false), 2000);
  };

  // Calculations for script
  const wordCount = inputText.trim() ? inputText.trim().split(/\s+/).length : 0;
  const estimatedSeconds = Math.max(1, Math.round((wordCount / 130) * 60));

  const emotionsList = [
    { id: 'natural', label: 'طبيعي ومتزن', icon: '🎙️' },
    { id: 'excited', label: 'حماسي وملهم', icon: '🔥' },
    { id: 'calm', label: 'هادئ ومريح', icon: '🍃' },
    { id: 'serious', label: 'رسمي وإذاعي', icon: '🏛️' },
    { id: 'dramatic', label: 'درامي سينمائي', icon: '🎭' },
    { id: 'cheerful', label: 'مرح وودود', icon: '✨' },
    { id: 'whisper', label: 'همس لطيف', icon: '🤫' },
  ];

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      {/* Active Voice Badge & Switcher */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <span className="text-3xl p-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/20">
            {activeVoice.avatar}
          </span>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 font-medium">
                الصوت النشط
              </span>
              <span className="text-xs text-slate-400">{activeVoice.detectedPitch}</span>
            </div>
            <h3 className="text-lg font-bold text-white mt-0.5">{activeVoice.name}</h3>
            <p className="text-xs text-slate-400 line-clamp-1">{activeVoice.summaryArabic}</p>
          </div>
        </div>

        {/* Voice Selector dropdown */}
        <div className="flex items-center gap-2 w-full md:w-auto">
          <select
            value={activeVoice.id}
            onChange={(e) => {
              const found = voices.find((v) => v.id === e.target.value);
              if (found) onSelectVoice(found);
            }}
            className="flex-1 md:w-64 px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-cyan-500 cursor-pointer"
          >
            {voices.map((v) => (
              <option key={v.id} value={v.id}>
                {v.avatar} {v.name}
              </option>
            ))}
          </select>
          <button
            onClick={onNavigateToClone}
            className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-slate-700 text-xs font-medium whitespace-nowrap cursor-pointer transition"
          >
            + استنساخ جديد
          </button>
        </div>
      </div>

      {errorMessage && (
        <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-800/60 text-rose-300 text-sm">
          {errorMessage}
        </div>
      )}

      {/* Main Studio Workstation: Text & DSP Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Script Editor & Synthesis */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-slate-900/70 border border-slate-800/90 rounded-2xl p-5 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-sm font-bold text-white flex items-center gap-2">
                <FileText className="w-4 h-4 text-cyan-400" />
                <span>نص القراءة والاستنساخ</span>
              </label>

              {/* Sample Texts Quick Pill Selector */}
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] text-slate-500 hidden sm:inline">نصوص نموذجية:</span>
                <select
                  onChange={(e) => {
                    const st = SAMPLE_TEXTS.find((s) => s.title === e.target.value);
                    if (st) setInputText(st.text);
                  }}
                  className="bg-slate-950 border border-slate-800 rounded-lg text-[11px] px-2 py-1 text-slate-300 focus:outline-none focus:border-cyan-500 cursor-pointer"
                >
                  {SAMPLE_TEXTS.map((st) => (
                    <option key={st.title} value={st.title}>
                      {st.title}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Textarea */}
            <div className="relative">
              <textarea
                rows={6}
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="اكتب هنا النص المراد قراءته بالصوت المستنسخ (يدعم العربية الفصحى، اللهجات، والإنجليزية)..."
                className="w-full p-4 bg-slate-950/90 border border-slate-800 rounded-xl text-slate-100 text-sm leading-relaxed focus:outline-none focus:border-cyan-500 resize-none font-serif"
                dir="auto"
              />

              <div className="absolute bottom-3 left-3 flex items-center gap-2 text-xs text-slate-500">
                <button
                  type="button"
                  onClick={handleCopyText}
                  className="p-1 hover:text-cyan-400 transition"
                  title="نسخ النص"
                >
                  {copiedSuccess ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            {/* Script stats & AI Enhancement buttons */}
            <div className="flex flex-wrap items-center justify-between gap-3 text-xs pt-1 border-t border-slate-800/80">
              <div className="flex items-center gap-3 text-slate-400">
                <span>الكلمات: <b className="text-slate-200">{wordCount}</b></span>
                <span>الحروف: <b className="text-slate-200">{inputText.length}</b></span>
                <span>المدة التقديرية: <b className="text-cyan-400">~{estimatedSeconds} ثانية</b></span>
              </div>

              {/* AI Enhancements */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleEnhanceText('tashkeel')}
                  disabled={isEnhancingText || !inputText.trim()}
                  className="px-2.5 py-1 rounded-lg bg-cyan-950/40 hover:bg-cyan-900/50 border border-cyan-500/30 text-cyan-300 font-medium flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>{isEnhancingText ? 'جاري التشكيل...' : 'تشكيل دقيق (حركات)'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleEnhanceText('broadcast')}
                  disabled={isEnhancingText || !inputText.trim()}
                  className="px-2.5 py-1 rounded-lg bg-violet-950/40 hover:bg-violet-900/50 border border-violet-500/30 text-violet-300 font-medium flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
                >
                  <Zap className="w-3.5 h-3.5" />
                  <span>تنسيق إذاعي ووقفات</span>
                </button>
              </div>
            </div>

            {/* Emotion / Delivery Chips */}
            <div>
              <span className="text-xs font-medium text-slate-400 block mb-2">
                نبرة الأداء والمشاعر المستهدفة:
              </span>
              <div className="flex flex-wrap gap-2">
                {emotionsList.map((emo) => (
                  <button
                    key={emo.id}
                    type="button"
                    onClick={() => setSelectedEmotion(emo.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer ${
                      selectedEmotion === emo.id
                        ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-md shadow-cyan-500/20'
                        : 'bg-slate-950 border border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                    }`}
                  >
                    <span>{emo.icon}</span>
                    <span>{emo.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Big Action Button */}
            <button
              onClick={handleGenerate}
              disabled={isGenerating || !inputText.trim()}
              className={`w-full py-4 rounded-xl font-bold text-base flex items-center justify-center gap-2.5 shadow-xl transition-all ${
                isGenerating || !inputText.trim()
                  ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                  : 'bg-gradient-to-r from-cyan-500 via-blue-600 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white shadow-cyan-500/25 active:scale-98 cursor-pointer'
              }`}
            >
              {isGenerating ? (
                <>
                  <RefreshCw className="w-5 h-5 animate-spin text-cyan-300" />
                  <span>جاري توليد الكلام بالصوت المستنسخ...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5 text-cyan-300" />
                  <span>توليد الكلام بصوت {activeVoice.name.split(' ')[0]}</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Right Col: Studio DSP & Acoustic Controls */}
        <div className="space-y-4">
          <div className="bg-slate-900/70 border border-slate-800/90 rounded-2xl p-5 shadow-xl space-y-5">
            <h4 className="text-sm font-bold text-white flex items-center gap-2">
              <Sliders className="w-4 h-4 text-cyan-400" />
              <span>ميكسر الاستوديو والتعديل الصوتي</span>
            </h4>

            {/* Playback Speed Slider */}
            <div>
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="text-slate-300 font-medium">سرعة النطق (Tempo)</span>
                <span className="font-mono text-cyan-300 font-bold">{playbackSpeed}x</span>
              </div>
              <input
                type="range"
                min="0.75"
                max="1.4"
                step="0.05"
                value={playbackSpeed}
                onChange={(e) => setPlaybackSpeed(parseFloat(e.target.value))}
                className="w-full accent-cyan-400 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-slate-500 mt-0.5">
                <span>0.75x (هادئ متأنٍ)</span>
                <span>1.0x (طبيعي)</span>
                <span>1.4x (سريع)</span>
              </div>
            </div>

            {/* Bass Warmth Boost */}
            <div>
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="text-slate-300 font-medium">دفء ورنين القرار (Bass Boost)</span>
                <span className="font-mono text-amber-300 font-bold">+{bassBoost} dB</span>
              </div>
              <input
                type="range"
                min="0"
                max="10"
                step="1"
                value={bassBoost}
                onChange={(e) => setBassBoost(parseInt(e.target.value, 10))}
                className="w-full accent-amber-400 cursor-pointer"
              />
              <span className="text-[10px] text-slate-500 block">
                يعزز رنين الصدر العميق ويضفي فخامة إذاعية على الصوت
              </span>
            </div>

            {/* Treble Studio Clarity */}
            <div>
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="text-slate-300 font-medium">نقاء وحضور الاستوديو (Treble)</span>
                <span className="font-mono text-cyan-300 font-bold">+{trebleBoost} dB</span>
              </div>
              <input
                type="range"
                min="0"
                max="8"
                step="1"
                value={trebleBoost}
                onChange={(e) => setTrebleBoost(parseInt(e.target.value, 10))}
                className="w-full accent-cyan-400 cursor-pointer"
              />
              <span className="text-[10px] text-slate-500 block">
                يبرز مخارج الحروف ويضفي نقاءً بلورياً شفافاً
              </span>
            </div>

            {/* Reverb */}
            <div>
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="text-slate-300 font-medium">صدى الغرفة / الاستوديو (Reverb)</span>
                <span className="font-mono text-violet-300 font-bold">{Math.round(reverbAmount * 100)}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="0.6"
                step="0.05"
                value={reverbAmount}
                onChange={(e) => setReverbAmount(parseFloat(e.target.value))}
                className="w-full accent-violet-400 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-slate-500 mt-0.5">
                <span>جاف (Dry)</span>
                <span>استوديو إذاعي</span>
                <span>قاعة سينمائية</span>
              </div>
            </div>

            {/* Reset Defaults */}
            <button
              type="button"
              onClick={() => {
                setPlaybackSpeed(1.0);
                setBassBoost(3);
                setTrebleBoost(2);
                setReverbAmount(0.15);
              }}
              className="w-full py-2 rounded-lg bg-slate-950 border border-slate-800 hover:bg-slate-800 text-slate-400 hover:text-slate-200 text-xs flex items-center justify-center gap-1.5 transition cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>إعادة ضبط الميكسر الافتراضي</span>
            </button>
          </div>
        </div>
      </div>

      {/* Generated Audio Player & Waveform Visualizer */}
      {generatedAudioBase64 && (
        <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 border border-cyan-500/40 rounded-2xl p-6 shadow-2xl space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 flex items-center justify-center">
                <Volume2 className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-white text-base">المقطع الصوتي المستنسخ جاهز</h4>
                <p className="text-xs text-slate-400">تم التوليد بنموذج Gemini 3.8 Flash TTS بجودة استوديو (24kHz Mono WAV)</p>
              </div>
            </div>

            <button
              onClick={handleDownload}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-2 shadow-lg shadow-emerald-600/20 transition cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>تحميل بصيغة WAV</span>
            </button>
          </div>

          {/* Interactive Waveform Visualizer */}
          <AudioWaveVisualizer
            analyser={audioEngineRef.current?.getAnalyser()}
            isPlaying={isPlaying}
            height={85}
            barCount={56}
          />

          {/* Scrubber Bar */}
          <div
            onClick={handleSeek}
            className="h-2 w-full bg-slate-800/80 hover:bg-slate-700/80 rounded-full overflow-hidden cursor-pointer relative group"
          >
            <div
              className="h-full bg-gradient-to-r from-cyan-400 to-blue-500 rounded-full transition-all duration-100"
              style={{
                width: totalDuration > 0 ? `${(currentTime / totalDuration) * 100}%` : '0%',
              }}
            />
          </div>

          {/* Playback Controls Bar */}
          <div className="flex items-center justify-between pt-1 text-xs">
            <div className="flex items-center gap-3">
              <button
                onClick={togglePlay}
                className="w-11 h-11 rounded-full bg-cyan-500 hover:bg-cyan-400 text-slate-950 flex items-center justify-center font-bold shadow-lg shadow-cyan-500/30 transition-transform active:scale-95 cursor-pointer"
              >
                {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current translate-x-[-1px]" />}
              </button>

              <button
                onClick={() => {
                  if (audioEngineRef.current) {
                    audioEngineRef.current.seek(0);
                    setCurrentTime(0);
                  }
                }}
                className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
                title="إعادة من البداية"
              >
                <RotateCcw className="w-4 h-4" />
              </button>

              <div className="font-mono text-slate-300">
                <span className="text-cyan-300 font-bold">{currentTime.toFixed(1)}s</span>
                <span className="text-slate-600 mx-1">/</span>
                <span>{totalDuration.toFixed(1)}s</span>
              </div>
            </div>

            <div className="flex items-center gap-2 text-slate-400">
              <Activity className="w-4 h-4 text-cyan-400 animate-pulse" />
              <span>معدل العينات: 24,000 Hz</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
