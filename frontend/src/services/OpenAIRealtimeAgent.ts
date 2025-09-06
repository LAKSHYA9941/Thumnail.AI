import OpenAI from 'openai';

interface OpenAIRealtimeAgentConfig {
  apiKey: string;
  model?: string;
  onTextUpdate: (text: string) => void;
  onError: (error: string) => void;
  onStatusChange: (status: string) => void;
}

type VoiceQuestionStep = 'topic' | 'moodAudience' | 'subject' | 'colorsText' | 'constraints';

const QUESTIONS: Record<VoiceQuestionStep, string> = {
  topic: "What's your video about? Give me the core topic or working title.",
  moodAudience: "What's the mood or emotion you want, and who is the audience? (e.g., exciting for beginners)",
  subject: "Who or what should be the main subject? Any reference image or brand/person to feature?",
  colorsText: "Any preferred colors/brand palette? Also give 2–4 words you want on the thumbnail.",
  constraints: "Any constraints or inspiration? (e.g., avoid text on left, use neon style)"
};

export class OpenAIRealtimeAgent {
  private openai: OpenAI;
  private config: OpenAIRealtimeAgentConfig;
  private isListening = false;
  private currentText = '';
  private conversationStarted = false;
  private stepOrder: VoiceQuestionStep[] = ['topic', 'moodAudience', 'subject', 'colorsText', 'constraints'];
  private stepIndex = 0;
  private answers: Partial<Record<VoiceQuestionStep, string>> = {};
  private ttsModel = 'gpt-4o-mini-tts';
  private sttModel = 'whisper-1';
  private voice: 'alloy' | 'verse' | 'aria' | 'sage' | 'opal' | (string & {}) = 'alloy';

  constructor(config: OpenAIRealtimeAgentConfig) {
    this.config = {
      model: 'gpt-realtime',
      ...config
    };
    
    this.openai = new OpenAI({
      apiKey: this.config.apiKey,
      dangerouslyAllowBrowser: true
    });
  }

  async startListening() {
    if (this.isListening) return;
    
    this.isListening = true;
    this.config.onStatusChange('Listening...');
    
    try {
      // Simulate real-time audio input
      this.config.onStatusChange('Processing speech...');
      
      // In a real implementation, this would use WebRTC for audio streaming
      // For now, we'll use a simplified text-based approach
      
    } catch (error) {
      this.config.onError('Failed to start listening');
      this.isListening = false;
    }
  }

