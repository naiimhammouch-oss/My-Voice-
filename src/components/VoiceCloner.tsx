import React, { useState, useRef, useEffect } from 'react';
import { Mic, Square, Play, Pause, Upload, Sparkles, CheckCircle2, AlertCircle, RefreshCw, Volume2, ShieldCheck, Zap } from 'lucide-react';
import { VoiceProfile } from '../types/voice';
import { PRESET_VOICES } from '../data/presetVoices';
import { blobToBase64 } from '../utils/audioUtils';
import { AudioWaveVisualizer } from './AudioWaveVisualizer';
import { AcousticRadar } from './AcousticRadar';

interface VoiceClonerProps {
  onVoiceCloned: (profile: VoiceProfile) => void;
  onNavigateToStudio: (profile: VoiceProfile) => void;
}

export const VoiceCloner: React.FC<VoiceClonerProps> = ({ onVoiceCloned, onNavigateToStudio }) => {
  const [activeTab, setActiveTab] = useState<'record' | 'upload' | 'preset'>('record');
  
  // Recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordDuration, setRecordDuration] = useState(0);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [recordedUrl, setRecordedUrl] = useState<string | null>(null);
  const [isPlayingPreview, setIsPlayingPreview] = useState(false);

  // Upload state
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [uploadedBase64, setUploadedBase64] = useState<string | null>(null);

  // Profile metadata inputs
  const [speakerName, setSpeakerName] = useState('صوتي المستنسخ الجديد');
  const [gender, setGender] = useState<'male' | 'female' | 'neutral'>('male');
  const [category, setCategory] = useState<'documentary' | 'broadcast' | 'storytelling' | 'commercial' | 'custom'>('custom');

  // Analysis state
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisStep, setAnalysisStep] = useState(0);
  const [analysisResult, setAnalysisResult] = useState<VoiceProfile | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Refs for recording
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerIntervalRef = useRef<number | null>(null);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Clean up timer and media streams on unmount
  useEffect(() => {
    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
    };
  }, []);

  const sampleReadingText = '«في عالمِ التكنولوجيا المعاصرة، يُصبحُ الصوتُ البشريُّ بصمةً رقميةً فريدة تعبّرُ عن مشاعرِنا وأفكارِنا بدقّةٍ متناهية، ونحنُ نبتكرُ مستقبلاً رقمياً واعداً.»';

  // Start Mic Recording
  const startRecording = async () => {
    try {
      setErrorMessage(null);
      setRecordedBlob(null);
      setRecordedUrl(null);
      setRecordDuration(0);
      audioChunksRef.current = [];

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 24000,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });

      const mimeType = MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : MediaRecorder.isTypeSupported('audio/mp4')
        ? 'audio/mp4'
        : 'audio/wav';

      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const fullBlob = new Blob(audioChunksRef.current, { type: mimeType });
        setRecordedBlob(fullBlob);
        setRecordedUrl(URL.createObjectURL(fullBlob));
        // Stop stream tracks
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start(200);
      setIsRecording(true);

      timerIntervalRef.current = window.setInterval(() => {
        setRecordDuration((prev) => {
          if (prev >= 40) {
            stopRecording();
            return 40;
          }
          return prev + 1;
        });
      }, 1000);
    } catch (err: any) {
      console.error('Mic access error:', err);
      setErrorMessage('تعذر الوصول إلى الميكروفون. يرجى التأكد من منح الإذن في المتصفح أو تجربة رفع ملف صوتي.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
    }
    setIsRecording(false);
  };

  const togglePreview = () => {
    if (!previewAudioRef.current && recordedUrl) {
      previewAudioRef.current = new Audio(recordedUrl);
      previewAudioRef.current.onended = () => setIsPlayingPreview(false);
    }

    if (previewAudioRef.current) {
      if (isPlayingPreview) {
        previewAudioRef.current.pause();
        setIsPlayingPreview(false);
      } else {
        previewAudioRef.current.play();
        setIsPlayingPreview(true);
      }
    }
  };

  // Handle File Upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.includes('audio') && !file.name.match(/\.(mp3|wav|m4a|ogg|webm|aac)$/i)) {
      setErrorMessage('يرجى رفع ملف صوتي صالح بصيغة MP3, WAV, M4A, أو WebM');
      return;
    }

    setUploadedFile(file);
    const base64 = await blobToBase64(file);
    setUploadedBase64(base64);
    setRecordedUrl(URL.createObjectURL(file));
    setErrorMessage(null);
  };

  // Perform Acoustic Analysis & Voice Cloning
  const handleStartCloning = async () => {
    setErrorMessage(null);
    setIsAnalyzing(true);
    setAnalysisStep(1);

    try {
      let audioBase64 = '';
      let mime = 'audio/webm';

      if (activeTab === 'record' && recordedBlob) {
        audioBase64 = await blobToBase64(recordedBlob);
        mime = recordedBlob.type || 'audio/webm';
      } else if (activeTab === 'upload' && uploadedBase64) {
        audioBase64 = uploadedBase64;
        mime = uploadedFile?.type || 'audio/mp3';
      } else {
        throw new Error('يرجى تسجيل عينة صوتية أو رفع ملف أولاً');
      }

      // Step animations
      setTimeout(() => setAnalysisStep(2), 1200);
      setTimeout(() => setAnalysisStep(3), 2400);

      const res = await fetch('/api/voice/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          audioBase64,
          mimeType: mime,
          speakerName,
          gender,
        }),
      });

      if (!res.ok) {
        throw new Error('فشل تحليل العينة الصوتية من الخادم');
      }

      const data = await res.json();
      setAnalysisStep(4);

      const analysis = data.analysis;
      const newProfile: VoiceProfile = {
        id: `voice-${Date.now()}`,
        name: speakerName.trim() || 'صوتي المستنسخ',
        avatar: gender === 'female' ? '👩‍💼' : '🎙️',
        description: analysis.summaryArabic || 'بصمة صوتية مستنسخة بالذكاء الاصطناعي',
        category,
        gender,
        baseVoice: analysis.recommendedBaseVoice,
        stylePrompt: analysis.stylePrompt,
        detectedPitch: analysis.detectedPitch,
        detectedTimbre: analysis.detectedTimbre,
        detectedCadence: analysis.detectedCadence,
        detectedDialect: analysis.detectedDialect,
        detectedEmotion: analysis.detectedEmotion,
        acousticMetrics: analysis.acousticMetrics,
        summaryArabic: analysis.summaryArabic,
        createdAt: new Date().toISOString(),
        isPreset: false,
        sampleAudioBase64: audioBase64.slice(0, 3000), // snippet for reference
      };

      setAnalysisResult(newProfile);
      onVoiceCloned(newProfile);
    } catch (err: any) {
      console.error('Cloning error:', err);
      setErrorMessage(err.message || 'حدث خطأ أثناء استنساخ الصوت، يرجى المحاولة مرة أخرى.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Instant clone from preset template
  const handleSelectPreset = (preset: VoiceProfile) => {
    const cloned: VoiceProfile = {
      ...preset,
      id: `clone-${Date.now()}`,
      name: `${preset.name} (نسخة مخصصة)`,
      isPreset: false,
      createdAt: new Date().toISOString(),
    };
    setAnalysisResult(cloned);
    onVoiceCloned(cloned);
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      {/* Header section */}
      <div className="bg-gradient-to-r from-slate-900/90 via-slate-900/70 to-slate-950 p-6 rounded-2xl border border-slate-800/80 shadow-2xl relative overflow-hidden">
        <div className="absolute -right-16 -top-16 w-64 h-64 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-xs font-medium mb-2">
              <Sparkles className="w-3.5 h-3.5 animate-spin" />
              محرك الاستنساخ الصوتي العصبي (Neural Voice Cloning)
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              استنساخ بصمة صوتية جديدة
            </h2>
            <p className="text-slate-400 text-sm mt-1 max-w-2xl leading-relaxed">
              سجّل نبرة صوتك أو ارفع عينة صوتية (5 إلى 20 ثانية)، وسيقوم الذكاء الاصطناعي بتحليل الرنين والترددات والإيقاع وتوليد نموذج صوتي مخصص يتحدث بأي نص تختاره.
            </p>
          </div>

          <div className="flex items-center gap-2 bg-slate-800/70 border border-slate-700/60 p-2 rounded-xl text-xs text-slate-300">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>معالجة عصبية آمنة وعالية الدقة</span>
          </div>
        </div>
      </div>

      {errorMessage && (
        <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-800/60 text-rose-300 text-sm flex items-center gap-3">
          <AlertCircle className="w-5 h-5 flex-shrink-0 text-rose-400" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Input Methods Tabs */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center gap-2 p-1.5 bg-slate-900/90 border border-slate-800 rounded-xl">
            <button
              onClick={() => setActiveTab('record')}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg font-medium text-sm transition-all ${
                activeTab === 'record'
                  ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-lg shadow-cyan-500/20'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <Mic className="w-4 h-4" />
              <span>تسجيل مباشر بالميكروفون</span>
            </button>
            <button
              onClick={() => setActiveTab('upload')}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg font-medium text-sm transition-all ${
                activeTab === 'upload'
                  ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-lg shadow-cyan-500/20'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <Upload className="w-4 h-4" />
              <span>رفع ملف صوتي</span>
            </button>
            <button
              onClick={() => setActiveTab('preset')}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg font-medium text-sm transition-all ${
                activeTab === 'preset'
                  ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-lg shadow-cyan-500/20'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <Zap className="w-4 h-4" />
              <span>أصوات جاهزة للاختبار</span>
            </button>
          </div>

          {/* TAB 1: Live Recording */}
          {activeTab === 'record' && (
            <div className="bg-slate-900/70 border border-slate-800/90 rounded-2xl p-6 space-y-6 shadow-xl">
              <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-4">
                <span className="text-xs font-semibold text-cyan-400 block mb-1">
                  نص مقترح للقراءة أثناء التسجيل (لأفضل دقة بصمة صوتية):
                </span>
                <p className="text-slate-200 text-sm leading-relaxed font-serif italic bg-slate-900/70 p-3 rounded-lg border border-slate-800">
                  {sampleReadingText}
                </p>
              </div>

              {/* Waveform Visualizer */}
              <AudioWaveVisualizer isRecording={isRecording} isPlaying={isPlayingPreview} height={90} barCount={52} />

              {/* Controls */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
                <div className="flex items-center gap-3">
                  {!isRecording ? (
                    <button
                      onClick={startRecording}
                      className="px-6 py-3 rounded-xl bg-gradient-to-r from-rose-500 to-red-600 hover:from-rose-600 hover:to-red-700 text-white font-semibold flex items-center gap-2.5 shadow-lg shadow-rose-500/25 transition-transform active:scale-95 cursor-pointer"
                    >
                      <Mic className="w-5 h-5 animate-pulse" />
                      <span>بدء التسجيل</span>
                    </button>
                  ) : (
                    <button
                      onClick={stopRecording}
                      className="px-6 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold flex items-center gap-2.5 border border-rose-500/50 recording-pulse transition-transform active:scale-95 cursor-pointer"
                    >
                      <Square className="w-5 h-5 text-rose-400" />
                      <span>إيقاف التسجيل ({recordDuration} ثانية)</span>
                    </button>
                  )}

                  {recordedUrl && !isRecording && (
                    <button
                      onClick={togglePreview}
                      className="px-4 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-slate-700 flex items-center gap-2 font-medium transition cursor-pointer"
                    >
                      {isPlayingPreview ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                      <span>{isPlayingPreview ? 'إيقاف الاستماع' : 'الاستماع للعينة'}</span>
                    </button>
                  )}
                </div>

                <div className="text-xs text-slate-400 flex items-center gap-2">
                  <div className={`w-2.5 h-2.5 rounded-full ${isRecording ? 'bg-rose-500 animate-ping' : recordedBlob ? 'bg-emerald-500' : 'bg-slate-600'}`} />
                  <span>
                    {isRecording
                      ? `جاري التسجيل: ${recordDuration} ثانية (يُفضل 10 ثوانٍ على الأقل)`
                      : recordedBlob
                      ? 'تم تسجيل العينة بنجاح، يمكنك الآن استنساخ البصمة'
                      : 'جاهز للتسجيل'}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: Upload File */}
          {activeTab === 'upload' && (
            <div className="bg-slate-900/70 border border-slate-800/90 rounded-2xl p-6 space-y-6 shadow-xl">
              <input
                ref={fileInputRef}
                type="file"
                accept="audio/*,.mp3,.wav,.m4a,.ogg,.webm"
                className="hidden"
                onChange={handleFileUpload}
              />

              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-700 hover:border-cyan-500/60 rounded-2xl p-8 text-center cursor-pointer transition-all bg-slate-950/40 hover:bg-slate-950/70 group"
              >
                <div className="w-16 h-16 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
                  <Upload className="w-8 h-8" />
                </div>
                <h4 className="text-base font-semibold text-white mb-1">
                  اسحب وأفلت الملف الصوتي هنا أو انقر للاختيار
                </h4>
                <p className="text-slate-400 text-xs max-w-sm mx-auto">
                  يدعم صيغ MP3, WAV, M4A, OGG, WebM. يُفضل ملف نقي خالٍ من الموسيقى الخلفية وبمدة تتراوح بين 5 إلى 30 ثانية.
                </p>

                {uploadedFile && (
                  <div className="mt-4 inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-medium">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>تم تحديد: {uploadedFile.name} ({(uploadedFile.size / (1024 * 1024)).toFixed(2)} ميغابايت)</span>
                  </div>
                )}
              </div>

              {uploadedBase64 && (
                <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950/60 border border-slate-800">
                  <div className="flex items-center gap-3">
                    <Volume2 className="w-5 h-5 text-cyan-400" />
                    <span className="text-xs text-slate-300 font-medium">العينة جاهزة للتحليل والاستنساخ</span>
                  </div>
                  <button
                    onClick={() => {
                      if (recordedUrl) {
                        const a = new Audio(recordedUrl);
                        a.play();
                      }
                    }}
                    className="text-xs text-cyan-400 hover:text-cyan-300 font-medium px-3 py-1 rounded bg-slate-800 hover:bg-slate-700 cursor-pointer"
                  >
                    تشغيل تجريبي
                  </button>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: Preset Archetypes */}
          {activeTab === 'preset' && (
            <div className="bg-slate-900/70 border border-slate-800/90 rounded-2xl p-6 space-y-4 shadow-xl">
              <span className="text-xs text-slate-400 block mb-2">
                اختر نبرة صوتية جاهزة من الاستوديو لإنشاء نسخة مستنسخة فورية بضغطة زر:
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {PRESET_VOICES.map((preset) => (
                  <div
                    key={preset.id}
                    onClick={() => handleSelectPreset(preset)}
                    className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 hover:border-cyan-500/50 hover:bg-slate-900 transition-all cursor-pointer group"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2.5">
                        <span className="text-2xl p-2 rounded-lg bg-slate-800/80 group-hover:scale-110 transition-transform">
                          {preset.avatar}
                        </span>
                        <div>
                          <h4 className="font-bold text-sm text-white group-hover:text-cyan-300 transition-colors">
                            {preset.name}
                          </h4>
                          <span className="text-[11px] text-cyan-400 font-mono">
                            {preset.detectedPitch}
                          </span>
                        </div>
                      </div>
                    </div>
                    <p className="text-xs text-slate-400 mt-2.5 line-clamp-2 leading-relaxed">
                      {preset.description}
                    </p>
                    <div className="mt-3 flex items-center justify-between text-[11px] pt-2 border-t border-slate-800/60">
                      <span className="text-slate-500">النمط: {preset.category}</span>
                      <span className="text-cyan-400 font-medium group-hover:translate-x-[-4px] transition-transform flex items-center gap-1">
                        استنساخ واختبار ←
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Profile Settings & Clone Action Column */}
        <div className="space-y-6">
          <div className="bg-slate-900/70 border border-slate-800/90 rounded-2xl p-6 space-y-4 shadow-xl">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-cyan-400" />
              <span>إعدادات الملف الصوتي</span>
            </h3>

            <div>
              <label className="text-xs font-medium text-slate-300 block mb-1.5">
                اسم الصوت المستنسخ
              </label>
              <input
                type="text"
                value={speakerName}
                onChange={(e) => setSpeakerName(e.target.value)}
                placeholder="مثال: صوتي الإذاعي، نبرة الراوي..."
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-200 focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-slate-300 block mb-1.5">
                النوع / الفئة
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setGender('male')}
                  className={`py-2 px-3 rounded-lg text-xs font-medium border transition ${
                    gender === 'male'
                      ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-300'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  صوت رجالي
                </button>
                <button
                  type="button"
                  onClick={() => setGender('female')}
                  className={`py-2 px-3 rounded-lg text-xs font-medium border transition ${
                    gender === 'female'
                      ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-300'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  صوت نسائي
                </button>
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-slate-300 block mb-1.5">
                مجال الاستخدام المستهدف
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as any)}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-cyan-500 cursor-pointer"
              >
                <option value="custom">استخدام مخصص عام</option>
                <option value="documentary">أفلام وثائقية وسرد عميق</option>
                <option value="broadcast">نشرات إخبارية وبودكاست</option>
                <option value="storytelling">روايات وكتب صوتية</option>
                <option value="commercial">إعلانات تجارية وعروض</option>
              </select>
            </div>

            {/* Action Button */}
            {activeTab !== 'preset' && (
              <button
                onClick={handleStartCloning}
                disabled={isAnalyzing || (!recordedBlob && !uploadedBase64)}
                className={`w-full py-3.5 px-4 rounded-xl font-bold text-sm flex items-center justify-center gap-2 shadow-xl transition-all ${
                  isAnalyzing || (!recordedBlob && !uploadedBase64)
                    ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                    : 'bg-gradient-to-r from-cyan-500 via-blue-600 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white shadow-cyan-500/25 active:scale-98 cursor-pointer'
                }`}
              >
                {isAnalyzing ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin text-cyan-300" />
                    <span>جاري تحليل واستنساخ البصمة...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 text-cyan-300" />
                    <span>تحليل واستنساخ الصوت الآن</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Analysis Stages Animation Card (When Analyzing) */}
      {isAnalyzing && (
        <div className="bg-slate-900/90 border border-cyan-500/40 rounded-2xl p-6 shadow-2xl space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center">
              <RefreshCw className="w-4 h-4 text-cyan-400 animate-spin" />
            </div>
            <div>
              <h4 className="font-bold text-white text-sm">محرك التحليل الصوتي يعمل الآن...</h4>
              <p className="text-xs text-slate-400">نستخرج أكثر من 12 بُعدًا صوتيًا لتشكيل الترددات الأساسية ومطابقتها</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 pt-2">
            {[
              { num: 1, title: 'عزل الضوضاء والإشارة' },
              { num: 2, title: 'قياس تردد الرنين والطبقة' },
              { num: 3, title: 'تحليل الإيقاع ومخارج الحروف' },
              { num: 4, title: 'بناء البصمة العصبية' },
            ].map((st) => (
              <div
                key={st.num}
                className={`p-3 rounded-xl border text-xs transition-all ${
                  analysisStep >= st.num
                    ? 'bg-cyan-950/40 border-cyan-500/50 text-cyan-300'
                    : 'bg-slate-950/50 border-slate-800 text-slate-500'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold ${
                    analysisStep >= st.num ? 'bg-cyan-500 text-slate-950' : 'bg-slate-800 text-slate-400'
                  }`}>
                    {st.num}
                  </span>
                  <span className="font-semibold">{st.title}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Analysis Result & Voiceprint Overview */}
      {analysisResult && (
        <div className="bg-gradient-to-b from-slate-900 to-slate-950 border border-cyan-500/30 rounded-2xl p-6 sm:p-8 space-y-6 shadow-2xl">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
            <div className="flex items-center gap-3">
              <span className="text-3xl p-3 rounded-2xl bg-cyan-500/10 border border-cyan-500/20">
                {analysisResult.avatar}
              </span>
              <div>
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold mb-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  تم استنساخ البصمة بنجاح
                </div>
                <h3 className="text-xl font-bold text-white">{analysisResult.name}</h3>
                <p className="text-xs text-slate-400 mt-0.5">{analysisResult.summaryArabic}</p>
              </div>
            </div>

            <button
              onClick={() => onNavigateToStudio(analysisResult)}
              className="px-6 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold text-sm shadow-lg shadow-cyan-500/25 flex items-center gap-2 transition-transform active:scale-95 cursor-pointer"
            >
              <Sparkles className="w-4 h-4" />
              <span>توليد كلام بهذا الصوت الآن</span>
            </button>
          </div>

          {/* Radar & Metrics */}
          <div>
            <h4 className="text-xs font-semibold text-cyan-400 mb-3 uppercase tracking-wider">
              أبعاد البصمة الصوتية المحللة (Acoustic Voiceprint):
            </h4>
            <AcousticRadar
              metrics={analysisResult.acousticMetrics}
              pitchLabel={analysisResult.detectedPitch}
              timbreLabel={analysisResult.detectedTimbre}
              cadenceLabel={analysisResult.detectedCadence}
              dialectLabel={analysisResult.detectedDialect}
              emotionLabel={analysisResult.detectedEmotion}
            />
          </div>
        </div>
      )}
    </div>
  );
};
