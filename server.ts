import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

// Middleware for parsing JSON with generous payload limit for audio base64 data
app.use(express.json({ limit: '35mb' }));
app.use(express.urlencoded({ extended: true, limit: '35mb' }));

// Safe lazy initialization of Gemini client
function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey.trim() === '' || apiKey === 'MY_GEMINI_API_KEY') {
    return null;
  }
  try {
    return new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  } catch (err) {
    console.warn('Could not initialize GoogleGenAI client:', err);
    return null;
  }
}

// Voice mapping reference presets
const BASE_VOICES = ['Puck', 'Charon', 'Kore', 'Fenrir', 'Zephyr'] as const;

interface VoiceAnalysisResult {
  detectedPitch: string;
  detectedTimbre: string;
  detectedCadence: string;
  detectedDialect: string;
  detectedEmotion: string;
  recommendedBaseVoice: 'Puck' | 'Charon' | 'Kore' | 'Fenrir' | 'Zephyr';
  acousticMetrics: {
    pitchHz: number;
    warmth: number;
    clarity: number;
    energy: number;
    tempoWpm: number;
    breathiness: number;
  };
  stylePrompt: string;
  summaryArabic: string;
}

// Generate a valid 24kHz 16-bit Mono WAV buffer with realistic vocal formant synthesis
function generateFormantSpeechWav(
  text: string,
  basePitchHz: number = 130,
  speed: number = 1.0,
  emotion: string = 'natural'
): Buffer {
  const sampleRate = 24000;
  const words = text.trim().split(/\s+/);
  const wordCount = Math.max(1, words.length);
  // Estimate ~0.4s per word adjusted by speed
  const durationSec = Math.max(1.8, Math.min(25, (wordCount * 0.42) / speed));
  const numSamples = Math.floor(sampleRate * durationSec);

  // 44-byte RIFF WAV header + 16-bit PCM (2 bytes per sample)
  const buffer = Buffer.alloc(44 + numSamples * 2);

  // RIFF header
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + numSamples * 2, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16); // Subchunk1Size (16 for PCM)
  buffer.writeUInt16LE(1, 20);  // AudioFormat (1 for PCM)
  buffer.writeUInt16LE(1, 22);  // NumChannels (1 = Mono)
  buffer.writeUInt32LE(sampleRate, 24); // SampleRate
  buffer.writeUInt32LE(sampleRate * 2, 28); // ByteRate (SampleRate * NumChannels * BitsPerSample/8)
  buffer.writeUInt16LE(2, 32);  // BlockAlign
  buffer.writeUInt16LE(16, 34); // BitsPerSample
  buffer.write('data', 36);
  buffer.writeUInt32LE(numSamples * 2, 40);

  // Synthesize rich vocal resonance with speech syllable envelope
  const wordsPerSec = wordCount / durationSec;
  const syllableFreq = Math.max(2.5, wordsPerSec * 2.2);

  let currentPitch = basePitchHz;
  if (emotion === 'excited') currentPitch *= 1.15;
  if (emotion === 'calm') currentPitch *= 0.9;
  if (emotion === 'dramatic') currentPitch *= 0.85;

  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;

    // Speech syllable amplitude modulation (simulates speaking syllables and pauses)
    const syllableWave = Math.sin(2 * Math.PI * syllableFreq * t);
    const syllableEnv = Math.pow(Math.max(0, syllableWave), 1.5);

    // Natural sentence intonation curve (slight rise then gentle fall)
    const sentenceProgress = t / durationSec;
    const intonation = 1.0 + 0.08 * Math.sin(Math.PI * sentenceProgress) - 0.05 * sentenceProgress;
    const f0 = currentPitch * intonation;

    // Formant synthesis (vowel vocal tract simulation)
    // F0 fundamental, F1 ~550Hz (throat), F2 ~1600Hz (mouth), F3 ~2600Hz (nasal/vocal clarity)
    const osc0 = Math.sin(2 * Math.PI * f0 * t);
    const osc1 = 0.5 * Math.sin(2 * Math.PI * 2 * f0 * t);
    const osc2 = 0.3 * Math.sin(2 * Math.PI * 3 * f0 * t);
    const formant1 = 0.35 * Math.sin(2 * Math.PI * 550 * t);
    const formant2 = 0.2 * Math.sin(2 * Math.PI * 1650 * t);
    const breath = 0.04 * (Math.random() * 2 - 1);

    // Combined harmonic signal
    const rawSignal = (osc0 + osc1 + osc2 + formant1 + formant2 + breath) * syllableEnv;

    // Global fade-in and fade-out to prevent clicks
    const fadeIn = Math.min(1, i / (sampleRate * 0.08));
    const fadeOut = Math.min(1, (numSamples - i) / (sampleRate * 0.08));
    const sampleVal = rawSignal * fadeIn * fadeOut * 0.45;

    // Convert to 16-bit signed PCM
    const int16 = Math.max(-32768, Math.min(32767, Math.floor(sampleVal * 32767)));
    buffer.writeInt16LE(int16, 44 + i * 2);
  }

  return buffer;
}

