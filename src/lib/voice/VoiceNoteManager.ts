import { openSurveyDB } from '../survey/db';
import type { VoiceNote, SupportedLanguage } from './types';

export class VoiceNoteManager {
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  private isRecording: boolean = false;
  private startTime: number = 0;
  private onRecordingStateChangeCallback: ((recording: boolean) => void) | null = null;

  async startRecording(language: SupportedLanguage): Promise<void> {
    if (this.isRecording) {
      throw new Error('Already recording');
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Determine the best supported MIME type
      const mimeType = this.getSupportedMimeType();
      
      this.mediaRecorder = new MediaRecorder(stream, { mimeType });
      this.audioChunks = [];
      this.startTime = Date.now();

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data);
        }
      };

      this.mediaRecorder.onstart = () => {
        this.isRecording = true;
        this.onRecordingStateChangeCallback?.(true);
      };

      this.mediaRecorder.onstop = () => {
        this.isRecording = false;
        this.onRecordingStateChangeCallback?.(false);
        
        stream.getTracks().forEach(track => track.stop());
      };

      this.mediaRecorder.start();
    } catch (error) {
      throw error;
    }
  }

  async stopRecording(): Promise<Blob> {
    return new Promise((resolve, reject) => {
      if (!this.mediaRecorder || !this.isRecording) {
        reject(new Error('Not recording'));
        return;
      }

      this.mediaRecorder.onstop = () => {
        const mimeType = this.mediaRecorder?.mimeType || 'audio/webm';
        const blob = new Blob(this.audioChunks, { type: mimeType });
        
        this.mediaRecorder?.stream.getTracks().forEach(track => track.stop());
        
        this.isRecording = false;
        this.onRecordingStateChangeCallback?.(false);
        
        resolve(blob);
      };

      this.mediaRecorder.stop();
    });
  }

  async saveVoiceNote(
    measurementId: string,
    blob: Blob,
    language: SupportedLanguage
  ): Promise<VoiceNote> {
    const duration = (Date.now() - this.startTime) / 1000;
    
    const voiceNote: VoiceNote = {
      id: `voice-note-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      measurementId,
      blob,
      mimeType: blob.type,
      duration,
      language,
      createdAt: new Date().toISOString()
    };

    try {
      const db = await openSurveyDB();
      await db.put('voiceNotes', voiceNote);
      return voiceNote;
    } catch (error) {
      throw error;
    }
  }

  async getVoiceNote(id: string): Promise<VoiceNote | null> {
    try {
      const db = await openSurveyDB();
      const note = await db.get('voiceNotes', id);
      return note || null;
    } catch (error) {
      return null;
    }
  }

  async getVoiceNotesByMeasurement(measurementId: string): Promise<VoiceNote[]> {
    try {
      const db = await openSurveyDB();
      const notes = await db.getAllFromIndex('voiceNotes', 'by-measurement', measurementId);
      return notes || [];
    } catch (error) {
      return [];
    }
  }

  async deleteVoiceNote(id: string): Promise<void> {
    try {
      const db = await openSurveyDB();
      await db.delete('voiceNotes', id);
    } catch (error) {
      throw error;
    }
  }

  async playVoiceNote(voiceNote: VoiceNote): Promise<void> {
    return new Promise((resolve, reject) => {
      const audio = new Audio();
      const url = URL.createObjectURL(voiceNote.blob);
      
      audio.src = url;
      
      audio.onended = () => {
        URL.revokeObjectURL(url);
        resolve();
      };
      
      audio.onerror = (error) => {
        URL.revokeObjectURL(url);
        reject(error);
      };
      
      audio.play().catch(reject);
    });
  }

  async downloadVoiceNote(voiceNote: VoiceNote, filename?: string): Promise<void> {
    const url = URL.createObjectURL(voiceNote.blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename || `voice-note-${voiceNote.id}.${this.getFileExtension(voiceNote.mimeType)}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  getIsRecording(): boolean {
    return this.isRecording;
  }

  getRecordingDuration(): number {
    if (!this.isRecording) return 0;
    return (Date.now() - this.startTime) / 1000;
  }

  onRecordingStateChange(callback: (recording: boolean) => void): void {
    this.onRecordingStateChangeCallback = callback;
  }

  private getSupportedMimeType(): string {
    const types = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/ogg;codecs=opus',
      'audio/mp4',
      'audio/mpeg'
    ];

    for (const type of types) {
      if (MediaRecorder.isTypeSupported(type)) {
        return type;
      }
    }

    return '';
  }

  private getFileExtension(mimeType: string): string {
    const map: Record<string, string> = {
      'audio/webm': 'webm',
      'audio/ogg': 'ogg',
      'audio/mp4': 'm4a',
      'audio/mpeg': 'mp3',
      'audio/wav': 'wav'
    };

    for (const [type, ext] of Object.entries(map)) {
      if (mimeType.includes(type)) {
        return ext;
      }
    }

    return 'webm';
  }
}
