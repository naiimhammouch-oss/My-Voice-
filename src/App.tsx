import React, { useState, useEffect } from 'react';
import { VoiceProfile, GenerationHistoryItem } from './types/voice';
import { PRESET_VOICES } from './data/presetVoices';
import { Navbar } from './components/Navbar';
import { VoiceCloner } from './components/VoiceCloner';
import { SpeechStudio } from './components/SpeechStudio';
import { DialogueStudio } from './components/DialogueStudio';
import { VoiceLibrary } from './components/VoiceLibrary';

export default function App() {
  const [currentTab, setCurrentTab] = useState<'clone' | 'studio' | 'dialogue' | 'library'>('clone');
  const [voices, setVoices] = useState<VoiceProfile[]>(() => {
    try {
      const saved = localStorage.getItem('sawti_cloned_voices');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Merge presets and saved
          const presetIds = new Set(PRESET_VOICES.map((p) => p.id));
          const customOnly = parsed.filter((p: VoiceProfile) => !presetIds.has(p.id));
          return [...customOnly, ...PRESET_VOICES];
        }
      }
    } catch {}
    return PRESET_VOICES;
  });

  const [activeVoice, setActiveVoice] = useState<VoiceProfile>(voices[0]);
  const [historyItems, setHistoryItems] = useState<GenerationHistoryItem[]>([]);

  // Persist custom voices to localStorage
  useEffect(() => {
    try {
      const customOnly = voices.filter((v) => !v.isPreset);
      localStorage.setItem('sawti_cloned_voices', JSON.stringify(customOnly));
    } catch (e) {
      console.warn('Could not save to localStorage', e);
    }
  }, [voices]);

  const handleVoiceCloned = (newProfile: VoiceProfile) => {
    setVoices((prev) => [newProfile, ...prev]);
    setActiveVoice(newProfile);
  };

  const handleNavigateToStudio = (profile: VoiceProfile) => {
    setActiveVoice(profile);
    setCurrentTab('studio');
  };

  const handleSelectVoiceForStudio = (voice: VoiceProfile) => {
    setActiveVoice(voice);
    setCurrentTab('studio');
  };

  const handleDeleteVoice = (id: string) => {
    setVoices((prev) => prev.filter((v) => v.id !== id));
    if (activeVoice.id === id) {
      setActiveVoice(PRESET_VOICES[0]);
    }
  };

  const handleAddToHistory = (item: GenerationHistoryItem) => {
    setHistoryItems((prev) => [item, ...prev]);
  };

  return (
    <div className="min-h-screen bg-[#090d16] text-slate-100 flex flex-col font-sans selection:bg-cyan-500/30 selection:text-cyan-200">
      {/* Studio Header */}
      <Navbar
        currentTab={currentTab}
        onTabChange={setCurrentTab}
        activeVoiceCount={voices.length}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-8">
        {currentTab === 'clone' && (
          <VoiceCloner
            onVoiceCloned={handleVoiceCloned}
            onNavigateToStudio={handleNavigateToStudio}
          />
        )}

        {currentTab === 'studio' && (
          <SpeechStudio
            voices={voices}
            activeVoice={activeVoice}
            onSelectVoice={setActiveVoice}
            onAddToHistory={handleAddToHistory}
            onNavigateToClone={() => setCurrentTab('clone')}
          />
        )}

        {currentTab === 'dialogue' && (
          <DialogueStudio voices={voices} />
        )}

        {currentTab === 'library' && (
          <VoiceLibrary
            voices={voices}
            onSelectVoiceForStudio={handleSelectVoiceForStudio}
            onDeleteVoice={handleDeleteVoice}
            historyItems={historyItems}
          />
        )}
      </main>

      {/* Studio Footer */}
      <footer className="border-t border-slate-800/80 bg-slate-950/70 py-6 text-xs text-slate-500 mt-auto">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-400">صوتي AI (Sawti AI)</span>
            <span>•</span>
            <span>استنساخ الصوت والتحليل الصوتي التوليدي</span>
          </div>

          <div className="flex items-center gap-4 text-[11px]">
            <span>مدعوم بنماذج Gemini 3.8 Flash TTS المتطورة</span>
            <span className="hidden sm:inline">•</span>
            <span>نقاء صوتي 24kHz Mono WAV</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