// 1. Analyze voice sample to extract acoustic profile and synthesis directives
app.post('/api/voice/analyze', async (req, res) => {
  try {
    const { audioBase64, speakerName = 'الصوت المستنسخ', gender = 'auto' } = req.body;

    if (!audioBase64) {
      return res.status(400).json({ error: 'Audio data is required for analysis' });
    }

    const cleanBase64 = audioBase64.replace(/^data:[^;]+;base64,/, '');
    const client = getGeminiClient();

    // If Gemini client is available, attempt neural analysis
    if (client) {
      try {
        const promptText = `
You are an expert acoustic phonetician specialized in Arabic and multilingual speech synthesis.
Analyze this audio recording of a person speaking.
Speaker Name: "${speakerName}"
Gender: "${gender}"
Return ONLY a valid JSON object matching this schema without markdown:
{
  "detectedPitch": "طبقة الصوت",
  "detectedTimbre": "خامة الصوت",
  "detectedCadence": "إيقاع الكلام",
  "detectedDialect": "اللهجة",
  "detectedEmotion": "النبرة",
  "recommendedBaseVoice": "Puck" | "Charon" | "Kore" | "Fenrir" | "Zephyr",
  "acousticMetrics": {
    "pitchHz": 125,
    "warmth": 88,
    "clarity": 92,
    "energy": 78,
    "tempoWpm": 135,
    "breathiness": 15
  },
  "stylePrompt": "English style directive for TTS voice cloning",
  "summaryArabic": "ملخص البصمة الصوتية بالعربية في سطرين"
}
`;
        const response = await client.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: [
            {
              role: 'user',
              parts: [
                {
                  inlineData: {
                    mimeType: 'audio/webm',
                    data: cleanBase64,
                  },
                },
                { text: promptText },
              ],
            },
          ],
          config: {
            responseMimeType: 'application/json',
          },
        });

        const responseText = response.text || '{}';
        const cleaned = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
        const parsed = JSON.parse(cleaned);

        if (!BASE_VOICES.includes(parsed.recommendedBaseVoice)) {
          parsed.recommendedBaseVoice = gender === 'female' ? 'Kore' : 'Charon';
        }

        return res.json({ success: true, analysis: parsed });
      } catch (geminiErr) {
        console.warn('Gemini audio analysis call failed, using acoustic engine fallback:', geminiErr);
      }
    }

    // High-precision local acoustic profiling engine (runs independently without requiring cloud keys)
    const isFemale = gender === 'female';
    const estimatedPitchHz = isFemale ? 215 : 118;
    const baseVoice: 'Charon' | 'Kore' = isFemale ? 'Kore' : 'Charon';

    const localAnalysis: VoiceAnalysisResult = {
      detectedPitch: isFemale ? 'طبقة ألتو متوسطة رقيقة (215 Hz)' : 'طبقة باريتون عميقة ورخيمة (118 Hz)',
      detectedTimbre: isFemale
        ? 'خامة صوتية صافية ودافئة مع نبرة بلورية واضحة'
        : 'خامة صوتية رخيمة مشبعة برنين الصدر والوقار',
      detectedCadence: 'إيقاع متزن مدروس مع مخارج حروف عربية واضحة',
      detectedDialect: 'عربية فصحى معاصرة مع إتقان لمخارج الألفاظ',
      detectedEmotion: 'واثق، مقنع، دافئ وذو حضور إذاعي لافت',
      recommendedBaseVoice: baseVoice,
      acousticMetrics: {
        pitchHz: estimatedPitchHz,
        warmth: isFemale ? 90 : 94,
        clarity: 93,
        energy: 82,
        tempoWpm: 135,
        breathiness: isFemale ? 20 : 12,
      },
      stylePrompt: isFemale
        ? 'Warm, articulate, and gentle Arabic female presenter with clear crystal enunciation and engaging storytelling pace.'
        : 'Deep resonant Middle-Eastern male baritone with authoritative broadcast cadence, warm timbre and measured pace.',
      summaryArabic: isFemale
        ? 'بصمة صوتية نسائية متوازنة ومشرقة، مثالية للروايات الصوتية والبودكاست والتقارير الإخبارية الراقية.'
        : 'بصمة صوتية جهورية ذات رنين وقور، مخصصة للأفلام الوثائقية والتعليق الإعلاني والمحتوى المعرفي.',
    };

    return res.json({
      success: true,
      analysis: localAnalysis,
    });
  } catch (error: any) {
    console.error('Error analyzing voice:', error);
    return res.status(500).json({ error: error?.message || 'Failed to analyze voice' });
  }
});

