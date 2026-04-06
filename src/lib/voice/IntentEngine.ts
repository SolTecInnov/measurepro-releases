import type { VoiceCommandIntent, CommandMatch, SupportedLanguage } from './types';

function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

function similarity(a: string, b: string): number {
  const maxLength = Math.max(a.length, b.length);
  if (maxLength === 0) return 1;
  
  const distance = levenshteinDistance(a.toLowerCase(), b.toLowerCase());
  return 1 - (distance / maxLength);
}

const commandPhrases: Record<SupportedLanguage, Record<VoiceCommandIntent, string[]>> = {
  'en-US': {
    last_measurement: ['last measurement', 'last measure', 'last reading', 'previous measurement', 'what was the last measurement'],
    gps_location: ['gps location', 'gps position', 'location', 'position', 'where am i', 'coordinates'],
    laser_status: ['laser status', 'laser state', 'is laser connected', 'laser connection'],
    gps_status: ['gps status', 'gps state', 'is gps connected', 'gps connection'],
    fix_quality: ['fix quality', 'signal quality', 'satellite fix', 'fix'],
    speed: ['speed', 'current speed', 'how fast', 'velocity'],
    current_time: ['what time is it', 'time', 'current time', 'tell me the time', 'what\'s the time'],
    clear_warnings: ['clear warnings', 'clear warning', 'dismiss warnings', 'remove warnings'],
    clear_critical: ['clear critical', 'clear critical alerts', 'dismiss critical', 'remove critical'],
    volume_up: ['volume up', 'increase volume', 'louder', 'turn up'],
    volume_down: ['volume down', 'decrease volume', 'quieter', 'turn down'],
    manual_log: ['manual log', 'log now', 'create log', 'log entry', 'save measurement'],
    record_note: ['record note', 'voice note', 'add note', 'take note'],
    capture_image: ['capture image', 'take photo', 'snap picture', 'capture'],
    clear_alert: ['clear alert', 'dismiss alert', 'remove alert'],
    clear_captured_images: ['clear images', 'delete all images', 'remove all photos', 'clear captured images'],
    log_measurement: ['log measurement', 'save measurement', 'log data', 'record measurement'],
    start_logging: ['start logging', 'begin logging', 'start recording data'],
    stop_logging: ['stop logging', 'end logging', 'stop recording'],
    pause_logging: ['pause logging', 'pause recording'],
    mode_manual: ['manual mode', 'switch to manual', 'manual logging'],
    mode_all_data: ['all data mode', 'log all data', 'switch to all data'],
    mode_detection: ['detection mode', 'ai mode', 'switch to detection'],
    mode_manual_detection: ['manual detection mode', 'manual detection'],
    mode_counter_detection: ['counter detection', 'counter detection mode', 'switch to counter detection'],
    clear_all_alerts: ['clear all alerts', 'dismiss all alerts', 'remove all warnings'],
    start_gps_trace: ['start gps trace', 'begin gps tracking', 'start trace'],
    toggle_video_recording: ['toggle video', 'start video', 'stop video', 'record video'],
    accept_detection: ['accept detection', 'accept', 'confirm detection'],
    reject_detection: ['reject detection', 'reject', 'deny detection'],
    correct_detection: ['correct detection', 'fix detection', 'correct'],
    test_detection: ['test detection', 'test', 'test ai'],
    toggle_envelope: ['toggle envelope', 'envelope monitoring', 'toggle clearance'],
    cycle_vehicle_profile: ['cycle profile', 'next vehicle', 'change vehicle', 'switch vehicle'],
    // Original POI types
    poi_bridge: ['bridge', 'select bridge', 'set bridge'],
    poi_trees: ['trees', 'tree', 'select trees'],
    poi_wire: ['wire', 'select wire', 'set wire'],
    poi_power_line: ['power line', 'powerline', 'select power line'],
    poi_traffic_light: ['traffic light', 'traffic signal', 'select traffic light'],
    poi_walkways: ['walkway', 'walkways', 'pedestrian', 'select walkway'],
    poi_lateral_obstruction: ['lateral obstruction', 'obstruction', 'select obstruction'],
    poi_road: ['road', 'select road', 'set road'],
    poi_intersection: ['intersection', 'select intersection', 'crossroads'],
    poi_signalization: ['signalization', 'sign', 'signage', 'select sign'],
    poi_railroad: ['railroad', 'railway', 'train', 'train track', 'select railroad'],
    poi_information: ['information', 'info', 'select information'],
    poi_danger: ['danger', 'hazard', 'warning sign', 'select danger'],
    poi_important_note: ['important note', 'note', 'important', 'select note'],
    poi_work_required: ['work required', 'maintenance', 'repair', 'select work required'],
    poi_restricted: ['restricted', 'no access', 'select restricted'],
    // Pre-existing keyboard shortcut POI types
    poi_bridge_and_wires: ['bridge and wires', 'bridge wires', 'select bridge and wires'],
    poi_grade_up: ['grade up', 'uphill grade', 'steep uphill', 'select grade up'],
    poi_grade_down: ['grade down', 'downhill grade', 'steep downhill', 'select grade down'],
    poi_autoturn_required: ['autoturn required', 'autoturn', 'select autoturn'],
    poi_voice_note: ['voice note poi', 'add voice note', 'select voice note'],
    poi_optical_fiber: ['optical fiber', 'fiber optic', 'fibre', 'select optical fiber'],
    poi_passing_lane: ['passing lane', 'overtaking lane', 'select passing lane'],
    poi_parking: ['parking', 'parking area', 'select parking'],
    poi_overhead_structure: ['overhead structure', 'overhead', 'structure overhead', 'select overhead structure'],
    poi_gravel_road: ['gravel road', 'gravel', 'unpaved gravel', 'select gravel road'],
    poi_dead_end: ['dead end', 'no through road', 'cul de sac', 'select dead end'],
    poi_culvert: ['culvert', 'select culvert', 'drainage culvert'],
    poi_emergency_parking: ['emergency parking', 'emergency stop', 'select emergency parking'],
    poi_roundabout: ['roundabout', 'traffic circle', 'rotary', 'select roundabout'],
    // New POI types — Task #17
    poi_power_no_slack: ['power no slack', 'no slack', 'tight power line', 'select power no slack'],
    poi_power_slack: ['power slack', 'slack wire', 'sagging power line', 'select power slack'],
    poi_high_voltage: ['high voltage', 'hv line', 'high tension', 'select high voltage'],
    poi_communication_cable: ['communication cable', 'comm cable', 'telecom cable', 'select communication cable'],
    poi_communication_cluster: ['communication cluster', 'comm cluster', 'cable cluster', 'select communication cluster'],
    poi_pedestrian_bridge: ['pedestrian bridge', 'foot bridge', 'walking bridge', 'select pedestrian bridge'],
    poi_motorcycle_bridge: ['motorcycle bridge', 'bike bridge', 'select motorcycle bridge'],
    poi_tunnel: ['tunnel', 'underpass tunnel', 'select tunnel'],
    poi_flyover: ['flyover', 'fly over', 'overpass flyover', 'select flyover'],
    poi_traffic_wire: ['traffic wire', 'signal wire', 'select traffic wire'],
    poi_traffic_mast: ['traffic mast', 'signal mast', 'select traffic mast'],
    poi_traffic_signalization_truss: ['traffic signalization truss', 'signal truss', 'traffic truss', 'select traffic truss'],
    poi_toll_truss: ['toll truss', 'toll gantry', 'select toll truss'],
    poi_toll_plaza: ['toll plaza', 'toll booth', 'tollgate', 'select toll plaza'],
    poi_pipe_rack: ['pipe rack', 'pipeline rack', 'select pipe rack'],
    poi_light_pole: ['light pole', 'street light', 'lamp post', 'select light pole'],
    poi_railroad_mast: ['railroad mast', 'railway mast', 'train mast', 'select railroad mast'],
    poi_railroad_truss: ['railroad truss', 'railway truss', 'train truss', 'select railroad truss'],
    poi_railroad_crossing: ['railroad crossing', 'level crossing', 'train crossing', 'select railroad crossing'],
    poi_sign_mast: ['sign mast', 'road sign mast', 'select sign mast'],
    poi_sign_truss: ['sign truss', 'road sign truss', 'sign gantry', 'select sign truss'],
    poi_vms_truss: ['vms truss', 'variable message sign truss', 'select vms truss'],
    poi_vms_mast: ['vms mast', 'variable message sign mast', 'select vms mast'],
    poi_left_turn: ['left turn', 'turn left', 'select left turn'],
    poi_right_turn: ['right turn', 'turn right', 'select right turn'],
    poi_u_turn: ['u turn', 'u-turn', 'uturn', 'turnaround', 'select u-turn'],
    poi_highway_entrance: ['highway entrance', 'motorway entrance', 'on ramp', 'select highway entrance'],
    poi_highway_exit: ['highway exit', 'motorway exit', 'off ramp', 'select highway exit'],
    poi_clear_note: ['clear note', 'erase note', 'remove note', 'select clear note'],
    poi_log_note: ['log note', 'add log note', 'select log note'],
    poi_construction: ['construction', 'construction zone', 'road works', 'select construction'],
    poi_gate: ['gate', 'access gate', 'barrier gate', 'select gate'],
    poi_pitch: ['pitch', 'pitch measurement', 'select pitch'],
    poi_roll: ['roll', 'roll measurement', 'side slope', 'select roll'],
    poi_unpaved_road: ['unpaved road', 'dirt road', 'unsealed road', 'select unpaved road'],
    identity: ['who are you', 'what is your name', 'who am i talking to', 'what\'s your name', 'identify yourself', 'who is this'],
    unknown: []
  },
  'fr-FR': {
    last_measurement: ['dernière mesure', 'dernière lecture', 'mesure précédente', 'quelle était la dernière mesure'],
    gps_location: ['position gps', 'localisation gps', 'position', 'où suis-je', 'coordonnées'],
    laser_status: ['état laser', 'statut laser', 'le laser est-il connecté', 'connexion laser'],
    gps_status: ['état gps', 'statut gps', 'le gps est-il connecté', 'connexion gps'],
    fix_quality: ['qualité fix', 'qualité signal', 'fix satellite', 'fix'],
    speed: ['vitesse', 'vitesse actuelle', 'à quelle vitesse', 'vélocité'],
    current_time: ['quelle heure est-il', 'heure', 'heure actuelle', 'dis-moi l\'heure', 'il est quelle heure'],
    clear_warnings: ['effacer avertissements', 'effacer avertissement', 'supprimer avertissements'],
    clear_critical: ['effacer critique', 'effacer alertes critiques', 'supprimer critique'],
    volume_up: ['augmenter volume', 'volume plus fort', 'plus fort', 'monter le son'],
    volume_down: ['baisser volume', 'volume moins fort', 'moins fort', 'baisser le son'],
    manual_log: ['journal manuel', 'enregistrer maintenant', 'créer journal', 'entrée journal'],
    record_note: ['enregistrer note', 'note vocale', 'ajouter note', 'prendre note'],
    capture_image: ['capturer image', 'prendre photo', 'faire photo', 'capturer'],
    clear_alert: ['effacer alerte', 'supprimer alerte', 'enlever alerte'],
    clear_captured_images: ['effacer images', 'supprimer toutes les images', 'enlever toutes les photos', 'effacer images capturées'],
    log_measurement: ['enregistrer mesure', 'sauvegarder mesure', 'enregistrer données', 'enregistrer la mesure'],
    start_logging: ['démarrer enregistrement', 'commencer enregistrement', 'démarrer enregistrement données'],
    stop_logging: ['arrêter enregistrement', 'terminer enregistrement', 'arrêter enregistrement'],
    pause_logging: ['pause enregistrement', 'pause'],
    mode_manual: ['mode manuel', 'basculer en manuel', 'enregistrement manuel'],
    mode_all_data: ['mode toutes données', 'enregistrer toutes données', 'basculer toutes données'],
    mode_detection: ['mode détection', 'mode ia', 'basculer détection'],
    mode_manual_detection: ['mode détection manuelle', 'détection manuelle'],
    mode_counter_detection: ['détection compteur', 'mode détection compteur', 'basculer détection compteur'],
    clear_all_alerts: ['effacer toutes alertes', 'supprimer toutes alertes', 'enlever tous avertissements'],
    start_gps_trace: ['démarrer trace gps', 'commencer suivi gps', 'démarrer trace'],
    toggle_video_recording: ['basculer vidéo', 'démarrer vidéo', 'arrêter vidéo', 'enregistrer vidéo'],
    accept_detection: ['accepter détection', 'accepter', 'confirmer détection'],
    reject_detection: ['rejeter détection', 'rejeter', 'refuser détection'],
    correct_detection: ['corriger détection', 'corriger', 'rectifier détection'],
    test_detection: ['tester détection', 'tester', 'tester ia'],
    toggle_envelope: ['basculer enveloppe', 'surveillance enveloppe', 'basculer dégagement'],
    cycle_vehicle_profile: ['changer profil', 'véhicule suivant', 'changer véhicule', 'basculer véhicule'],
    poi_bridge: ['pont', 'sélectionner pont', 'définir pont'],
    poi_trees: ['arbres', 'arbre', 'sélectionner arbres'],
    poi_wire: ['fil', 'sélectionner fil', 'définir fil'],
    poi_power_line: ['ligne électrique', 'ligne haute tension', 'sélectionner ligne électrique'],
    poi_traffic_light: ['feu de circulation', 'feu tricolore', 'sélectionner feu'],
    poi_walkways: ['passage piéton', 'passages piétons', 'piéton', 'sélectionner passage'],
    poi_lateral_obstruction: ['obstruction latérale', 'obstruction', 'sélectionner obstruction'],
    poi_road: ['route', 'sélectionner route', 'définir route'],
    poi_intersection: ['intersection', 'sélectionner intersection', 'carrefour'],
    poi_signalization: ['signalisation', 'panneau', 'sélectionner panneau'],
    poi_railroad: ['chemin de fer', 'voie ferrée', 'train', 'sélectionner chemin de fer'],
    poi_information: ['information', 'info', 'sélectionner information'],
    poi_danger: ['danger', 'risque', 'panneau danger', 'sélectionner danger'],
    poi_important_note: ['note importante', 'note', 'important', 'sélectionner note'],
    poi_work_required: ['travaux requis', 'maintenance', 'réparation', 'sélectionner travaux'],
    poi_restricted: ['accès interdit', 'restreint', 'sélectionner restreint'],
    poi_bridge_and_wires: ['pont et fils', 'pont câbles', 'sélectionner pont et fils'],
    poi_grade_up: ['montée', 'pente montante', 'sélectionner montée'],
    poi_grade_down: ['descente', 'pente descendante', 'sélectionner descente'],
    poi_autoturn_required: ['autoturn requis', 'autotour', 'sélectionner autoturn'],
    poi_voice_note: ['note vocale poi', 'ajouter note vocale', 'sélectionner note vocale'],
    poi_optical_fiber: ['fibre optique', 'câble fibre', 'sélectionner fibre optique'],
    poi_passing_lane: ['voie de dépassement', 'voie rapide', 'sélectionner voie dépassement'],
    poi_parking: ['stationnement', 'parking', 'sélectionner stationnement'],
    poi_overhead_structure: ['structure aérienne', 'structure en hauteur', 'sélectionner structure aérienne'],
    poi_gravel_road: ['route en gravier', 'chemin gravier', 'sélectionner route gravier'],
    poi_dead_end: ['impasse', 'voie sans issue', 'sélectionner impasse'],
    poi_culvert: ['ponceau', 'buse', 'sélectionner ponceau'],
    poi_emergency_parking: ['arrêt urgence', 'stationnement urgence', 'sélectionner arrêt urgence'],
    poi_roundabout: ['rond-point', 'giratoire', 'sélectionner rond-point'],
    poi_power_no_slack: ['ligne tendue', 'sans mou', 'sélectionner ligne tendue'],
    poi_power_slack: ['ligne avec mou', 'câble détendu', 'sélectionner ligne mou'],
    poi_high_voltage: ['haute tension', 'ligne haute tension', 'sélectionner haute tension'],
    poi_communication_cable: ['câble communication', 'câble télécom', 'sélectionner câble communication'],
    poi_communication_cluster: ['groupe communications', 'faisceau câbles', 'sélectionner groupe communications'],
    poi_pedestrian_bridge: ['passerelle piétonne', 'pont piéton', 'sélectionner passerelle'],
    poi_motorcycle_bridge: ['pont moto', 'pont deux roues', 'sélectionner pont moto'],
    poi_tunnel: ['tunnel', 'sélectionner tunnel'],
    poi_flyover: ['survol', 'passage aérien', 'sélectionner survol'],
    poi_traffic_wire: ['fil circulation', 'câble signal', 'sélectionner fil circulation'],
    poi_traffic_mast: ['mât circulation', 'mât signal', 'sélectionner mât circulation'],
    poi_traffic_signalization_truss: ['portique signalisation', 'treillis signal', 'sélectionner portique signal'],
    poi_toll_truss: ['portique péage', 'gantry péage', 'sélectionner portique péage'],
    poi_toll_plaza: ['plaza péage', 'péage', 'sélectionner plaza péage'],
    poi_pipe_rack: ['support tuyaux', 'rack tuyauterie', 'sélectionner support tuyaux'],
    poi_light_pole: ['poteau lumineux', 'lampadaire', 'sélectionner poteau lumineux'],
    poi_railroad_mast: ['mât ferroviaire', 'mât chemin de fer', 'sélectionner mât ferroviaire'],
    poi_railroad_truss: ['treillis ferroviaire', 'portique ferroviaire', 'sélectionner treillis ferroviaire'],
    poi_railroad_crossing: ['passage à niveau', 'croisement ferroviaire', 'sélectionner passage à niveau'],
    poi_sign_mast: ['mât panneau', 'mât de signalisation', 'sélectionner mât panneau'],
    poi_sign_truss: ['portique panneau', 'portique signalisation', 'sélectionner portique panneau'],
    poi_vms_truss: ['portique pmv', 'portique message variable', 'sélectionner portique pmv'],
    poi_vms_mast: ['mât pmv', 'mât message variable', 'sélectionner mât pmv'],
    poi_left_turn: ['virage gauche', 'tourner gauche', 'sélectionner virage gauche'],
    poi_right_turn: ['virage droite', 'tourner droite', 'sélectionner virage droite'],
    poi_u_turn: ['demi-tour', 'sélectionner demi-tour'],
    poi_highway_entrance: ['entrée autoroute', 'bretelle entrée', 'sélectionner entrée autoroute'],
    poi_highway_exit: ['sortie autoroute', 'bretelle sortie', 'sélectionner sortie autoroute'],
    poi_clear_note: ['effacer note', 'supprimer note', 'sélectionner effacer note'],
    poi_log_note: ['note journal', 'ajouter note journal', 'sélectionner note journal'],
    poi_construction: ['construction', 'zone travaux', 'chantier', 'sélectionner construction'],
    poi_gate: ['portail', 'barrière', 'sélectionner portail'],
    poi_pitch: ['tangage', 'sélectionner tangage'],
    poi_roll: ['roulis', 'sélectionner roulis'],
    poi_unpaved_road: ['route non pavée', 'chemin terre', 'sélectionner route non pavée'],
    identity: ['qui es-tu', 'quel est ton nom', 'comment tu t\'appelles', 'qui parle', 'identifie-toi', 'qui est-ce'],
    unknown: []
  },
  'es-ES': {
    last_measurement: ['última medición', 'última lectura', 'medición anterior', 'cuál fue la última medición'],
    gps_location: ['ubicación gps', 'posición gps', 'ubicación', 'dónde estoy', 'coordenadas'],
    laser_status: ['estado láser', 'estado del láser', 'está conectado el láser', 'conexión láser'],
    gps_status: ['estado gps', 'estado del gps', 'está conectado el gps', 'conexión gps'],
    fix_quality: ['calidad fix', 'calidad señal', 'fix satélite', 'fix'],
    speed: ['velocidad', 'velocidad actual', 'qué tan rápido', 'rapidez'],
    current_time: ['qué hora es', 'hora', 'hora actual', 'dime la hora', 'cuál es la hora'],
    clear_warnings: ['borrar advertencias', 'borrar advertencia', 'eliminar advertencias'],
    clear_critical: ['borrar crítico', 'borrar alertas críticas', 'eliminar crítico'],
    volume_up: ['subir volumen', 'volumen más alto', 'más alto', 'subir sonido'],
    volume_down: ['bajar volumen', 'volumen más bajo', 'más bajo', 'bajar sonido'],
    manual_log: ['registro manual', 'registrar ahora', 'crear registro', 'entrada registro'],
    record_note: ['grabar nota', 'nota de voz', 'añadir nota', 'tomar nota'],
    capture_image: ['capturar imagen', 'tomar foto', 'hacer foto', 'capturar'],
    clear_alert: ['borrar alerta', 'eliminar alerta', 'quitar alerta'],
    clear_captured_images: ['borrar imágenes', 'eliminar todas las imágenes', 'quitar todas las fotos', 'borrar imágenes capturadas'],
    log_measurement: ['registrar medición', 'guardar medición', 'registrar datos', 'grabar medición'],
    start_logging: ['iniciar registro', 'comenzar registro', 'iniciar grabación de datos'],
    stop_logging: ['detener registro', 'terminar registro', 'parar grabación'],
    pause_logging: ['pausar registro', 'pausar grabación'],
    mode_manual: ['modo manual', 'cambiar a manual', 'registro manual'],
    mode_all_data: ['modo todos datos', 'registrar todos datos', 'cambiar a todos datos'],
    mode_detection: ['modo detección', 'modo ia', 'cambiar a detección'],
    mode_manual_detection: ['modo detección manual', 'detección manual'],
    mode_counter_detection: ['detección contador', 'modo detección contador', 'cambiar a detección contador'],
    clear_all_alerts: ['borrar todas alertas', 'eliminar todas alertas', 'quitar todas advertencias'],
    start_gps_trace: ['iniciar rastreo gps', 'comenzar seguimiento gps', 'iniciar rastreo'],
    toggle_video_recording: ['alternar vídeo', 'iniciar vídeo', 'detener vídeo', 'grabar vídeo'],
    accept_detection: ['aceptar detección', 'aceptar', 'confirmar detección'],
    reject_detection: ['rechazar detección', 'rechazar', 'denegar detección'],
    correct_detection: ['corregir detección', 'corregir', 'rectificar detección'],
    test_detection: ['probar detección', 'probar', 'probar ia'],
    toggle_envelope: ['alternar envolvente', 'monitoreo envolvente', 'alternar despeje'],
    cycle_vehicle_profile: ['cambiar perfil', 'siguiente vehículo', 'cambiar vehículo', 'alternar vehículo'],
    poi_bridge: ['puente', 'seleccionar puente', 'establecer puente'],
    poi_trees: ['árboles', 'árbol', 'seleccionar árboles'],
    poi_wire: ['cable', 'seleccionar cable', 'establecer cable'],
    poi_power_line: ['línea eléctrica', 'línea de alta tensión', 'seleccionar línea eléctrica'],
    poi_traffic_light: ['semáforo', 'señal de tráfico', 'seleccionar semáforo'],
    poi_walkways: ['paso peatonal', 'pasos peatonales', 'peatón', 'seleccionar paso'],
    poi_lateral_obstruction: ['obstrucción lateral', 'obstrucción', 'seleccionar obstrucción'],
    poi_road: ['carretera', 'seleccionar carretera', 'establecer carretera'],
    poi_intersection: ['intersección', 'seleccionar intersección', 'cruce'],
    poi_signalization: ['señalización', 'señal', 'cartel', 'seleccionar señal'],
    poi_railroad: ['ferrocarril', 'vía férrea', 'tren', 'seleccionar ferrocarril'],
    poi_information: ['información', 'info', 'seleccionar información'],
    poi_danger: ['peligro', 'riesgo', 'señal de peligro', 'seleccionar peligro'],
    poi_important_note: ['nota importante', 'nota', 'importante', 'seleccionar nota'],
    poi_work_required: ['trabajo requerido', 'mantenimiento', 'reparación', 'seleccionar trabajo'],
    poi_restricted: ['restringido', 'acceso prohibido', 'seleccionar restringido'],
    poi_bridge_and_wires: ['puente y cables', 'puente cables', 'seleccionar puente y cables'],
    poi_grade_up: ['pendiente ascendente', 'subida', 'seleccionar subida'],
    poi_grade_down: ['pendiente descendente', 'bajada', 'seleccionar bajada'],
    poi_autoturn_required: ['autogiro requerido', 'autogiro', 'seleccionar autogiro'],
    poi_voice_note: ['nota de voz poi', 'añadir nota de voz', 'seleccionar nota de voz'],
    poi_optical_fiber: ['fibra óptica', 'cable fibra', 'seleccionar fibra óptica'],
    poi_passing_lane: ['carril de adelantamiento', 'carril rápido', 'seleccionar carril adelantamiento'],
    poi_parking: ['estacionamiento', 'parking', 'seleccionar estacionamiento'],
    poi_overhead_structure: ['estructura aérea', 'estructura elevada', 'seleccionar estructura aérea'],
    poi_gravel_road: ['camino de grava', 'camino tierra', 'seleccionar camino grava'],
    poi_dead_end: ['sin salida', 'callejón sin salida', 'seleccionar sin salida'],
    poi_culvert: ['alcantarilla', 'drenaje', 'seleccionar alcantarilla'],
    poi_emergency_parking: ['parada de emergencia', 'estacionamiento emergencia', 'seleccionar emergencia'],
    poi_roundabout: ['rotonda', 'glorieta', 'seleccionar rotonda'],
    poi_power_no_slack: ['línea tensa', 'sin holgura', 'seleccionar línea tensa'],
    poi_power_slack: ['línea floja', 'cable colgante', 'seleccionar línea floja'],
    poi_high_voltage: ['alta tensión', 'alta voltaje', 'seleccionar alta tensión'],
    poi_communication_cable: ['cable de comunicación', 'cable telecom', 'seleccionar cable comunicación'],
    poi_communication_cluster: ['grupo de comunicaciones', 'racimo cables', 'seleccionar grupo comunicaciones'],
    poi_pedestrian_bridge: ['puente peatonal', 'pasarela peatonal', 'seleccionar puente peatonal'],
    poi_motorcycle_bridge: ['puente para motos', 'puente moto', 'seleccionar puente moto'],
    poi_tunnel: ['túnel', 'seleccionar túnel'],
    poi_flyover: ['paso elevado', 'viaducto', 'seleccionar paso elevado'],
    poi_traffic_wire: ['cable de tráfico', 'cable señal', 'seleccionar cable tráfico'],
    poi_traffic_mast: ['mástil de tráfico', 'mástil señal', 'seleccionar mástil tráfico'],
    poi_traffic_signalization_truss: ['pórtico de señalización', 'celosía señal', 'seleccionar pórtico señal'],
    poi_toll_truss: ['pórtico de peaje', 'gantry peaje', 'seleccionar pórtico peaje'],
    poi_toll_plaza: ['plaza de peaje', 'caseta de peaje', 'seleccionar plaza peaje'],
    poi_pipe_rack: ['soporte de tuberías', 'rack tuberías', 'seleccionar soporte tuberías'],
    poi_light_pole: ['poste de luz', 'farola', 'seleccionar poste de luz'],
    poi_railroad_mast: ['mástil ferroviario', 'mástil tren', 'seleccionar mástil ferroviario'],
    poi_railroad_truss: ['celosía ferroviaria', 'pórtico ferroviario', 'seleccionar celosía ferroviaria'],
    poi_railroad_crossing: ['paso a nivel', 'cruce ferroviario', 'seleccionar paso a nivel'],
    poi_sign_mast: ['mástil de señal', 'poste señal', 'seleccionar mástil señal'],
    poi_sign_truss: ['pórtico de señal', 'pórtico cartel', 'seleccionar pórtico señal'],
    poi_vms_truss: ['pórtico pmv', 'pórtico mensaje variable', 'seleccionar pórtico pmv'],
    poi_vms_mast: ['mástil pmv', 'mástil mensaje variable', 'seleccionar mástil pmv'],
    poi_left_turn: ['giro a la izquierda', 'girar izquierda', 'seleccionar giro izquierda'],
    poi_right_turn: ['giro a la derecha', 'girar derecha', 'seleccionar giro derecha'],
    poi_u_turn: ['giro en u', 'media vuelta', 'seleccionar giro en u'],
    poi_highway_entrance: ['entrada de autopista', 'acceso autopista', 'seleccionar entrada autopista'],
    poi_highway_exit: ['salida de autopista', 'desvío autopista', 'seleccionar salida autopista'],
    poi_clear_note: ['borrar nota', 'eliminar nota', 'seleccionar borrar nota'],
    poi_log_note: ['nota de registro', 'añadir nota registro', 'seleccionar nota registro'],
    poi_construction: ['construcción', 'zona de obras', 'obras', 'seleccionar construcción'],
    poi_gate: ['portón', 'barrera', 'puerta', 'seleccionar portón'],
    poi_pitch: ['cabeceo', 'seleccionar cabeceo'],
    poi_roll: ['balanceo', 'seleccionar balanceo'],
    poi_unpaved_road: ['camino sin pavimentar', 'tierra camino', 'seleccionar camino sin pavimentar'],
    identity: ['quién eres', 'cómo te llamas', 'cuál es tu nombre', 'quién habla', 'identifícate', 'quién es'],
    unknown: []
  }
};

