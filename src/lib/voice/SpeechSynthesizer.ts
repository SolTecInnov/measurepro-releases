import type { SupportedLanguage } from './types';

const VOLUME_STORAGE_KEY = 'voice_synthesizer_volume';
const PREFERRED_VOICE_STORAGE_KEY = 'preferred_voice_name';

export class SpeechSynthesizer {
  private synth!: SpeechSynthesis;
  private volume: number = 0.8;
  private currentLanguage: SupportedLanguage = 'en-US';
  private utteranceQueue: SpeechSynthesisUtterance[] = [];
  private isSpeaking: boolean = false;
  private preferredVoiceName: string | null = null;

  constructor() {
    if (!this.isSupported()) {
      return;
    }

    this.synth = window.speechSynthesis;
    
    // Load saved volume
    const savedVolume = localStorage.getItem(VOLUME_STORAGE_KEY);
    if (savedVolume) {
      this.volume = parseFloat(savedVolume);
    }

    // Load saved preferred voice
    const savedVoice = localStorage.getItem(PREFERRED_VOICE_STORAGE_KEY);
    if (savedVoice) {
      this.preferredVoiceName = savedVoice;
    }
  }

  private getVoicesFromBrowser(): SpeechSynthesisVoice[] {
    return this.synth.getVoices();
  }

  private getBestVoice(language: SupportedLanguage): SpeechSynthesisVoice | null {
    const voices = this.getVoicesFromBrowser();
    
    if (this.preferredVoiceName) {
      const preferred = voices.find(voice => voice.name === this.preferredVoiceName);
      if (preferred) {
        return preferred;
      }
    }

    const exactMatches = voices.filter(voice => voice.lang === language);
    
    if (exactMatches.length > 0) {
      const preferredVoice = exactMatches.find(voice => 
        voice.name.includes('Google') || 
        voice.name.includes('Microsoft') ||
        voice.name.includes('Siri') ||
        voice.name.includes('Samantha') ||
        voice.name.includes('Daniel')
      );
      
      if (preferredVoice) {
        return preferredVoice;
      }
      
      return exactMatches[0];
    }

    const langCode = language.split('-')[0];
    const partialMatches = voices.filter(voice => voice.lang.startsWith(langCode));
    
    if (partialMatches.length > 0) {
      return partialMatches[0];
    }

    return null;
  }

  isSupported(): boolean {
    return 'speechSynthesis' in window;
  }

  speak(text: string, language?: SupportedLanguage): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.isSupported()) {
        reject(new Error('Speech synthesis not supported'));
        return;
      }

      const lang = language || this.currentLanguage;
      const utterance = new SpeechSynthesisUtterance(text);
      
      // Set voice
      const voice = this.getBestVoice(lang);
      if (voice) {
        utterance.voice = voice;
      }
      
      // Set properties
      utterance.lang = lang;
      utterance.volume = this.volume;
      utterance.rate = 1.0;
      utterance.pitch = 1.0;

      utterance.onend = () => {
        this.isSpeaking = false;
        this.processQueue();
        resolve();
      };

      utterance.onerror = (event) => {
        this.isSpeaking = false;
        this.processQueue();
        reject(new Error(`Speech synthesis error: ${event.error}`));
      };

      // Add to queue and process
      this.utteranceQueue.push(utterance);
      if (!this.isSpeaking) {
        this.processQueue();
      }
    });
  }

  private processQueue(): void {
    if (this.utteranceQueue.length === 0 || this.isSpeaking) {
      return;
    }

    const utterance = this.utteranceQueue.shift();
    if (utterance) {
      this.isSpeaking = true;
      this.synth.speak(utterance);
    }
  }

  stop(): void {
    if (!this.isSupported()) return;
    
    this.synth.cancel();
    this.utteranceQueue = [];
    this.isSpeaking = false;
  }

  setVolume(volume: number): void {
    this.volume = Math.max(0, Math.min(1, volume));
    localStorage.setItem(VOLUME_STORAGE_KEY, this.volume.toString());
  }

  getVolume(): number {
    return this.volume;
  }

  increaseVolume(step: number = 0.1): number {
    this.setVolume(this.volume + step);
    return this.volume;
  }

  decreaseVolume(step: number = 0.1): number {
    this.setVolume(this.volume - step);
    return this.volume;
  }

  setLanguage(language: SupportedLanguage): void {
    this.currentLanguage = language;
  }

  getAvailableVoices(language?: SupportedLanguage): SpeechSynthesisVoice[] {
    const voices = this.getVoicesFromBrowser();
    
    if (!language) {
      return voices;
    }

    const langCode = language.split('-')[0];
    return voices.filter(voice => 
      voice.lang === language || voice.lang.startsWith(langCode)
    );
  }

  getIsSpeaking(): boolean {
    return this.isSpeaking;
  }

  setPreferredVoice(voiceName: string): void {
    this.preferredVoiceName = voiceName;
    localStorage.setItem(PREFERRED_VOICE_STORAGE_KEY, voiceName);
  }

  getPreferredVoice(): string | null {
    return this.preferredVoiceName;
  }
}
