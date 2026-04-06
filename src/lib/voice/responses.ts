import type { SupportedLanguage } from './types';

interface LanguageResponses {
  help: string;
  last_measurement: (height: string) => string;
  gps_location: (lat: number, lon: number) => string;
  laser_status: (status: string) => string;
  gps_status: (connected: boolean, fixQuality: string) => string;
  fix_quality: (quality: string, satellites: number) => string;
  speed: (speed: number, unit: string) => string;
  current_time: (time: string) => string;
  clear_warnings: string;
  clear_critical: string;
  volume_up: (volume: number) => string;
  volume_down: (volume: number) => string;
  manual_log: string;
  record_note: string;
  unknown: string;
  no_measurement: string;
  no_gps: string;
  laser_not_connected: string;
  gps_not_connected: string;
  command_failed: string;
  
  capture_image: string;
  clear_alert: string;
  clear_captured_images: string;
  log_measurement: string;
  
  start_logging: string;
  stop_logging: string;
  pause_logging: string;
  mode_manual: string;
  mode_all_data: string;
  mode_detection: string;
  mode_manual_detection: string;
  mode_counter_detection: string;
  clear_all_alerts: string;
  start_gps_trace: string;
  
  toggle_video_recording: string;
  
  accept_detection: string;
  reject_detection: string;
  correct_detection: string;
  test_detection: string;
  
  toggle_envelope: string;
  cycle_vehicle_profile: string;
  
  // Original POI types
  poi_bridge: string;
  poi_trees: string;
  poi_wire: string;
  poi_power_line: string;
  poi_traffic_light: string;
  poi_walkways: string;
  poi_lateral_obstruction: string;
  poi_road: string;
  poi_intersection: string;
  poi_signalization: string;
  poi_railroad: string;
  poi_information: string;
  poi_danger: string;
  poi_important_note: string;
  poi_work_required: string;
  poi_restricted: string;

  // Pre-existing keyboard shortcut POI types (not yet voiced)
  poi_bridge_and_wires: string;
  poi_grade_up: string;
  poi_grade_down: string;
  poi_autoturn_required: string;
  poi_voice_note: string;
  poi_optical_fiber: string;
  poi_passing_lane: string;
  poi_parking: string;
  poi_overhead_structure: string;
  poi_gravel_road: string;
  poi_dead_end: string;
  poi_culvert: string;
  poi_emergency_parking: string;
  poi_roundabout: string;

  // New POI types from Task #17
  poi_power_no_slack: string;
  poi_power_slack: string;
  poi_high_voltage: string;
  poi_communication_cable: string;
  poi_communication_cluster: string;
  poi_pedestrian_bridge: string;
  poi_motorcycle_bridge: string;
  poi_tunnel: string;
  poi_flyover: string;
  poi_traffic_wire: string;
  poi_traffic_mast: string;
  poi_traffic_signalization_truss: string;
  poi_toll_truss: string;
  poi_toll_plaza: string;
  poi_pipe_rack: string;
  poi_light_pole: string;
  poi_railroad_mast: string;
  poi_railroad_truss: string;
  poi_railroad_crossing: string;
  poi_sign_mast: string;
  poi_sign_truss: string;
  poi_vms_truss: string;
  poi_vms_mast: string;
  poi_left_turn: string;
  poi_right_turn: string;
  poi_u_turn: string;
  poi_highway_entrance: string;
  poi_highway_exit: string;
  poi_clear_note: string;
  poi_log_note: string;
  poi_construction: string;
  poi_gate: string;
  poi_pitch: string;
  poi_roll: string;
  poi_unpaved_road: string;

  identity: string;
}