export class IntentEngine {
  private confidenceThreshold: number = 0.6;

  recognizeIntent(text: string, language: SupportedLanguage): CommandMatch {
    const normalizedText = text.toLowerCase().trim();
    const phrases = commandPhrases[language];

    let bestMatch: CommandMatch = {
      intent: 'unknown',
      confidence: 0,
      language,
      originalText: text
    };

    for (const [intent, patterns] of Object.entries(phrases)) {
      if (intent === 'unknown') continue;

      for (const pattern of patterns) {
        if (normalizedText === pattern.toLowerCase()) {
          return {
            intent: intent as VoiceCommandIntent,
            confidence: 1.0,
            language,
            originalText: text
          };
        }

        if (normalizedText.includes(pattern.toLowerCase()) || pattern.toLowerCase().includes(normalizedText)) {
          const conf = 0.9;
          if (conf > bestMatch.confidence) {
            bestMatch = {
              intent: intent as VoiceCommandIntent,
              confidence: conf,
              language,
              originalText: text
            };
          }
        }

        const sim = similarity(normalizedText, pattern);
        if (sim > bestMatch.confidence && sim >= this.confidenceThreshold) {
          bestMatch = {
            intent: intent as VoiceCommandIntent,
            confidence: sim,
            language,
            originalText: text
          };
        }
      }
    }

    return bestMatch;
  }

  setConfidenceThreshold(threshold: number): void {
    this.confidenceThreshold = Math.max(0, Math.min(1, threshold));
  }

  getConfidenceThreshold(): number {
    return this.confidenceThreshold;
  }
}
