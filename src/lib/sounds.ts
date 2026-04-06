// Reference all sound files from public/sounds/ — no Vite bundling, no duplication in dist
const alertAlarmSound = '/sounds/alert-alarm-1005.wav';
const classicAlarmSound = '/sounds/classic-alarm-995.wav';
const confirmationSound = '/sounds/confirmation.wav';
const criticalMp3Sound = '/sounds/critical.mp3';
const doubleBeepSound = '/sounds/double-beep-tone-alert-2868.wav';
const elevatorToneSound = '/sounds/elevator-tone-2863.wav';
const elevatorSound = '/sounds/elevator.wav';
const facilityAlarmSound = '/sounds/facility-alarm-sound-999.wav';
const interfaceHintSound = '/sounds/interface-hint-notification-911.wav';
const interfaceSound = '/sounds/interface.wav';
const logEntryMp3Sound = '/sounds/log-entry.mp3';
const longPopSound = '/sounds/long-pop-2358.wav';
const messagePopSound = '/sounds/message-pop-alert-2354.mp3';
const retroConfirmationSound = '/sounds/retro-confirmation-tone-2860.wav';
const sciFiAlarmSound = '/sounds/scanning-sci-fi-alarm-905.wav';
const securityBreachSound = '/sounds/security-facility-breach-alarm-994.wav';
const slotMachineSound = '/sounds/slot-machine-win-alarm-1995.wav';
const warningMp3Sound = '/sounds/warning.mp3';

// Default sound assignments
const logEntrySound = interfaceSound;
const warningSound = alertAlarmSound;
const criticalSound = facilityAlarmSound;

export { 
  logEntrySound, 
  warningSound, 
  criticalSound,
  // Export all available sounds
  alertAlarmSound,
  classicAlarmSound,
  confirmationSound,
  criticalMp3Sound,
  doubleBeepSound,
  elevatorToneSound,
  elevatorSound,
  facilityAlarmSound,
  interfaceHintSound,
  interfaceSound,
  logEntryMp3Sound,
  longPopSound,
  messagePopSound,
  retroConfirmationSound,
  sciFiAlarmSound,
  securityBreachSound,
  slotMachineSound,
  warningMp3Sound
};

interface SoundConfig {
  logEntry: string;
  warning: string;
  warningLoop: boolean;
  critical: string;
  criticalLoop: boolean;
  volume: number;
  poiTypeChange: string;
  poiTypeChangeEnabled: boolean;
  imageCaptured: string;
  imageCapturedEnabled: boolean;
  measureDetected: string;
  measureDetectedEnabled: boolean;
  alertSoundsEnabled: boolean;
  bufferStart: string;
  bufferStartEnabled: boolean;
  bufferComplete: string;
  bufferCompleteEnabled: boolean;
}

class SoundManager {
  private sounds: Map<string, HTMLAudioElement> = new Map();
  private loopingSounds: Map<string, HTMLAudioElement> = new Map();
  private config: SoundConfig = {
    logEntry: logEntrySound,
    warning: warningSound,
    warningLoop: false,
    critical: criticalSound,
    criticalLoop: true,
    volume: 1.0,
    poiTypeChange: longPopSound,
    poiTypeChangeEnabled: true,
    imageCaptured: elevatorToneSound,
    imageCapturedEnabled: true,
    measureDetected: messagePopSound,
    measureDetectedEnabled: true,
    alertSoundsEnabled: true,
    bufferStart: retroConfirmationSound,
    bufferStartEnabled: true,
    bufferComplete: confirmationSound,
    bufferCompleteEnabled: true
  };
  private listeners: Set<() => void> = new Set();
  private initialized: boolean = false;
  private initializationPromise: Promise<void> | null = null;

  constructor() {
    this.loadConfigFromStorage();
    // Delay preload until after config is loaded
    setTimeout(() => this.preloadSounds(), 0);
    
    // Add event listener for user interaction to initialize
    this.addInteractionListener();
  }

  private addInteractionListener() {
    const initOnInteraction = async () => {
      if (!this.initialized) {
        await this.initialize();
      }
    };

    // Try to initialize on any user interaction
    ['click', 'touchstart', 'keydown'].forEach(event => {
      document.addEventListener(event, initOnInteraction, { once: true, capture: true });
    });
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;
    
    // If already initializing, wait for that to complete
    if (this.initializationPromise) {
      return this.initializationPromise;
    }
    
    this.initializationPromise = this.performInitialization();
    await this.initializationPromise;
    this.initializationPromise = null;
  }

