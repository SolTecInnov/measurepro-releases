import type { SupportedLanguage } from './types';

declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

export interface RecognitionResult {
  transcript: string;
  confidence: number;
  isFinal: boolean;
}

export class SpeechRecognizer {
  private recognition: any = null;
  private isListening: boolean = false;
  private isMuted: boolean = false;
  private currentLanguage: SupportedLanguage = 'en-US';
  private onResultCallback: ((result: RecognitionResult) => void) | null = null;
  private onErrorCallback: ((error: Error) => void) | null = null;
  private onStateChangeCallback: ((listening: boolean) => void) | null = null;
  private shouldRestart: boolean = true;
  private restartAttempts: number = 0;
  private maxRestartAttempts: number = 3;
  private restartDelay: number = 1000;

  constructor() {
    if (!this.isSupported()) {
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    this.recognition = new SpeechRecognition();
    
    this.recognition.continuous = true;
    this.recognition.interimResults = true;
    this.recognition.maxAlternatives = 1;
    
    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    if (!this.recognition) return;

    this.recognition.onstart = () => {
      this.isListening = true;
      this.restartAttempts = 0;
      this.onStateChangeCallback?.(true);
    };

    this.recognition.onend = () => {
      this.isListening = false;
      this.onStateChangeCallback?.(false);
      
      if (this.shouldRestart) {
        const delay = this.restartAttempts > 0 
          ? this.restartDelay * Math.pow(2, this.restartAttempts - 1)
          : 100;
        
        setTimeout(() => {
          if (this.shouldRestart) {
            this.start(this.currentLanguage);
          }
        }, delay);
      }
    };

    this.recognition.onresult = (event: any) => {
      if (this.isMuted) {
        return;
      }

      const result = event.results[event.results.length - 1];
      const transcript = result[0].transcript;
      const confidence = result[0].confidence;
      const isFinal = result.isFinal;

      this.onResultCallback?.({
        transcript: transcript.trim(),
        confidence,
        isFinal
      });
    };

    this.recognition.onerror = (event: any) => {
      if (event.error === 'no-speech') {
        return;
      }
      
      if (event.error === 'not-allowed' || event.error === 'audio-capture') {
        this.shouldRestart = false;
        this.onErrorCallback?.(new Error(`Speech recognition error: ${event.error}`));
        return;
      }
      
      if (event.error === 'network') {
        // In Electron, 'network' error usually means the speech API couldn't reach Google
        // This is a known Electron limitation with Web Speech API
        this.shouldRestart = false;
        this.onErrorCallback?.(new Error(
          'Voice recognition requires an internet connection. ' +
          'Make sure you are connected to the internet and try again. ' +
          'Note: Voice recognition uses Google Speech API and requires internet access.'
        ));
        return;
      }

      if (event.error === 'aborted') {
        this.restartAttempts++;
        if (this.restartAttempts >= this.maxRestartAttempts) {
          this.shouldRestart = false;
          this.onErrorCallback?.(new Error(`Speech recognition failed after multiple attempts`));
          return;
        }
        this.shouldRestart = true;
      }
      
      this.onErrorCallback?.(new Error(`Speech recognition error: ${event.error}`));
    };

    this.recognition.onnomatch = () => {
    };
  }

  isSupported(): boolean {
    return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
  }

  start(language: SupportedLanguage = 'en-US'): void {
    if (!this.recognition) {
      throw new Error('Speech recognition not supported');
    }

    if (this.isListening) {
      this.stop();
      setTimeout(() => this.start(language), 100);
      return;
    }

    this.currentLanguage = language;
    this.recognition.lang = language;
    this.shouldRestart = true;

    try {
      this.recognition.start();
    } catch (error) {
      throw error;
    }
  }

  stop(): void {
    if (!this.recognition) return;

    this.shouldRestart = false;
    this.restartAttempts = 0;
    
    if (this.isListening) {
      try {
        this.recognition.stop();
      } catch (error) {
      }
    }
  }

  mute(): void {
    this.isMuted = true;
  }

  unmute(): void {
    this.isMuted = false;
  }

  getIsMuted(): boolean {
    return this.isMuted;
  }

  setLanguage(language: SupportedLanguage): void {
    if (this.currentLanguage === language) return;
    
    const wasListening = this.isListening;
    if (wasListening) {
      this.stop();
    }
    
    this.currentLanguage = language;
    
    if (wasListening) {
      setTimeout(() => this.start(language), 100);
    }
  }

  onResult(callback: (result: RecognitionResult) => void): void {
    this.onResultCallback = callback;
  }

  onError(callback: (error: Error) => void): void {
    this.onErrorCallback = callback;
  }

  onStateChange(callback: (listening: boolean) => void): void {
    this.onStateChangeCallback = callback;
  }

  getIsListening(): boolean {
    return this.isListening;
  }

  getCurrentLanguage(): SupportedLanguage {
    return this.currentLanguage;
  }
}
