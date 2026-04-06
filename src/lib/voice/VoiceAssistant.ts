import { SpeechRecognizer } from './SpeechRecognizer';
import { SpeechSynthesizer } from './SpeechSynthesizer';
import { IntentEngine } from './IntentEngine';
import { CommandRegistry } from './CommandRegistry';
import { VoiceNoteManager } from './VoiceNoteManager';
import type { SupportedLanguage, VoiceAssistantState, VoiceAssistantEvent } from './types';

const LANGUAGE_STORAGE_KEY = 'voice_assistant_language';

export class VoiceAssistant {
  private recognizer: SpeechRecognizer;
  private synthesizer: SpeechSynthesizer;
  private intentEngine: IntentEngine;
  private commandRegistry: CommandRegistry;
  private voiceNoteManager: VoiceNoteManager;
  
  private currentLanguage: SupportedLanguage = 'en-US';
  private state: VoiceAssistantState = 'idle';
  private eventListeners: ((event: VoiceAssistantEvent) => void)[] = [];
  private lastTranscript: string = '';

  constructor() {
    this.recognizer = new SpeechRecognizer();
    this.synthesizer = new SpeechSynthesizer();
    this.intentEngine = new IntentEngine();
    this.commandRegistry = new CommandRegistry();
    this.voiceNoteManager = new VoiceNoteManager();

    const savedLanguage = localStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (savedLanguage && this.isValidLanguage(savedLanguage)) {
      this.currentLanguage = savedLanguage as SupportedLanguage;
    }

    this.setupRecognizer();
    this.setupCallbacks();
  }

  private setupRecognizer(): void {
    this.recognizer.onResult((result) => {
      this.lastTranscript = result.transcript;

      if (result.isFinal) {
        this.processCommand(result.transcript);
      } else {
        this.emitEvent({
          type: 'listening',
          data: { transcript: result.transcript, isFinal: false }
        });
      }
    });

    this.recognizer.onError((error) => {
      this.setState('error');
      this.emitEvent({
        type: 'error',
        error
      });
    });

    this.recognizer.onStateChange((listening) => {
      if (listening && this.state === 'idle') {
        this.setState('listening');
      }
    });
  }

  private setupCallbacks(): void {
    this.commandRegistry.onVolumeChange((volume) => {
      this.synthesizer.setVolume(volume);
    });
  }

  private async processCommand(transcript: string): Promise<void> {
    try {
      this.setState('processing');
      this.emitEvent({
        type: 'processing',
        data: { transcript }
      });

      const match = this.intentEngine.recognizeIntent(transcript, this.currentLanguage);
      const response = await this.commandRegistry.execute(match.intent, this.currentLanguage);

      this.setState('responding');
      this.emitEvent({
        type: 'responding',
        data: { response, intent: match.intent }
      });

      if (this.synthesizer.getVolume() > 0) {
        this.recognizer.mute();
        try {
          await this.synthesizer.speak(response, this.currentLanguage);
          await new Promise(resolve => setTimeout(resolve, 800));
        } finally {
          this.recognizer.unmute();
        }
      }

      if (this.recognizer.getIsListening()) {
        this.setState('listening');
      } else {
        this.setState('idle');
      }
    } catch (error) {
      this.setState('error');
      this.emitEvent({
        type: 'error',
        error: error as Error
      });
      
      this.recognizer.unmute();

      setTimeout(() => {
        if (this.recognizer.getIsListening()) {
          this.setState('listening');
        }
      }, 2000);
    }
  }

  start(language?: SupportedLanguage): void {
    if (!this.recognizer.isSupported()) {
      throw new Error('Speech recognition not supported in this browser');
    }

    const lang = language || this.currentLanguage;
    this.setLanguage(lang);

    try {
      this.recognizer.start(lang);
      this.synthesizer.setLanguage(lang);
      this.setState('listening');
    } catch (error) {
      this.setState('error');
      throw error;
    }
  }

  stop(): void {
    this.recognizer.unmute();
    this.recognizer.stop();
    this.synthesizer.stop();
    this.setState('idle');
  }

  setLanguage(language: SupportedLanguage): void {
    this.currentLanguage = language;
    this.synthesizer.setLanguage(language);
    localStorage.setItem(LANGUAGE_STORAGE_KEY, language);

    if (this.recognizer.getIsListening()) {
      this.recognizer.setLanguage(language);
    }
  }

  setVolume(volume: number): void {
    this.synthesizer.setVolume(volume);
  }

  getVolume(): number {
    return this.synthesizer.getVolume();
  }

  setPreferredVoice(voiceName: string): void {
    this.synthesizer.setPreferredVoice(voiceName);
  }

  getState(): VoiceAssistantState {
    return this.state;
  }

  getLanguage(): SupportedLanguage {
    return this.currentLanguage;
  }

  getLastTranscript(): string {
    return this.lastTranscript;
  }

  isSupported(): boolean {
    return this.recognizer.isSupported() && this.synthesizer.isSupported();
  }

  speak(text: string, language?: SupportedLanguage): Promise<void> {
    const lang = language || this.currentLanguage;
    return this.synthesizer.speak(text, lang);
  }

  addEventListener(listener: (event: VoiceAssistantEvent) => void): void {
    this.eventListeners.push(listener);
  }

  removeEventListener(listener: (event: VoiceAssistantEvent) => void): void {
    this.eventListeners = this.eventListeners.filter(l => l !== listener);
  }

  private emitEvent(event: VoiceAssistantEvent): void {
    this.eventListeners.forEach(listener => {
      try {
        listener(event);
      } catch (error) {
      }
    });
  }

  private setState(state: VoiceAssistantState): void {
    this.state = state;
    this.emitEvent({ type: state });
  }

  private isValidLanguage(lang: string): boolean {
    return ['en-US', 'fr-FR', 'es-ES'].includes(lang);
  }

  getCommandRegistry(): CommandRegistry {
    return this.commandRegistry;
  }

  getVoiceNoteManager(): VoiceNoteManager {
    return this.voiceNoteManager;
  }
}