  async processTextInput(text: string) {
    if (!text.trim()) return;
    
    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are a YouTube thumbnail prompt generator. Convert the user\'s speech into a concise, visually descriptive prompt for a YouTube thumbnail. Return only the prompt text, nothing else.'
          },
          {
            role: 'user',
            content: text
          }
        ],
        max_tokens: 100,
        temperature: 0.7
      }, {
        timeout: 15000,
        maxRetries: 1
      });

      const prompt = response.choices[0]?.message?.content?.trim() || '';
      this.currentText = prompt;
      this.config.onTextUpdate(prompt);
      
    } catch (error) {
      console.error('OpenAI Realtime Error:', error);
      this.config.onError('Failed to generate prompt');
    }
  }

  stopListening() {
    this.isListening = false;
    this.config.onStatusChange('Ready');
  }

  getCurrentText() {
    return this.currentText;
  }

  // ====== Voice Conversation Utilities ======
  getCurrentQuestion(): string | null {
    if (!this.conversationStarted) return null;
    const key = this.stepOrder[this.stepIndex];
    return key ? QUESTIONS[key] : null;
  }

  hasActiveSession(): boolean {
    return this.conversationStarted;
  }

  async startConversation() {
    this.conversationStarted = true;
    this.stepIndex = 0;
    this.answers = {};
    const q = this.getCurrentQuestion();
    if (q) {
      await this.speakText(q);
      this.config.onStatusChange('Ask: ' + q);
    }
  }

  async speakText(text: string) {
    try {
      // Using OpenAI TTS
      const result = await this.openai.audio.speech.create({
        model: this.ttsModel,
        voice: this.voice,
        input: text
      } as any);

      // Depending on SDK/browser, result may expose blob() or arrayBuffer()
      let blob: Blob;
      if (typeof (result as any).blob === 'function') {
        blob = await (result as any).blob();
      } else if (typeof (result as any).arrayBuffer === 'function') {
        const ab = await (result as any).arrayBuffer();
        blob = new Blob([ab], { type: 'audio/mpeg' });
      } else {
        // Fallback try cast
        blob = result as unknown as Blob;
      }
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      await audio.play();
      // Cleanup when done
      audio.onended = () => {
        URL.revokeObjectURL(url);
      };
    } catch (err: any) {
      console.error('TTS playback error', err);
      this.config.onError('Failed to play agent voice');
    }
  }

  async transcribeAudio(blob: Blob): Promise<string> {
    try {
      const file = new File([blob], 'answer.webm', { type: blob.type || 'audio/webm' });
      const tr: any = await (this.openai as any).audio.transcriptions.create({
        file,
        model: this.sttModel
      });
      const text: string = (tr?.text || tr?.data?.text || '').toString().trim();
      return text;
    } catch (err) {
      console.error('Transcription error', err);
      this.config.onError('Failed to transcribe speech');
      return '';
    }
  }

  async ingestAnswer(answer: string): Promise<{ done: boolean; question?: string; prompt?: string }> {
    const key = this.stepOrder[this.stepIndex];
    if (key) this.answers[key] = answer;

    // Move to next
    this.stepIndex += 1;

    if (this.stepIndex < this.stepOrder.length) {
      const nextQ = this.getCurrentQuestion();
      if (nextQ) {
        // Speak next question but do not block caller
        this.speakText(nextQ).catch(() => {});
        this.config.onStatusChange('Ask: ' + nextQ);
      }
      return { done: false, question: nextQ || undefined };
    }

    // Finalize
    const finalPrompt = await this.buildFinalPrompt();
    this.currentText = finalPrompt;
    this.config.onTextUpdate(finalPrompt);
    this.conversationStarted = false;
    this.config.onStatusChange('Ready');
    // Optionally speak a closing line
    this.speakText('Great! I have crafted your thumbnail prompt. You can generate it now.').catch(() => {});
    return { done: true, prompt: finalPrompt };
  }

  private async buildFinalPrompt(): Promise<string> {
    const a = this.answers;
    const topic = a.topic || '';
    const moodAudience = a.moodAudience || '';
    const subject = a.subject || '';
    const colorsText = a.colorsText || '';
    const constraints = a.constraints || '';

    const base = `YouTube thumbnail for: ${topic}. Mood/audience: ${moodAudience}. Main subject: ${subject}. Colors & overlay text: ${colorsText}. Extra constraints: ${constraints}.`;

    // Let the LLM compress/refine into a clean thumbnail prompt
    try {
      const resp = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content:
              'You are a thumbnail prompt engineer. Produce a single concise, visual prompt optimized for AI image generation. Include subject, composition, lighting, colors, emotion, and a 2-4 word overlay. Avoid camera jargon. Return ONLY the prompt.'
          },
          { role: 'user', content: base }
        ],
        max_tokens: 150,
        temperature: 0.7
      });
      const refined = resp.choices?.[0]?.message?.content?.trim();
      const composed = this.applyCompositionConstraints(refined || base);
      return composed;
    } catch (err) {
      console.warn('LLM refine failed, falling back to template');
      return this.applyCompositionConstraints(base);
    }
  }

  private applyCompositionConstraints(basePrompt: string): string {
    const normalized = basePrompt.toLowerCase();
    const hasSize = normalized.includes('1280') || normalized.includes('720') || normalized.includes('16:9');
    const constraints = 'YouTube thumbnail, 1280x720 (16:9). Center-focused composition. Avoid side color bands or empty margins. Ensure subject and text are centered and fill the frame edge-to-edge with clear focal point.';
    return hasSize
      ? `${basePrompt}. Center-focused composition. Avoid side color bands or empty margins. Ensure subject and text are centered and fill the frame.`
      : `${basePrompt}. ${constraints}`;
  }
}
