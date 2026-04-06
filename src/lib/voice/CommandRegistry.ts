import type { VoiceCommandIntent, SupportedLanguage } from './types';
import { getResponse } from './responses';
import { useGPSStore } from '../stores/gpsStore';
import { useLaserStore } from '../laser';
import { useSettingsStore } from '../settings';
import { useSerialStore } from '../stores/serialStore';
import { toast } from 'sonner';
import { triggerShortcutByKeys } from './triggerKeyboardShortcut';

export type CommandHandler = (language: SupportedLanguage) => Promise<string>;

export class CommandRegistry {
  private handlers: Map<VoiceCommandIntent, CommandHandler> = new Map();
  private volumeChangeCallback: ((volume: number) => void) | null = null;
  private manualLogCallback: (() => void) | null = null;
  private recordNoteCallback: (() => void) | null = null;
  private clearWarningsCallback: (() => void) | null = null;
  private clearCriticalCallback: (() => void) | null = null;

  constructor() {
    this.registerDefaultHandlers();
  }

  private registerDefaultHandlers(): void {
    this.register('last_measurement', async (lang) => {
      const { lastMeasurement } = useSerialStore.getState();
      if (!lastMeasurement || lastMeasurement === '--') {
        return getResponse(lang, 'no_measurement');
      }
      return getResponse(lang, 'last_measurement', lastMeasurement);
    });

    this.register('gps_location', async (lang) => {
      const { connected, data } = useGPSStore.getState();
      if (!connected) return getResponse(lang, 'gps_not_connected');
      if (data.latitude === 0 && data.longitude === 0) return getResponse(lang, 'no_gps');
      return getResponse(lang, 'gps_location', data.latitude, data.longitude);
    });

    this.register('laser_status', async (lang) => {
      const { connected } = useLaserStore.getState();
      const status = connected ? 
        (lang === 'en-US' ? 'connected' : lang === 'fr-FR' ? 'connecté' : 'conectado') :
        (lang === 'en-US' ? 'disconnected' : lang === 'fr-FR' ? 'déconnecté' : 'desconectado');
      return getResponse(lang, 'laser_status', status);
    });

    this.register('gps_status', async (lang) => {
      const { connected, data } = useGPSStore.getState();
      return getResponse(lang, 'gps_status', connected, data.fixQuality);
    });

    this.register('fix_quality', async (lang) => {
      const { data } = useGPSStore.getState();
      return getResponse(lang, 'fix_quality', data.fixQuality, data.satellites);
    });

    this.register('speed', async (lang) => {
      const { data } = useGPSStore.getState();
      const { displaySettings } = useSettingsStore.getState();
      let speed = data.speed;
      let unit = 'km/h';
      if (displaySettings.units === 'imperial') {
        speed = speed * 0.621371;
        unit = 'mph';
      }
      return getResponse(lang, 'speed', speed, unit);
    });

    this.register('current_time', async (lang) => {
      const now = new Date();
      const timeString = now.toLocaleTimeString(lang, { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: lang === 'en-US'
      });
      return getResponse(lang, 'current_time', timeString);
    });

    this.register('clear_warnings', async (lang) => {
      this.clearWarningsCallback?.();
      toast.success(getResponse(lang, 'clear_warnings'));
      return getResponse(lang, 'clear_warnings');
    });

    this.register('clear_critical', async (lang) => {
      this.clearCriticalCallback?.();
      toast.success(getResponse(lang, 'clear_critical'));
      return getResponse(lang, 'clear_critical');
    });

    this.register('volume_up', async (lang) => {
      const newVolume = Math.min(1.0, (this.getCurrentVolume() || 0.8) + 0.1);
      this.volumeChangeCallback?.(newVolume);
      return getResponse(lang, 'volume_up', newVolume);
    });

    this.register('volume_down', async (lang) => {
      const newVolume = Math.max(0, (this.getCurrentVolume() || 0.8) - 0.1);
      this.volumeChangeCallback?.(newVolume);
      return getResponse(lang, 'volume_down', newVolume);
    });

    this.register('manual_log', async (lang) => {
      this.manualLogCallback?.();
      toast.success(getResponse(lang, 'manual_log'));
      return getResponse(lang, 'manual_log');
    });

    this.register('record_note', async (lang) => {
      this.recordNoteCallback?.();
      return getResponse(lang, 'record_note');
    });

    // General actions
    this.register('capture_image', async (lang) => {
      triggerShortcutByKeys('1', { alt: true });
      return getResponse(lang, 'capture_image');
    });

    this.register('clear_alert', async (lang) => {
      triggerShortcutByKeys('2', { alt: true });
      return getResponse(lang, 'clear_alert');
    });

    this.register('clear_captured_images', async (lang) => {
      triggerShortcutByKeys('C', { alt: true });
      return getResponse(lang, 'clear_captured_images');
    });

    this.register('log_measurement', async (lang) => {
      triggerShortcutByKeys('G', { alt: true });
      return getResponse(lang, 'log_measurement');
    });

    // Logging controls
    this.register('start_logging', async (lang) => {
      triggerShortcutByKeys('3', { alt: true });
      return getResponse(lang, 'start_logging');
    });

    this.register('stop_logging', async (lang) => {
      triggerShortcutByKeys('4', { alt: true });
      return getResponse(lang, 'stop_logging');
    });

    this.register('pause_logging', async (lang) => {
      triggerShortcutByKeys('5', { alt: true });
      return getResponse(lang, 'pause_logging');
    });

    this.register('mode_manual', async (lang) => {
      triggerShortcutByKeys('m', { alt: true });
      return getResponse(lang, 'mode_manual');
    });

    this.register('mode_all_data', async (lang) => {
      triggerShortcutByKeys('a', { alt: true });
      return getResponse(lang, 'mode_all_data');
    });

    this.register('mode_detection', async (lang) => {
      triggerShortcutByKeys('d', { alt: true });
      return getResponse(lang, 'mode_detection');
    });

    this.register('mode_manual_detection', async (lang) => {
      triggerShortcutByKeys('s', { alt: true, shift: true });
      return getResponse(lang, 'mode_manual_detection');
    });

    this.register('mode_counter_detection', async (lang) => {
      toast.info('Counter detection mode has no keyboard shortcut yet');
      return getResponse(lang, 'mode_counter_detection');
    });

    this.register('clear_all_alerts', async (lang) => {
      triggerShortcutByKeys('z', { alt: true });
      return getResponse(lang, 'clear_all_alerts');
    });

    this.register('start_gps_trace', async (lang) => {
      triggerShortcutByKeys('6', { alt: true });
      return getResponse(lang, 'start_gps_trace');
    });

    this.register('toggle_video_recording', async (lang) => {
      triggerShortcutByKeys('V', { alt: true });
      return getResponse(lang, 'toggle_video_recording');
    });

    // AI detection
    this.register('accept_detection', async (lang) => {
      triggerShortcutByKeys('7', { alt: true });
      return getResponse(lang, 'accept_detection');
    });

    this.register('reject_detection', async (lang) => {
      triggerShortcutByKeys('8', { alt: true });
      return getResponse(lang, 'reject_detection');
    });

    this.register('correct_detection', async (lang) => {
      triggerShortcutByKeys('9', { alt: true });
      return getResponse(lang, 'correct_detection');
    });

    this.register('test_detection', async (lang) => {
      triggerShortcutByKeys('0', { alt: true });
      return getResponse(lang, 'test_detection');
    });

    // Envelope
    this.register('toggle_envelope', async (lang) => {
      triggerShortcutByKeys('E', { alt: true, shift: true });
      return getResponse(lang, 'toggle_envelope');
    });

    this.register('cycle_vehicle_profile', async (lang) => {
      triggerShortcutByKeys('P', { alt: true, shift: true });
      return getResponse(lang, 'cycle_vehicle_profile');
    });

    // Original POI types
    this.register('poi_bridge', async (lang) => {
      triggerShortcutByKeys('b', { alt: true });
      return getResponse(lang, 'poi_bridge');
    });

    this.register('poi_trees', async (lang) => {
      triggerShortcutByKeys('t', { alt: true });
      return getResponse(lang, 'poi_trees');
    });

    this.register('poi_wire', async (lang) => {
      triggerShortcutByKeys('w', { alt: true });
      return getResponse(lang, 'poi_wire');
    });

    this.register('poi_power_line', async (lang) => {
      triggerShortcutByKeys('p', { alt: true });
      return getResponse(lang, 'poi_power_line');
    });

    this.register('poi_traffic_light', async (lang) => {
      triggerShortcutByKeys('l', { alt: true });
      return getResponse(lang, 'poi_traffic_light');
    });

    this.register('poi_walkways', async (lang) => {
      triggerShortcutByKeys('k', { alt: true });
      return getResponse(lang, 'poi_walkways');
    });

    this.register('poi_lateral_obstruction', async (lang) => {
      triggerShortcutByKeys('o', { alt: true });
      return getResponse(lang, 'poi_lateral_obstruction');
    });

    this.register('poi_road', async (lang) => {
      triggerShortcutByKeys('r', { alt: true });
      return getResponse(lang, 'poi_road');
    });

    this.register('poi_intersection', async (lang) => {
      triggerShortcutByKeys('i', { alt: true });
      return getResponse(lang, 'poi_intersection');
    });

    this.register('poi_signalization', async (lang) => {
      triggerShortcutByKeys('u', { alt: true });
      return getResponse(lang, 'poi_signalization');
    });

    this.register('poi_railroad', async (lang) => {
      triggerShortcutByKeys('q', { alt: true });
      return getResponse(lang, 'poi_railroad');
    });

    this.register('poi_information', async (lang) => {
      triggerShortcutByKeys('n', { alt: true });
      return getResponse(lang, 'poi_information');
    });

    this.register('poi_danger', async (lang) => {
      triggerShortcutByKeys('h', { alt: true });
      return getResponse(lang, 'poi_danger');
    });

    this.register('poi_important_note', async (lang) => {
      triggerShortcutByKeys('j', { alt: true });
      return getResponse(lang, 'poi_important_note');
    });

    this.register('poi_work_required', async (lang) => {
      triggerShortcutByKeys('f', { alt: true });
      return getResponse(lang, 'poi_work_required');
    });

    this.register('poi_restricted', async (lang) => {
      triggerShortcutByKeys('x', { alt: true });
      return getResponse(lang, 'poi_restricted');
    });

    // Pre-existing keyboard shortcut POI types (now voiced)
    this.register('poi_bridge_and_wires', async (lang) => {
      triggerShortcutByKeys('B', { alt: true, shift: true });
      return getResponse(lang, 'poi_bridge_and_wires');
    });

    this.register('poi_grade_up', async (lang) => {
      triggerShortcutByKeys('U', { alt: true, shift: true });
      return getResponse(lang, 'poi_grade_up');
    });

    this.register('poi_grade_down', async (lang) => {
      triggerShortcutByKeys('D', { alt: true, shift: true });
      return getResponse(lang, 'poi_grade_down');
    });

    this.register('poi_autoturn_required', async (lang) => {
      triggerShortcutByKeys('A', { ctrl: true, alt: true });
      return getResponse(lang, 'poi_autoturn_required');
    });

    this.register('poi_voice_note', async (lang) => {
      triggerShortcutByKeys('N', { alt: true, shift: true });
      return getResponse(lang, 'poi_voice_note');
    });

    this.register('poi_optical_fiber', async (lang) => {
      triggerShortcutByKeys('F', { alt: true, shift: true });
      return getResponse(lang, 'poi_optical_fiber');
    });

    this.register('poi_passing_lane', async (lang) => {
      triggerShortcutByKeys('L', { alt: true, shift: true });
      return getResponse(lang, 'poi_passing_lane');
    });

    this.register('poi_parking', async (lang) => {
      triggerShortcutByKeys('K', { alt: true, shift: true });
      return getResponse(lang, 'poi_parking');
    });

    this.register('poi_overhead_structure', async (lang) => {
      triggerShortcutByKeys('O', { alt: true, shift: true });
      return getResponse(lang, 'poi_overhead_structure');
    });

    this.register('poi_gravel_road', async (lang) => {
      triggerShortcutByKeys('G', { alt: true, shift: true });
      return getResponse(lang, 'poi_gravel_road');
    });

    this.register('poi_dead_end', async (lang) => {
      triggerShortcutByKeys('e', { alt: true });
      return getResponse(lang, 'poi_dead_end');
    });

    this.register('poi_culvert', async (lang) => {
      triggerShortcutByKeys('c', { alt: true });
      return getResponse(lang, 'poi_culvert');
    });

    this.register('poi_emergency_parking', async (lang) => {
      triggerShortcutByKeys('R', { alt: true, shift: true });
      return getResponse(lang, 'poi_emergency_parking');
    });

    this.register('poi_roundabout', async (lang) => {
      triggerShortcutByKeys('y', { alt: true });
      return getResponse(lang, 'poi_roundabout');
    });

    // New POI types — Task #17
    this.register('poi_power_no_slack', async (lang) => {
      triggerShortcutByKeys('H', { alt: true, shift: true });
      return getResponse(lang, 'poi_power_no_slack');
    });

    this.register('poi_power_slack', async (lang) => {
      triggerShortcutByKeys('V', { alt: true, shift: true });
      return getResponse(lang, 'poi_power_slack');
    });

    this.register('poi_high_voltage', async (lang) => {
      triggerShortcutByKeys('Q', { alt: true, shift: true });
      return getResponse(lang, 'poi_high_voltage');
    });

    this.register('poi_communication_cable', async (lang) => {
      triggerShortcutByKeys('C', { ctrl: true, alt: true });
      return getResponse(lang, 'poi_communication_cable');
    });

    this.register('poi_communication_cluster', async (lang) => {
      triggerShortcutByKeys('D', { ctrl: true, alt: true });
      return getResponse(lang, 'poi_communication_cluster');
    });

    this.register('poi_pedestrian_bridge', async (lang) => {
      triggerShortcutByKeys('P', { ctrl: true, alt: true });
      return getResponse(lang, 'poi_pedestrian_bridge');
    });

    this.register('poi_motorcycle_bridge', async (lang) => {
      triggerShortcutByKeys('M', { ctrl: true, alt: true });
      return getResponse(lang, 'poi_motorcycle_bridge');
    });

    this.register('poi_tunnel', async (lang) => {
      triggerShortcutByKeys('T', { ctrl: true, alt: true });
      return getResponse(lang, 'poi_tunnel');
    });

    this.register('poi_flyover', async (lang) => {
      triggerShortcutByKeys('F', { ctrl: true, alt: true });
      return getResponse(lang, 'poi_flyover');
    });

    this.register('poi_traffic_wire', async (lang) => {
      triggerShortcutByKeys('W', { ctrl: true, alt: true });
      return getResponse(lang, 'poi_traffic_wire');
    });

    this.register('poi_traffic_mast', async (lang) => {
      triggerShortcutByKeys('X', { ctrl: true, alt: true });
      return getResponse(lang, 'poi_traffic_mast');
    });

    this.register('poi_traffic_signalization_truss', async (lang) => {
      triggerShortcutByKeys('S', { ctrl: true, alt: true });
      return getResponse(lang, 'poi_traffic_signalization_truss');
    });

    this.register('poi_toll_truss', async (lang) => {
      triggerShortcutByKeys('L', { ctrl: true, alt: true });
      return getResponse(lang, 'poi_toll_truss');
    });

    this.register('poi_toll_plaza', async (lang) => {
      triggerShortcutByKeys('O', { ctrl: true, alt: true });
      return getResponse(lang, 'poi_toll_plaza');
    });

    this.register('poi_pipe_rack', async (lang) => {
      triggerShortcutByKeys('R', { ctrl: true, alt: true });
      return getResponse(lang, 'poi_pipe_rack');
    });

    this.register('poi_light_pole', async (lang) => {
      triggerShortcutByKeys('I', { ctrl: true, alt: true });
      return getResponse(lang, 'poi_light_pole');
    });

    this.register('poi_railroad_mast', async (lang) => {
      triggerShortcutByKeys('J', { ctrl: true, alt: true });
      return getResponse(lang, 'poi_railroad_mast');
    });

    this.register('poi_railroad_truss', async (lang) => {
      triggerShortcutByKeys('K', { ctrl: true, alt: true });
      return getResponse(lang, 'poi_railroad_truss');
    });

    this.register('poi_railroad_crossing', async (lang) => {
      triggerShortcutByKeys('Q', { ctrl: true, alt: true });
      return getResponse(lang, 'poi_railroad_crossing');
    });

    this.register('poi_sign_mast', async (lang) => {
      triggerShortcutByKeys('G', { ctrl: true, alt: true });
      return getResponse(lang, 'poi_sign_mast');
    });

    this.register('poi_sign_truss', async (lang) => {
      triggerShortcutByKeys('H', { ctrl: true, alt: true });
      return getResponse(lang, 'poi_sign_truss');
    });

    this.register('poi_vms_truss', async (lang) => {
      triggerShortcutByKeys('V', { ctrl: true, alt: true });
      return getResponse(lang, 'poi_vms_truss');
    });

    this.register('poi_vms_mast', async (lang) => {
      triggerShortcutByKeys('B', { ctrl: true, alt: true });
      return getResponse(lang, 'poi_vms_mast');
    });

    this.register('poi_left_turn', async (lang) => {
      triggerShortcutByKeys('I', { alt: true, shift: true });
      return getResponse(lang, 'poi_left_turn');
    });

    this.register('poi_right_turn', async (lang) => {
      triggerShortcutByKeys('J', { alt: true, shift: true });
      return getResponse(lang, 'poi_right_turn');
    });

    this.register('poi_u_turn', async (lang) => {
      triggerShortcutByKeys('T', { alt: true, shift: true });
      return getResponse(lang, 'poi_u_turn');
    });

    this.register('poi_highway_entrance', async (lang) => {
      triggerShortcutByKeys('W', { alt: true, shift: true });
      return getResponse(lang, 'poi_highway_entrance');
    });

    this.register('poi_highway_exit', async (lang) => {
      triggerShortcutByKeys('X', { alt: true, shift: true });
      return getResponse(lang, 'poi_highway_exit');
    });

    this.register('poi_clear_note', async (lang) => {
      triggerShortcutByKeys('Z', { alt: true, shift: true });
      return getResponse(lang, 'poi_clear_note');
    });

    this.register('poi_log_note', async (lang) => {
      triggerShortcutByKeys('N', { ctrl: true, alt: true });
      return getResponse(lang, 'poi_log_note');
    });

    this.register('poi_construction', async (lang) => {
      triggerShortcutByKeys('E', { ctrl: true, alt: true });
      return getResponse(lang, 'poi_construction');
    });

    this.register('poi_gate', async (lang) => {
      triggerShortcutByKeys('U', { ctrl: true, alt: true });
      return getResponse(lang, 'poi_gate');
    });

    this.register('poi_pitch', async (lang) => {
      triggerShortcutByKeys('Y', { ctrl: true, alt: true });
      return getResponse(lang, 'poi_pitch');
    });

    this.register('poi_roll', async (lang) => {
      triggerShortcutByKeys('Z', { ctrl: true, alt: true });
      return getResponse(lang, 'poi_roll');
    });

    this.register('poi_unpaved_road', async (lang) => {
      triggerShortcutByKeys('2', { ctrl: true, alt: true });
      return getResponse(lang, 'poi_unpaved_road');
    });

    // Identity
    this.register('identity', async (lang) => {
      return getResponse(lang, 'identity');
    });

    // Unknown command
    this.register('unknown', async (lang) => {
      return getResponse(lang, 'unknown');
    });
  }

  register(intent: VoiceCommandIntent, handler: CommandHandler): void {
    this.handlers.set(intent, handler);
  }

  async execute(intent: VoiceCommandIntent, language: SupportedLanguage): Promise<string> {
    const handler = this.handlers.get(intent);
    
    if (!handler) {
      return getResponse(language, 'unknown');
    }

    try {
      const response = await handler(language);
      return response;
    } catch (error) {
      return getResponse(language, 'command_failed');
    }
  }

  onVolumeChange(callback: (volume: number) => void): void {
    this.volumeChangeCallback = callback;
  }

  onManualLog(callback: () => void): void {
    this.manualLogCallback = callback;
  }

  onRecordNote(callback: () => void): void {
    this.recordNoteCallback = callback;
  }

  onClearWarnings(callback: () => void): void {
    this.clearWarningsCallback = callback;
  }

  onClearCritical(callback: () => void): void {
    this.clearCriticalCallback = callback;
  }

  private getCurrentVolume(): number {
    const saved = localStorage.getItem('voice_synthesizer_volume');
    return saved ? parseFloat(saved) : 0.8;
  }
}