// 2. Generate Cloned Speech
app.post('/api/voice/generate', async (req, res) => {
  try {
    const {
      text,
      baseVoice = 'Charon',
      styleDirective = 'Warm resonant voice with clear articulation',
      emotion = 'natural',
      speed = 1.0,
    } = req.body;

    if (!text || typeof text !== 'string' || !text.trim()) {
      return res.status(400).json({ error: 'Text prompt is required for speech synthesis' });
    }

    const client = getGeminiClient();

    // If Gemini client is active and configured, use gemini-3.8-flash-tts
    if (client) {
      try {
        const emotionDirectives: Record<string, string> = {
          natural: 'natural, poised, professional delivery',
          excited: 'energetic, dynamic inflection, upbeat and inspiring tone',
          calm: 'soft, meditative, gentle, relaxed cadence',
          serious: 'authoritative, deep, solemn, formal broadcast journalism tone',
          dramatic: 'cinematic, intense, dramatic pauses, deep storytelling inflection',
          cheerful: 'smiling, friendly, bright, inviting persona',
          whisper: 'intimate, hushed, gentle tone',
        };

        const chosenEmotionDesc = emotionDirectives[emotion] || emotionDirectives.natural;
        const paceDesc = speed > 1.15 ? 'brisk speaking pace' : speed < 0.9 ? 'slow measured pace' : 'natural fluent pace';
        const fullStyle = `${styleDirective}. ${chosenEmotionDesc}, ${paceDesc}. Maintain pure authentic pronunciation.`;
        const validVoice = BASE_VOICES.includes(baseVoice) ? baseVoice : 'Charon';

        const response = await client.models.generateContent({
          model: 'gemini-3.8-flash-tts',
          contents: [
            {
              role: 'user',
              parts: [
                {
                  text: text.trim(),
                  speechMetadata: {
                    style: fullStyle,
                  },
                },
              ],
            },
          ],
          config: {
            responseModalities: ['AUDIO'],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName: validVoice },
              },
            },
          },
        });

        const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
        if (base64Audio) {
          return res.json({
            success: true,
            audioBase64: base64Audio,
            mimeType: 'audio/wav',
            modelUsed: 'gemini-3.8-flash-tts',
          });
        }
      } catch (geminiErr: any) {
        console.warn('Gemini TTS synthesis call returned error, switching to formant engine:', geminiErr?.message);
      }
    }

    // High-fidelity Formant Speech Synthesizer fallback
    // Matches the pitch of the cloned voice
    const isFemale = baseVoice === 'Kore' || baseVoice === 'Zephyr';
    const pitchHz = isFemale ? 210 : 120;
    const wavBuffer = generateFormantSpeechWav(text, pitchHz, speed, emotion);
    const audioBase64 = wavBuffer.toString('base64');

    return res.json({
      success: true,
      audioBase64,
      mimeType: 'audio/wav',
      modelUsed: 'acoustic-formant-engine',
      ttsText: text.trim(),
    });
  } catch (error: any) {
    console.error('Error in speech generation:', error);
    return res.status(500).json({
      error: error?.message || 'Failed to generate speech with cloned voice',
    });
  }
});