export const responses: Record<SupportedLanguage, LanguageResponses> = {
  'en-US': {
    help: `Voice Commands Available:
📊 Info: last measurement, GPS location, laser status, GPS status, fix quality, speed
📸 Actions: capture image, clear alert, clear images, log measurement
📝 Logging: start logging, stop logging, pause logging, clear all alerts, GPS trace
🎯 Modes: manual mode, all data mode, detection mode, manual detection mode
🎥 Video: toggle video
🤖 AI Detection: accept, reject, correct, test detection
📦 Envelope: toggle envelope, cycle vehicle profile
📍 POI Types: bridge, trees, wire, power line, traffic light, walkways, obstruction, road, intersection, signalization, railroad, tunnel, flyover, toll truss, light pole, and many more
🔊 Audio: volume up, volume down, record note, manual log, clear warnings, clear critical
Say a command or ask for details.`,
    last_measurement: (height: string) => `Last measurement: ${height}`,
    gps_location: (lat: number, lon: number) => `GPS location: latitude ${lat.toFixed(6)}, longitude ${lon.toFixed(6)}`,
    laser_status: (status: string) => `Laser status: ${status}`,
    gps_status: (connected: boolean, fixQuality: string) => 
      `GPS status: ${connected ? 'connected' : 'disconnected'}, fix quality: ${fixQuality}`,
    fix_quality: (quality: string, satellites: number) => 
      `Fix quality: ${quality}, ${satellites} satellites`,
    speed: (speed: number, unit: string) => 
      `Current speed: ${speed.toFixed(1)} ${unit}`,
    current_time: (time: string) => `Current time: ${time}`,
    clear_warnings: "Warnings cleared",
    clear_critical: "Critical alerts cleared",
    volume_up: (volume: number) => `Volume increased to ${Math.round(volume * 100)} percent`,
    volume_down: (volume: number) => `Volume decreased to ${Math.round(volume * 100)} percent`,
    manual_log: "Manual log entry triggered",
    record_note: "Recording voice note",
    unknown: "Sorry, I didn't understand that command.",
    no_measurement: "No measurement available",
    no_gps: "No GPS data available",
    laser_not_connected: "Laser is not connected",
    gps_not_connected: "GPS is not connected",
    command_failed: "Command failed to execute",
    
    capture_image: "Image captured",
    clear_alert: "Alert cleared",
    clear_captured_images: "All images cleared",
    log_measurement: "Measurement logged",
    
    start_logging: "Logging started",
    stop_logging: "Logging stopped",
    pause_logging: "Logging paused",
    mode_manual: "Switched to Manual Mode",
    mode_all_data: "Switched to All Data Mode",
    mode_detection: "Switched to Detection Mode",
    mode_manual_detection: "Switched to Manual Detection Mode",
    mode_counter_detection: "Switched to Counter Detection Mode",
    clear_all_alerts: "All alerts cleared",
    start_gps_trace: "GPS trace started",
    
    toggle_video_recording: "Video recording toggled",
    
    accept_detection: "Detection accepted",
    reject_detection: "Detection rejected",
    correct_detection: "Detection corrected",
    test_detection: "Detection test started",
    
    toggle_envelope: "Envelope monitoring toggled",
    cycle_vehicle_profile: "Vehicle profile cycled",
    
    poi_bridge: "POI type: Bridge",
    poi_trees: "POI type: Trees",
    poi_wire: "POI type: Wire",
    poi_power_line: "POI type: Power Line",
    poi_traffic_light: "POI type: Traffic Light",
    poi_walkways: "POI type: Walkways",
    poi_lateral_obstruction: "POI type: Lateral Obstruction",
    poi_road: "POI type: Road",
    poi_intersection: "POI type: Intersection",
    poi_signalization: "POI type: Signalization",
    poi_railroad: "POI type: Railroad",
    poi_information: "POI type: Information",
    poi_danger: "POI type: Danger",
    poi_important_note: "POI type: Important Note",
    poi_work_required: "POI type: Work Required",
    poi_restricted: "POI type: Restricted",

    poi_bridge_and_wires: "POI type: Bridge and Wires",
    poi_grade_up: "POI type: Grade Up",
    poi_grade_down: "POI type: Grade Down",
    poi_autoturn_required: "POI type: Autoturn Required",
    poi_voice_note: "POI type: Voice Note",
    poi_optical_fiber: "POI type: Optical Fiber",
    poi_passing_lane: "POI type: Passing Lane",
    poi_parking: "POI type: Parking",
    poi_overhead_structure: "POI type: Overhead Structure",
    poi_gravel_road: "POI type: Gravel Road",
    poi_dead_end: "POI type: Dead End",
    poi_culvert: "POI type: Culvert",
    poi_emergency_parking: "POI type: Emergency Parking",
    poi_roundabout: "POI type: Roundabout",

    poi_power_no_slack: "POI type: Power No Slack",
    poi_power_slack: "POI type: Power Slack",
    poi_high_voltage: "POI type: High Voltage",
    poi_communication_cable: "POI type: Communication Cable",
    poi_communication_cluster: "POI type: Communication Cluster",
    poi_pedestrian_bridge: "POI type: Pedestrian Bridge",
    poi_motorcycle_bridge: "POI type: Motorcycle Bridge",
    poi_tunnel: "POI type: Tunnel",
    poi_flyover: "POI type: Flyover",
    poi_traffic_wire: "POI type: Traffic Wire",
    poi_traffic_mast: "POI type: Traffic Mast",
    poi_traffic_signalization_truss: "POI type: Traffic Signalization Truss",
    poi_toll_truss: "POI type: Toll Truss",
    poi_toll_plaza: "POI type: Toll Plaza",
    poi_pipe_rack: "POI type: Pipe Rack",
    poi_light_pole: "POI type: Light Pole",
    poi_railroad_mast: "POI type: Railroad Mast",
    poi_railroad_truss: "POI type: Railroad Truss",
    poi_railroad_crossing: "POI type: Railroad Crossing",
    poi_sign_mast: "POI type: Sign Mast",
    poi_sign_truss: "POI type: Sign Truss",
    poi_vms_truss: "POI type: VMS Truss",
    poi_vms_mast: "POI type: VMS Mast",
    poi_left_turn: "POI type: Left Turn",
    poi_right_turn: "POI type: Right Turn",
    poi_u_turn: "POI type: U-Turn",
    poi_highway_entrance: "POI type: Highway Entrance",
    poi_highway_exit: "POI type: Highway Exit",
    poi_clear_note: "POI type: Clear Note",
    poi_log_note: "POI type: Log Note",
    poi_construction: "POI type: Construction",
    poi_gate: "POI type: Gate",
    poi_pitch: "POI type: Pitch",
    poi_roll: "POI type: Roll",
    poi_unpaved_road: "POI type: Unpaved Road",

    identity: "I am Max Load, SolTec Innovation AI agent"
  },
  'fr-FR': {
    help: `Commandes Vocales Disponibles:
📊 Info: dernière mesure, position GPS, état laser, état GPS, qualité fix, vitesse
📸 Actions: capturer image, effacer alerte, effacer images, enregistrer mesure
📝 Enregistrement: démarrer enregistrement, arrêter enregistrement, pause, effacer toutes alertes, trace GPS
🎯 Modes: mode manuel, mode toutes données, mode détection, mode détection manuelle
🎥 Vidéo: basculer vidéo
🤖 Détection IA: accepter, rejeter, corriger, tester détection
📦 Enveloppe: basculer enveloppe, changer profil véhicule
📍 Types POI: pont, arbres, câble, ligne électrique, feu, tunnel, flyover, péage, poteau lumineux, et plus
🔊 Audio: augmenter volume, baisser volume, enregistrer note, journal manuel, effacer avertissements, effacer critique
Dites une commande ou demandez des détails.`,
    last_measurement: (height: string) => `Dernière mesure: ${height}`,
    gps_location: (lat: number, lon: number) => `Position GPS: latitude ${lat.toFixed(6)}, longitude ${lon.toFixed(6)}`,
    laser_status: (status: string) => `État laser: ${status}`,
    gps_status: (connected: boolean, fixQuality: string) => 
      `État GPS: ${connected ? 'connecté' : 'déconnecté'}, qualité fix: ${fixQuality}`,
    fix_quality: (quality: string, satellites: number) => 
      `Qualité fix: ${quality}, ${satellites} satellites`,
    speed: (speed: number, unit: string) => 
      `Vitesse actuelle: ${speed.toFixed(1)} ${unit}`,
    current_time: (time: string) => `Heure actuelle: ${time}`,
    clear_warnings: "Avertissements effacés",
    clear_critical: "Alertes critiques effacées",
    volume_up: (volume: number) => `Volume augmenté à ${Math.round(volume * 100)} pourcent`,
    volume_down: (volume: number) => `Volume baissé à ${Math.round(volume * 100)} pourcent`,
    manual_log: "Entrée journal manuel déclenchée",
    record_note: "Enregistrement de note vocale",
    unknown: "Désolé, je n'ai pas compris cette commande.",
    no_measurement: "Aucune mesure disponible",
    no_gps: "Aucune donnée GPS disponible",
    laser_not_connected: "Le laser n'est pas connecté",
    gps_not_connected: "Le GPS n'est pas connecté",
    command_failed: "La commande a échoué",
    
    capture_image: "Image capturée",
    clear_alert: "Alerte effacée",
    clear_captured_images: "Toutes les images effacées",
    log_measurement: "Mesure enregistrée",
    
    start_logging: "Enregistrement démarré",
    stop_logging: "Enregistrement arrêté",
    pause_logging: "Enregistrement en pause",
    mode_manual: "Passé en mode manuel",
    mode_all_data: "Passé en mode toutes données",
    mode_detection: "Passé en mode détection",
    mode_manual_detection: "Passé en mode détection manuelle",
    mode_counter_detection: "Passé en mode détection compteur",
    clear_all_alerts: "Toutes les alertes effacées",
    start_gps_trace: "Trace GPS démarrée",
    
    toggle_video_recording: "Enregistrement vidéo basculé",
    
    accept_detection: "Détection acceptée",
    reject_detection: "Détection rejetée",
    correct_detection: "Détection corrigée",
    test_detection: "Test de détection démarré",
    
    toggle_envelope: "Surveillance d'enveloppe basculée",
    cycle_vehicle_profile: "Profil de véhicule changé",
    
    poi_bridge: "Type POI: Pont",
    poi_trees: "Type POI: Arbres",
    poi_wire: "Type POI: Câble",
    poi_power_line: "Type POI: Ligne électrique",
    poi_traffic_light: "Type POI: Feu de circulation",
    poi_walkways: "Type POI: Passages piétons",
    poi_lateral_obstruction: "Type POI: Obstruction latérale",
    poi_road: "Type POI: Route",
    poi_intersection: "Type POI: Intersection",
    poi_signalization: "Type POI: Signalisation",
    poi_railroad: "Type POI: Chemin de fer",
    poi_information: "Type POI: Information",
    poi_danger: "Type POI: Danger",
    poi_important_note: "Type POI: Note importante",
    poi_work_required: "Type POI: Travaux requis",
    poi_restricted: "Type POI: Restreint",

    poi_bridge_and_wires: "Type POI: Pont et fils",
    poi_grade_up: "Type POI: Montée",
    poi_grade_down: "Type POI: Descente",
    poi_autoturn_required: "Type POI: Autoturn requis",
    poi_voice_note: "Type POI: Note vocale",
    poi_optical_fiber: "Type POI: Fibre optique",
    poi_passing_lane: "Type POI: Voie de dépassement",
    poi_parking: "Type POI: Stationnement",
    poi_overhead_structure: "Type POI: Structure aérienne",
    poi_gravel_road: "Type POI: Route en gravier",
    poi_dead_end: "Type POI: Impasse",
    poi_culvert: "Type POI: Ponceau",
    poi_emergency_parking: "Type POI: Arrêt d'urgence",
    poi_roundabout: "Type POI: Rond-point",

    poi_power_no_slack: "Type POI: Ligne tendue",
    poi_power_slack: "Type POI: Ligne avec mou",
    poi_high_voltage: "Type POI: Haute tension",
    poi_communication_cable: "Type POI: Câble de communication",
    poi_communication_cluster: "Type POI: Groupe de communications",
    poi_pedestrian_bridge: "Type POI: Pont piéton",
    poi_motorcycle_bridge: "Type POI: Pont moto",
    poi_tunnel: "Type POI: Tunnel",
    poi_flyover: "Type POI: Survol",
    poi_traffic_wire: "Type POI: Fil de circulation",
    poi_traffic_mast: "Type POI: Mât de circulation",
    poi_traffic_signalization_truss: "Type POI: Treillis de signalisation",
    poi_toll_truss: "Type POI: Portique de péage",
    poi_toll_plaza: "Type POI: Plaza de péage",
    poi_pipe_rack: "Type POI: Support de tuyaux",
    poi_light_pole: "Type POI: Poteau lumineux",
    poi_railroad_mast: "Type POI: Mât ferroviaire",
    poi_railroad_truss: "Type POI: Treillis ferroviaire",
    poi_railroad_crossing: "Type POI: Passage à niveau",
    poi_sign_mast: "Type POI: Mât de panneau",
    poi_sign_truss: "Type POI: Portique de panneau",
    poi_vms_truss: "Type POI: Portique PMV",
    poi_vms_mast: "Type POI: Mât PMV",
    poi_left_turn: "Type POI: Virage à gauche",
    poi_right_turn: "Type POI: Virage à droite",
    poi_u_turn: "Type POI: Demi-tour",
    poi_highway_entrance: "Type POI: Entrée d'autoroute",
    poi_highway_exit: "Type POI: Sortie d'autoroute",
    poi_clear_note: "Type POI: Note effacée",
    poi_log_note: "Type POI: Note de journal",
    poi_construction: "Type POI: Construction",
    poi_gate: "Type POI: Portail",
    poi_pitch: "Type POI: Tangage",
    poi_roll: "Type POI: Roulis",
    poi_unpaved_road: "Type POI: Route non pavée",

    identity: "Je suis Max Load, l'agent IA de SolTec Innovation"
  },
  'es-ES': {
    help: `Comandos de Voz Disponibles:
📊 Info: última medición, ubicación GPS, estado láser, estado GPS, calidad fix, velocidad
📸 Acciones: capturar imagen, borrar alerta, borrar imágenes, registrar medición
📝 Registro: iniciar registro, detener registro, pausar registro, borrar todas alertas, rastreo GPS
🎯 Modos: modo manual, modo todos datos, modo detección, modo detección manual
🎥 Video: alternar video
🤖 Detección IA: aceptar, rechazar, corregir, probar detección
📦 Envolvente: alternar envolvente, cambiar perfil vehículo
📍 Tipos POI: puente, árboles, cable, línea eléctrica, semáforo, túnel, paso elevado, peaje, poste de luz, y más
🔊 Audio: subir volumen, bajar volumen, grabar nota, registro manual, borrar advertencias, borrar crítico
Diga un comando o pida detalles.`,
    last_measurement: (height: string) => `Última medición: ${height}`,
    gps_location: (lat: number, lon: number) => `Ubicación GPS: latitud ${lat.toFixed(6)}, longitud ${lon.toFixed(6)}`,
    laser_status: (status: string) => `Estado láser: ${status}`,
    gps_status: (connected: boolean, fixQuality: string) => 
      `Estado GPS: ${connected ? 'conectado' : 'desconectado'}, calidad fix: ${fixQuality}`,
    fix_quality: (quality: string, satellites: number) => 
      `Calidad fix: ${quality}, ${satellites} satélites`,
    speed: (speed: number, unit: string) => 
      `Velocidad actual: ${speed.toFixed(1)} ${unit}`,
    current_time: (time: string) => `Hora actual: ${time}`,
    clear_warnings: "Advertencias borradas",
    clear_critical: "Alertas críticas borradas",
    volume_up: (volume: number) => `Volumen subido a ${Math.round(volume * 100)} porciento`,
    volume_down: (volume: number) => `Volumen bajado a ${Math.round(volume * 100)} porciento`,
    manual_log: "Registro manual activado",
    record_note: "Grabando nota de voz",
    unknown: "Lo siento, no entendí ese comando.",
    no_measurement: "No hay medición disponible",
    no_gps: "No hay datos GPS disponibles",
    laser_not_connected: "El láser no está conectado",
    gps_not_connected: "El GPS no está conectado",
    command_failed: "El comando falló",
    
    capture_image: "Imagen capturada",
    clear_alert: "Alerta borrada",
    clear_captured_images: "Todas las imágenes borradas",
    log_measurement: "Medición registrada",
    
    start_logging: "Registro iniciado",
    stop_logging: "Registro detenido",
    pause_logging: "Registro pausado",
    mode_manual: "Cambiado a modo manual",
    mode_all_data: "Cambiado a modo todos los datos",
    mode_detection: "Cambiado a modo detección",
    mode_manual_detection: "Cambiado a modo detección manual",
    mode_counter_detection: "Cambiado a modo detección contador",
    clear_all_alerts: "Todas las alertas borradas",
    start_gps_trace: "Rastreo GPS iniciado",
    
    toggle_video_recording: "Grabación de video alternada",
    
    accept_detection: "Detección aceptada",
    reject_detection: "Detección rechazada",
    correct_detection: "Detección corregida",
    test_detection: "Prueba de detección iniciada",
    
    toggle_envelope: "Monitoreo de envolvente alternado",
    cycle_vehicle_profile: "Perfil de vehículo cambiado",
    
    poi_bridge: "Tipo POI: Puente",
    poi_trees: "Tipo POI: Árboles",
    poi_wire: "Tipo POI: Cable",
    poi_power_line: "Tipo POI: Línea eléctrica",
    poi_traffic_light: "Tipo POI: Semáforo",
    poi_walkways: "Tipo POI: Pasos peatonales",
    poi_lateral_obstruction: "Tipo POI: Obstrucción lateral",
    poi_road: "Tipo POI: Carretera",
    poi_intersection: "Tipo POI: Intersección",
    poi_signalization: "Tipo POI: Señalización",
    poi_railroad: "Tipo POI: Ferrocarril",
    poi_information: "Tipo POI: Información",
    poi_danger: "Tipo POI: Peligro",
    poi_important_note: "Tipo POI: Nota importante",
    poi_work_required: "Tipo POI: Trabajo requerido",
    poi_restricted: "Tipo POI: Restringido",

    poi_bridge_and_wires: "Tipo POI: Puente y cables",
    poi_grade_up: "Tipo POI: Pendiente ascendente",
    poi_grade_down: "Tipo POI: Pendiente descendente",
    poi_autoturn_required: "Tipo POI: Autogiro requerido",
    poi_voice_note: "Tipo POI: Nota de voz",
    poi_optical_fiber: "Tipo POI: Fibra óptica",
    poi_passing_lane: "Tipo POI: Carril de adelantamiento",
    poi_parking: "Tipo POI: Estacionamiento",
    poi_overhead_structure: "Tipo POI: Estructura aérea",
    poi_gravel_road: "Tipo POI: Camino de grava",
    poi_dead_end: "Tipo POI: Sin salida",
    poi_culvert: "Tipo POI: Alcantarilla",
    poi_emergency_parking: "Tipo POI: Parada de emergencia",
    poi_roundabout: "Tipo POI: Rotonda",

    poi_power_no_slack: "Tipo POI: Línea tensa",
    poi_power_slack: "Tipo POI: Línea floja",
    poi_high_voltage: "Tipo POI: Alta tensión",
    poi_communication_cable: "Tipo POI: Cable de comunicación",
    poi_communication_cluster: "Tipo POI: Grupo de comunicaciones",
    poi_pedestrian_bridge: "Tipo POI: Puente peatonal",
    poi_motorcycle_bridge: "Tipo POI: Puente para motos",
    poi_tunnel: "Tipo POI: Túnel",
    poi_flyover: "Tipo POI: Paso elevado",
    poi_traffic_wire: "Tipo POI: Cable de tráfico",
    poi_traffic_mast: "Tipo POI: Mástil de tráfico",
    poi_traffic_signalization_truss: "Tipo POI: Celosía de señalización",
    poi_toll_truss: "Tipo POI: Pórtico de peaje",
    poi_toll_plaza: "Tipo POI: Plaza de peaje",
    poi_pipe_rack: "Tipo POI: Soporte de tuberías",
    poi_light_pole: "Tipo POI: Poste de luz",
    poi_railroad_mast: "Tipo POI: Mástil ferroviario",
    poi_railroad_truss: "Tipo POI: Celosía ferroviaria",
    poi_railroad_crossing: "Tipo POI: Paso a nivel",
    poi_sign_mast: "Tipo POI: Mástil de señal",
    poi_sign_truss: "Tipo POI: Pórtico de señal",
    poi_vms_truss: "Tipo POI: Pórtico PMV",
    poi_vms_mast: "Tipo POI: Mástil PMV",
    poi_left_turn: "Tipo POI: Giro a la izquierda",
    poi_right_turn: "Tipo POI: Giro a la derecha",
    poi_u_turn: "Tipo POI: Giro en U",
    poi_highway_entrance: "Tipo POI: Entrada de autopista",
    poi_highway_exit: "Tipo POI: Salida de autopista",
    poi_clear_note: "Tipo POI: Nota limpia",
    poi_log_note: "Tipo POI: Nota de registro",
    poi_construction: "Tipo POI: Construcción",
    poi_gate: "Tipo POI: Portón",
    poi_pitch: "Tipo POI: Cabeceo",
    poi_roll: "Tipo POI: Balanceo",
    poi_unpaved_road: "Tipo POI: Camino sin pavimentar",

    identity: "Soy Max Load, agente de IA de SolTec Innovation"
  }
};

export function getResponse(
  language: SupportedLanguage,
  key: keyof LanguageResponses,
  ...args: any[]
): string {
  const response = responses[language][key];
  if (typeof response === 'function') {
    return (response as (...args: any[]) => string)(...args);
  }
  return response as string;
}