  private async performInitialization(): Promise<void> {
    try {
      const AudioContext = (window as any).AudioContext || (window as any).webkitAudioContext;
      if (AudioContext) {
        const context = new AudioContext();
        console.log('[SoundManager] AudioContext state after create:', context.state);
        
        const buffer = context.createBuffer(1, 1, 22050);
        const source = context.createBufferSource();
        source.buffer = buffer;
        source.connect(context.destination);
        if (source.start) {
          source.start(0);
        }
        
        if (context.state === 'suspended') {
          console.log('[SoundManager] Context suspended, calling resume()...');
          await context.resume();
          console.log('[SoundManager] AudioContext state after resume:', context.state);
        }
      }
      
      this.initialized = true;
      console.log('[SoundManager] ✅ Initialized successfully');
      this.preloadSounds();
    } catch (error) {
      this.initialized = false;
      console.error('[SoundManager] ❌ Initialization failed:', error);
    }
  }

  subscribe(listener: () => void) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyListeners() {
    this.listeners.forEach(listener => listener());
  }

  private isValidSoundPath(path: unknown): boolean {
    if (typeof path !== 'string') return false;
    // Must be a local /sounds/ path — reject external URLs or empty strings
    return path.startsWith('/sounds/') && path.length > 8;
  }

  private loadConfigFromStorage() {
    const savedConfig = localStorage.getItem('soundConfig');
    if (savedConfig) {
      try {
        const parsed = JSON.parse(savedConfig);
        // Validate and sanitize sound paths — reject any non-local paths
        // (e.g. from old corrupt placeholder files that stored external URLs)
        const soundPathKeys: (keyof SoundConfig)[] = [
          'logEntry', 'warning', 'critical', 'poiTypeChange',
          'imageCaptured', 'measureDetected', 'bufferStart', 'bufferComplete'
        ];
        for (const key of soundPathKeys) {
          if (parsed[key] !== undefined && !this.isValidSoundPath(parsed[key])) {
            delete parsed[key]; // Fall back to default for invalid paths
          }
        }
        this.config = {
          ...this.config,
          ...parsed
        };
        // Update volume for all sounds
        this.sounds.forEach(sound => {
          sound.volume = this.config.volume;
        });
      } catch (error) {
        // If config is totally corrupt, wipe it and use defaults
        localStorage.removeItem('soundConfig');
      }
    }
  }

  private saveConfigToStorage() {
    try {
      localStorage.setItem('soundConfig', JSON.stringify(this.config));
    } catch (error) {
      // Silent fail
    }
  }

  private preloadSounds() {
    // Clear existing sounds
    this.sounds.clear();
    
    // Preload configured sounds
    const soundsToLoad: [string, string][] = [
      ['logEntry', this.config.logEntry],
      ['warning', this.config.warning],
      ['critical', this.config.critical],
      ['poiTypeChange', this.config.poiTypeChange],
      ['imageCaptured', this.config.imageCaptured],
      ['measureDetected', this.config.measureDetected],
      ['bufferStart', this.config.bufferStart],
      ['bufferComplete', this.config.bufferComplete],
    ];

    soundsToLoad.forEach(([key, url]) => {
      try {
        const audio = new Audio(url);
        audio.preload = 'auto';
        audio.volume = this.config.volume;
        
        // Add error handling for loading
        audio.addEventListener('error', (_e) => {
          // Silent fail
        });
        
        this.sounds.set(key, audio);
      } catch (error) {
        // Silent fail
      }
    });
  }

  setSound(type: keyof SoundConfig, url: string) {
    if (type === 'volume' || type === 'warningLoop' || type === 'criticalLoop' || 
        type === 'poiTypeChangeEnabled' || type === 'imageCapturedEnabled' || type === 'measureDetectedEnabled') return;
    
    (this.config as any)[type] = url;
    
    try {
      const audio = new Audio(url);
      audio.preload = 'auto';
      audio.volume = this.config.volume;
      
      audio.addEventListener('error', (_e) => {
        // Silent fail
      });
      
      this.sounds.set(type, audio);
      this.saveConfigToStorage();
      this.notifyListeners();
    } catch (error) {
      // Silent fail
    }
  }

  setVolume(volume: number) {
    this.config.volume = Math.max(0, Math.min(1, volume));
    this.sounds.forEach(sound => {
      sound.volume = this.config.volume;
    });
    this.loopingSounds.forEach(sound => {
      sound.volume = this.config.volume;
    });
    this.saveConfigToStorage();
    this.notifyListeners();
  }

  // Core play helper — always creates a fresh Audio element (no cloneNode)
  private async playFresh(url: string, volume: number, loop = false): Promise<HTMLAudioElement | null> {
    try {
      const audio = new Audio(url);
      audio.volume = Math.max(0, Math.min(1, volume));
      audio.loop = loop;
      await audio.play();
      if (!loop) {
        audio.addEventListener('ended', () => audio.remove());
      }
      return audio;
    } catch (err: any) {
      console.error('[SoundManager] ❌ playFresh failed for', url, '—', err?.message || err);
      return null;
    }
  }

