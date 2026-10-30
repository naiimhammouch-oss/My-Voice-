export type BaseVoiceName = 'Puck' | 'Charon' | 'Kore' | 'Fenrir' | 'Zephyr';

export interface AcousticMetrics {
  pitchHz: number;
  warmth: number;
  clarity: number;
  energy: number;
  tempoWpm: number;
  breathiness: number;
}

export interface VoiceProfile {
  id: string;
  name: string;
  avatar: string;
  description: string;
  category: 'documentary' | 'broadcast' | 'storytelling' | 'commercial' | 'casual' | 'custom';
  gender: 'male' | 'female' | 'neutral';
  baseVoice: BaseVoiceName;
  stylePrompt: string;
  detectedPitch: string;
  detectedTimbre: string;
  detectedCadence: string;
  detectedDialect: string;
  detectedEmotion: string;
  acousticMetrics: AcousticMetrics;
  summaryArabic: string;
  createdAt: string;
  isPreset?: boolean;
  sampleAudioBase64?: string;
}

export interface GenerationHistoryItem {
  id: string;
  voiceProfileId: string;
  voiceName: string;
  text: string;
  audioBase64: string;
  mimeType: string;
  emotion: string;
  createdAt: string;
  durationSeconds?: number;
}

export interface DialogueTurn {
  id: string;
  speaker: 'speaker1' | 'speaker2';
  text: string;
}
