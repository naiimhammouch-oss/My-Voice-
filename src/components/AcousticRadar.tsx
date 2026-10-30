import React from 'react';
import { AcousticMetrics } from '../types/voice';
import { Activity, Flame, Radio, Zap, Clock, Wind } from 'lucide-react';

interface AcousticRadarProps {
  metrics: AcousticMetrics;
  pitchLabel?: string;
  timbreLabel?: string;
  cadenceLabel?: string;
  dialectLabel?: string;
  emotionLabel?: string;
}

export const AcousticRadar: React.FC<AcousticRadarProps> = ({
  metrics,
  pitchLabel,
  timbreLabel,
  cadenceLabel,
  dialectLabel,
  emotionLabel,
}) => {
  const traits = [
    { label: 'الدفء والرنين (Warmth)', value: metrics.warmth, icon: Flame, color: 'from-amber-500 to-orange-500' },
    { label: 'النقاء والوضوح (Clarity)', value: metrics.clarity, icon: Radio, color: 'from-cyan-400 to-blue-500' },
    { label: 'طاقة الأداء (Energy)', value: metrics.energy, icon: Zap, color: 'from-violet-400 to-purple-500' },
    { label: 'معدل الإيقاع (Tempo)', value: Math.min(100, Math.round((metrics.tempoWpm / 180) * 100)), icon: Clock, color: 'from-emerald-400 to-teal-500' },
    { label: 'التردد الأساسي (Pitch)', value: Math.min(100, Math.round((metrics.pitchHz / 260) * 100)), icon: Activity, color: 'from-sky-400 to-indigo-500' },
    { label: 'الهوائية والتنفس (Air)', value: metrics.breathiness, icon: Wind, color: 'from-pink-400 to-rose-500' },
  ];

  return (
    <div className="space-y-4">
      {/* Top summary badges */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
        {pitchLabel && (
          <div className="bg-slate-900/90 border border-slate-800 rounded-lg p-2.5">
            <span className="text-slate-400 block mb-0.5">طبقة الصوت</span>
            <span className="font-semibold text-cyan-300 truncate block">{pitchLabel}</span>
          </div>
        )}
        {timbreLabel && (
          <div className="bg-slate-900/90 border border-slate-800 rounded-lg p-2.5">
            <span className="text-slate-400 block mb-0.5">خامة الصوت</span>
            <span className="font-semibold text-amber-300 truncate block">{timbreLabel}</span>
          </div>
        )}
        {cadenceLabel && (
          <div className="bg-slate-900/90 border border-slate-800 rounded-lg p-2.5">
            <span className="text-slate-400 block mb-0.5">إيقاع الكلام</span>
            <span className="font-semibold text-violet-300 truncate block">{cadenceLabel}</span>
          </div>
        )}
        {dialectLabel && (
          <div className="bg-slate-900/90 border border-slate-800 rounded-lg p-2.5">
            <span className="text-slate-400 block mb-0.5">اللهجة / النطق</span>
            <span className="font-semibold text-emerald-300 truncate block">{dialectLabel}</span>
          </div>
        )}
        {emotionLabel && (
          <div className="bg-slate-900/90 border border-slate-800 rounded-lg p-2.5 col-span-2 sm:col-span-1">
            <span className="text-slate-400 block mb-0.5">النبرة الشعورية</span>
            <span className="font-semibold text-rose-300 truncate block">{emotionLabel}</span>
          </div>
        )}
      </div>

      {/* Progress Bars for Voice Dimensions */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
        {traits.map((trait, idx) => {
          const Icon = trait.icon;
          return (
            <div key={idx} className="bg-slate-900/60 border border-slate-800/80 rounded-lg p-2.5">
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="flex items-center gap-1.5 text-slate-300 font-medium">
                  <Icon className="w-3.5 h-3.5 text-cyan-400" />
                  {trait.label}
                </span>
                <span className="font-mono text-cyan-300 font-semibold">{trait.value}%</span>
              </div>
              <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full bg-gradient-to-r ${trait.color} transition-all duration-700`}
                  style={{ width: `${trait.value}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