  async playLogEntry() {
    if (!this.initialized) await this.initialize();
    console.log('[SoundManager] playLogEntry — initialized:', this.initialized, 'volume:', this.config.volume, 'src:', this.config.logEntry);
    await this.playFresh(this.config.logEntry, this.config.volume);
  }

  async playWarning() {
    if (!this.config.alertSoundsEnabled) return;
    if (!this.initialized) await this.initialize();

    if (this.config.warningLoop) {
      if (!this.loopingSounds.has('warning')) {
        const audio = await this.playFresh(this.config.warning, this.config.volume, true);
        if (audio) this.loopingSounds.set('warning', audio);
      }
    } else {
      await this.playFresh(this.config.warning, this.config.volume);
    }
  }

  async playCritical() {
    if (!this.config.alertSoundsEnabled) return;
    if (!this.initialized) await this.initialize();

    if (this.config.criticalLoop) {
      if (!this.loopingSounds.has('critical')) {
        const audio = await this.playFresh(this.config.critical, this.config.volume, true);
        if (audio) this.loopingSounds.set('critical', audio);
      }
    } else {
      await this.playFresh(this.config.critical, this.config.volume);
    }
  }

  async playEmergency() {
    if (!this.initialized) await this.initialize();
    if (!this.loopingSounds.has('emergency')) {
      const audio = await this.playFresh(securityBreachSound, 1.0, true);
      if (audio) this.loopingSounds.set('emergency', audio);
    }
  }

  stopSound(type: 'warning' | 'critical' | 'emergency') {
    const loopSound = this.loopingSounds.get(type);
    if (loopSound) {
      loopSound.pause();
      loopSound.remove();
      this.loopingSounds.delete(type);
    }
  }

  stopEmergency() {
    this.stopSound('emergency');
  }

  setLooping(type: 'warning' | 'critical', enabled: boolean) {
    if (type === 'warning') {
      this.config.warningLoop = enabled;
    } else {
      this.config.criticalLoop = enabled;
    }
    if (!enabled) {
      this.stopSound(type);
    }
    this.saveConfigToStorage();
    this.notifyListeners();
  }

  getConfig(): SoundConfig {
    return { ...this.config };
  }

  async playPOITypeChange() {
    if (!this.config.poiTypeChangeEnabled) return;
    if (!this.initialized) await this.initialize();
    await this.playFresh(this.config.poiTypeChange, this.config.volume);
  }

  async playImageCaptured() {
    if (!this.config.imageCapturedEnabled) return;
    if (!this.initialized) await this.initialize();
    await this.playFresh(this.config.imageCaptured, this.config.volume);
  }

  async playMeasureDetected() {
    if (!this.config.measureDetectedEnabled) return;
    if (!this.initialized) await this.initialize();
    await this.playFresh(this.config.measureDetected, this.config.volume);
  }

  async playBufferStart() {
    if (!this.config.bufferStartEnabled) return;
    if (!this.initialized) await this.initialize();
    await this.playFresh(this.config.bufferStart, this.config.volume);
  }

  async playBufferComplete() {
    if (!this.config.bufferCompleteEnabled) return;
    if (!this.initialized) await this.initialize();
    await this.playFresh(this.config.bufferComplete, this.config.volume);
  }

  setNotificationEnabled(type: 'poiTypeChange' | 'imageCaptured' | 'measureDetected' | 'bufferStart' | 'bufferComplete', enabled: boolean) {
    if (type === 'poiTypeChange') {
      this.config.poiTypeChangeEnabled = enabled;
    } else if (type === 'imageCaptured') {
      this.config.imageCapturedEnabled = enabled;
    } else if (type === 'measureDetected') {
      this.config.measureDetectedEnabled = enabled;
    } else if (type === 'bufferStart') {
      this.config.bufferStartEnabled = enabled;
    } else if (type === 'bufferComplete') {
      this.config.bufferCompleteEnabled = enabled;
    }
    this.saveConfigToStorage();
    this.notifyListeners();
  }

  setAlertSoundsEnabled(enabled: boolean) {
    this.config.alertSoundsEnabled = enabled;
    // Stop any currently playing alert sounds if disabling
    if (!enabled) {
      this.stopSound('warning');
      this.stopSound('critical');
    }
    this.saveConfigToStorage();
    this.notifyListeners();
  }

  async playInterface() {
    if (!this.initialized) await this.initialize();
    await this.playFresh(interfaceSound, this.config.volume);
  }

  // Test all sounds method for debugging
  async testAllSounds() {
    // Test log entry
    await this.playLogEntry();
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // Test warning
    await this.playWarning();
    await new Promise(resolve => setTimeout(resolve, 2000));
    this.stopSound('warning');
    
    // Test critical
    await this.playCritical();
    await new Promise(resolve => setTimeout(resolve, 2000));
    this.stopSound('critical');
  }
}

export const soundManager = new SoundManager();
