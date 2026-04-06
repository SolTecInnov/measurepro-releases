export type SupportedLanguage = 'en-US' | 'fr-FR' | 'es-ES';

export type VoiceCommandIntent = 
  // Query Commands
  | 'last_measurement' 
  | 'gps_location' 
  | 'laser_status' 
  | 'gps_status' 
  | 'fix_quality' 
  | 'speed'
  | 'current_time' 
  // General Actions
  | 'capture_image'
  | 'clear_alert'
  | 'clear_captured_images'
  | 'log_measurement'
  // Logging Controls
  | 'start_logging'
  | 'stop_logging'
  | 'pause_logging'
  | 'mode_manual'
  | 'mode_all_data'
  | 'mode_detection'
  | 'mode_manual_detection'
  | 'mode_counter_detection'
  | 'clear_all_alerts'
  | 'start_gps_trace'
  // Video Recording
  | 'toggle_video_recording'
  // AI Detection
  | 'accept_detection'
  | 'reject_detection'
  | 'correct_detection'
  | 'test_detection'
  // Envelope Clearance
  | 'toggle_envelope'
  | 'cycle_vehicle_profile'
  // POI Types — original set
  | 'poi_bridge'
  | 'poi_trees'
  | 'poi_wire'
  | 'poi_power_line'
  | 'poi_traffic_light'
  | 'poi_walkways'
  | 'poi_lateral_obstruction'
  | 'poi_road'
  | 'poi_intersection'
  | 'poi_signalization'
  | 'poi_railroad'
  | 'poi_information'
  | 'poi_danger'
  | 'poi_important_note'
  | 'poi_work_required'
  | 'poi_restricted'
  // POI Types — pre-existing keyboard shortcuts not yet in voice
  | 'poi_bridge_and_wires'
  | 'poi_grade_up'
  | 'poi_grade_down'
  | 'poi_autoturn_required'
  | 'poi_voice_note'
  | 'poi_optical_fiber'
  | 'poi_passing_lane'
  | 'poi_parking'
  | 'poi_overhead_structure'
  | 'poi_gravel_road'
  | 'poi_dead_end'
  | 'poi_culvert'
  | 'poi_emergency_parking'
  | 'poi_roundabout'
  // POI Types — new from Task #17
  | 'poi_power_no_slack'
  | 'poi_power_slack'
  | 'poi_high_voltage'
  | 'poi_communication_cable'
  | 'poi_communication_cluster'
  | 'poi_pedestrian_bridge'
  | 'poi_motorcycle_bridge'
  | 'poi_tunnel'
  | 'poi_flyover'
  | 'poi_traffic_wire'
  | 'poi_traffic_mast'
  | 'poi_traffic_signalization_truss'
  | 'poi_toll_truss'
  | 'poi_toll_plaza'
  | 'poi_pipe_rack'
  | 'poi_light_pole'
  | 'poi_railroad_mast'
  | 'poi_railroad_truss'
  | 'poi_railroad_crossing'
  | 'poi_sign_mast'
  | 'poi_sign_truss'
  | 'poi_vms_truss'
  | 'poi_vms_mast'
  | 'poi_left_turn'
  | 'poi_right_turn'
  | 'poi_u_turn'
  | 'poi_highway_entrance'
  | 'poi_highway_exit'
  | 'poi_clear_note'
  | 'poi_log_note'
  | 'poi_construction'
  | 'poi_gate'
  | 'poi_pitch'
  | 'poi_roll'
  | 'poi_unpaved_road'
  // Audio/Voice Controls
  | 'clear_warnings' 
  | 'clear_critical' 
  | 'volume_up' 
  | 'volume_down' 
  | 'manual_log' 
  | 'record_note'
  // Identity
  | 'identity'
  | 'unknown';

export interface VoiceNote {
  id: string;
  measurementId: string;
  blob: Blob;
  mimeType: string;
  duration: number;
  language: SupportedLanguage;
  createdAt: string;
}

export interface CommandMatch {
  intent: VoiceCommandIntent;
  confidence: number;
  language: SupportedLanguage;
  originalText: string;
}

export type VoiceAssistantState = 'idle' | 'listening' | 'processing' | 'responding' | 'error';

export interface VoiceAssistantEvent {
  type: VoiceAssistantState;
  data?: any;
  error?: Error;
}