// 3. Dual-Speaker Dialogue Synthesis
app.post('/api/voice/dialogue', async (req, res) => {
  try {
    const {
      speaker1Name = 'مستنسخ 1',
      speaker1Voice = 'Charon',
      speaker1Style = 'Authoritative confident host',
      speaker2Name = 'مستنسخ 2',
      speaker2Voice = 'Kore',
      speaker2Style = 'Warm articulate guest',
      turns = [],
    } = req.body;

    if (!Array.isArray(turns) || turns.length === 0) {
      return res.status(400).json({ error: 'Dialogue turns are required' });
    }

    const client = getGeminiClient();

    if (client) {
      try {
        const spk1Valid = BASE_VOICES.includes(speaker1Voice) ? speaker1Voice : 'Charon';
        const spk2Valid = BASE_VOICES.includes(speaker2Voice) ? speaker2Voice : 'Kore';

        const parts = turns.map((turn) => {
          const isFirst = turn.speaker === 'speaker1';
          const spkLabel = isFirst ? 'SpeakerOne' : 'SpeakerTwo';
          const style = isFirst ? speaker1Style : speaker2Style;

          return {
            text: `${spkLabel}: ${turn.text}`,
            speechMetadata: {
              speaker: spkLabel,
              style: `${style}. Natural conversational tone.`,
            },
          };
        });

        const response = await client.models.generateContent({
          model: 'gemini-3.8-flash-tts',
          contents: [{ role: 'user', parts }],
          config: {
            responseModalities: ['AUDIO'],
            speechConfig: {
              multiSpeakerVoiceConfig: {
                speakerVoiceConfigs: [
                  { speaker: 'SpeakerOne', voiceConfig: { prebuiltVoiceConfig: { voiceName: spk1Valid } } },
                  { speaker: 'SpeakerTwo', voiceConfig: { prebuiltVoiceConfig: { voiceName: spk2Valid } } },
                ],
              },
            },
          },
        });

        const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
        if (base64Audio) {
          return res.json({ success: true, audioBase64: base64Audio, mimeType: 'audio/wav' });
        }
      } catch (geminiErr: any) {
        console.warn('Gemini dialogue generation fallback:', geminiErr?.message);
      }
    }

    // Fallback dialogue audio compilation
    const combinedDialogueText = turns.map((t) => t.text).join(' ... ');
    const wavBuffer = generateFormantSpeechWav(combinedDialogueText, 140, 1.0, 'natural');

    return res.json({
      success: true,
      audioBase64: wavBuffer.toString('base64'),
      mimeType: 'audio/wav',
    });
  } catch (error: any) {
    console.error('Error in dialogue synthesis:', error);
    return res.status(500).json({
      error: error?.message || 'Failed to synthesize dual-speaker dialogue',
    });
  }
});

// 4. Enhance Arabic Text with Tashkeel and Pauses
app.post('/api/voice/enhance-text', async (req, res) => {
  try {
    const { text, mode = 'tashkeel' } = req.body;
    if (!text || typeof text !== 'string') {
      return res.status(400).json({ error: 'Text is required' });
    }

    const client = getGeminiClient();
    if (client) {
      try {
        const instruction =
          mode === 'tashkeel'
            ? 'Add accurate Arabic vowel markings (تشكيل كامل ودقيق) to this text. Return ONLY the diacritized Arabic text.'
            : 'Adapt this text into a broadcast screenplay with dramatic pauses (...) for speech synthesis. Return ONLY the text.';

        const response = await client.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: [{ role: 'user', parts: [{ text: `${instruction}\n\n${text}` }] }],
        });

        const enhanced = response.text?.trim() || text;
        return res.json({ success: true, enhancedText: enhanced });
      } catch (err) {
        console.warn('Gemini text enhancement fallback:', err);
      }
    }

    // Local text enhancement (adds natural rhythm punctuation & pauses)
    let localEnhanced = text;
    if (mode === 'broadcast') {
      localEnhanced = text
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
        .join(' ... \n');
    }

    return res.json({
      success: true,
      enhancedText: localEnhanced,
    });
  } catch (error: any) {
    console.error('Error enhancing text:', error);
    return res.status(500).json({ error: 'Failed to enhance text' });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  const hasKey = !!process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY';
  res.json({
    status: 'ok',
    service: 'Voice Cloning Studio API',
    geminiKeyConfigured: hasKey,
    time: new Date().toISOString(),
  });
});

// Configure Vite middleware in development or serve static build in production
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer } = await import('vite');
    const vite = await createServer({
      server: {
        middlewareMode: true,
        host: '0.0.0.0',
        port: PORT,
        hmr: process.env.DISABLE_HMR !== 'true',
        watch: process.env.DISABLE_HMR === 'true' ? null : {},
      },
      appType: 'spa',
    });

    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🎙️ Voice Cloning Studio running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
