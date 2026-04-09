import { create } from 'zustand';
import { Grid as Bridge2, Trees as Tree, Cable, Zap, TrafficCone as TrafficSign, Landmark, Verified as Barrier, Loader as Road, CrosshairIcon, SignpostBig, Train, Info, AlertTriangle, FileText, Wrench, ShieldAlert, Layers, TrendingUp, TrendingDown, RotateCw, Mic, Wifi, ArrowRightLeft, ParkingCircle, Home, Mountain, XOctagon, Cylinder, ParkingSquare, Circle, ZapOff, Radio, ServerCrash, Footprints, Signal, Antenna, RectangleHorizontal, Bike, MonitorSpeaker, Monitor, Tag, Flag, Lightbulb, SquareStack, Warehouse, CornerDownLeft, CornerDownRight, RefreshCw, StickyNote, BookOpen, HardHat, DoorOpen, Activity, AlignHorizontalJustifyStart, AlignHorizontalJustifyEnd, Waypoints } from 'lucide-react';
import { soundManager } from './sounds';

export type POIType = 
  | 'bridge' 
  | 'tree' 
  | 'wire' 
  | 'powerLine' 
  | 'trafficLight' 
  | 'overpass'
  | 'lateralObstruction'
  | 'road'
  | 'intersection'
  | 'signalization'
  | 'railroad'
  | 'information'
  | 'danger'
  | 'importantNote'
  | 'workRequired'
  | 'restricted'
  | 'bridgeAndWires'
  | 'gradeUp'
  | 'gradeDown'
  | 'grade10to12Up'
  | 'grade10to12Down'
  | 'grade12to14Up'
  | 'grade12to14Down'
  | 'grade14PlusUp'
  | 'grade14PlusDown'
  | 'autoturnRequired'
  | 'voiceNote'
  | 'opticalFiber'
  | 'passingLane'
  | 'parking'
  | 'overheadStructure'
  | 'gravelRoad'
  | 'deadEnd'
  | 'culvert'
  | 'emergencyParking'
  | 'roundabout'
  | 'powerNoSlack'
  | 'powerSlack'
  | 'highVoltage'
  | 'communicationCable'
  | 'communicationCluster'
  | 'pedestrianBridge'
  | 'trafficWire'
  | 'trafficMast'
  | 'trafficSignalizationTruss'
  | 'tollTruss'
  | 'motorcycleBridge'
  | 'railroadMast'
  | 'railroadTruss'
  | 'signMast'
  | 'signTruss'
  | 'vmsTruss'
  | 'vmsMast'
  | 'lightPole'
  | 'tunnel'
  | 'pipeRack'
  | 'tollPlaza'
  | 'flyover'
  | 'leftTurn'
  | 'rightTurn'
  | 'uTurn'
  | 'clearNote'
  | 'railroadCrossing'
  | 'unpavedRoad'
  | 'logNote'
  | 'construction'
  | 'gate'
  | 'pitch'
  | 'roll'
  | 'highwayEntrance'
  | 'highwayExit';

export interface POITypeConfig {
  type: POIType | '';
  label: string;
  color: string;
  bgColor: string;
  icon: React.ComponentType<any>;
}

export const POI_TYPES: POITypeConfig[] = [
  { type: '', label: 'None', color: 'text-gray-400', bgColor: 'bg-gray-400/20', icon: CrosshairIcon },
  // Sorted alphabetically by label
  { type: 'autoturnRequired', label: 'Autoturn Required', color: 'text-sky-400', bgColor: 'bg-sky-400/20', icon: RotateCw },
  { type: 'bridge', label: 'Bridge', color: 'text-blue-400', bgColor: 'bg-blue-400/20', icon: Bridge2 },
  { type: 'bridgeAndWires', label: 'Bridge & Wires', color: 'text-cyan-400', bgColor: 'bg-cyan-400/20', icon: Layers },
  { type: 'clearNote', label: 'Clear Note', color: 'text-gray-400', bgColor: 'bg-gray-400/20', icon: StickyNote },
  { type: 'communicationCable', label: 'Communication Cable', color: 'text-violet-400', bgColor: 'bg-violet-400/20', icon: Radio },
  { type: 'communicationCluster', label: 'Communication Cluster', color: 'text-violet-600', bgColor: 'bg-violet-600/20', icon: ServerCrash },
  { type: 'construction', label: 'Construction', color: 'text-orange-500', bgColor: 'bg-orange-500/20', icon: HardHat },
  { type: 'culvert', label: 'Culvert', color: 'text-gray-500', bgColor: 'bg-gray-500/20', icon: Cylinder },
  { type: 'danger', label: 'Danger', color: 'text-rose-400', bgColor: 'bg-rose-400/20', icon: AlertTriangle },
  { type: 'deadEnd', label: 'Dead End', color: 'text-red-500', bgColor: 'bg-red-500/20', icon: XOctagon },
  { type: 'emergencyParking', label: 'Emergency Parking', color: 'text-orange-600', bgColor: 'bg-orange-600/20', icon: ParkingSquare },
  { type: 'flyover', label: 'Flyover', color: 'text-cyan-400', bgColor: 'bg-cyan-400/20', icon: Waypoints },
  { type: 'gate', label: 'Gate', color: 'text-gray-500', bgColor: 'bg-gray-500/20', icon: DoorOpen },
  { type: 'grade10to12Down', label: 'Grade 10-12% DOWN', color: 'text-blue-500', bgColor: 'bg-blue-500/20', icon: TrendingDown },
  { type: 'grade10to12Up', label: 'Grade 10-12% UP', color: 'text-blue-400', bgColor: 'bg-blue-400/20', icon: TrendingUp },
  { type: 'grade12to14Down', label: 'Grade 12-14% DOWN', color: 'text-amber-500', bgColor: 'bg-amber-500/20', icon: TrendingDown },
  { type: 'grade12to14Up', label: 'Grade 12-14% UP', color: 'text-amber-400', bgColor: 'bg-amber-400/20', icon: TrendingUp },
  { type: 'grade14PlusDown', label: 'Grade 14%+ DOWN', color: 'text-red-500', bgColor: 'bg-red-500/20', icon: TrendingDown },
  { type: 'grade14PlusUp', label: 'Grade 14%+ UP', color: 'text-red-400', bgColor: 'bg-red-400/20', icon: TrendingUp },
  { type: 'gradeDown', label: 'Grade Down', color: 'text-orange-500', bgColor: 'bg-orange-500/20', icon: TrendingDown },
  { type: 'gradeUp', label: 'Grade UP', color: 'text-lime-400', bgColor: 'bg-lime-400/20', icon: TrendingUp },
  { type: 'gravelRoad', label: 'Gravel Road', color: 'text-stone-400', bgColor: 'bg-stone-400/20', icon: Mountain },
  { type: 'highVoltage', label: 'High Voltage', color: 'text-red-600', bgColor: 'bg-red-600/20', icon: Zap },
  { type: 'highwayEntrance', label: 'Highway Entrance', color: 'text-indigo-500', bgColor: 'bg-indigo-500/20', icon: AlignHorizontalJustifyStart },
  { type: 'highwayExit', label: 'Highway Exit', color: 'text-indigo-600', bgColor: 'bg-indigo-600/20', icon: AlignHorizontalJustifyEnd },
  { type: 'importantNote', label: 'Important Note', color: 'text-emerald-400', bgColor: 'bg-emerald-400/20', icon: FileText },
  { type: 'information', label: 'Information', color: 'text-cyan-400', bgColor: 'bg-cyan-400/20', icon: Info },
  { type: 'intersection', label: 'Intersection', color: 'text-indigo-400', bgColor: 'bg-indigo-400/20', icon: CrosshairIcon },
  { type: 'lateralObstruction', label: 'Lateral Obstruction', color: 'text-pink-400', bgColor: 'bg-pink-400/20', icon: Barrier },
  { type: 'leftTurn', label: 'Left Turn', color: 'text-teal-400', bgColor: 'bg-teal-400/20', icon: CornerDownLeft },
  { type: 'lightPole', label: 'Light Pole', color: 'text-yellow-400', bgColor: 'bg-yellow-400/20', icon: Lightbulb },
  { type: 'logNote', label: 'Log Note', color: 'text-amber-600', bgColor: 'bg-amber-600/20', icon: BookOpen },
  { type: 'motorcycleBridge', label: 'Motorcycle Bridge', color: 'text-sky-400', bgColor: 'bg-sky-400/20', icon: Bike },
  { type: 'opticalFiber', label: 'Optical Fiber', color: 'text-violet-400', bgColor: 'bg-violet-400/20', icon: Wifi },
  { type: 'overheadStructure', label: 'Overhead Structure', color: 'text-slate-500', bgColor: 'bg-slate-500/20', icon: Home },
  { type: 'overpass', label: 'Overpass', color: 'text-orange-400', bgColor: 'bg-orange-400/20', icon: Landmark },
  { type: 'parking', label: 'Parking', color: 'text-blue-500', bgColor: 'bg-blue-500/20', icon: ParkingCircle },
  { type: 'passingLane', label: 'Passing Lane', color: 'text-teal-400', bgColor: 'bg-teal-400/20', icon: ArrowRightLeft },
  { type: 'pedestrianBridge', label: 'Pedestrian Bridge', color: 'text-blue-400', bgColor: 'bg-blue-400/20', icon: Footprints },
  { type: 'pipeRack', label: 'Pipe Rack', color: 'text-yellow-500', bgColor: 'bg-yellow-500/20', icon: Layers },
  { type: 'pitch', label: 'Pitch', color: 'text-lime-400', bgColor: 'bg-lime-400/20', icon: Activity },
  { type: 'powerLine', label: 'Power Line', color: 'text-red-400', bgColor: 'bg-red-400/20', icon: Zap },
  { type: 'powerNoSlack', label: 'Power No Slack', color: 'text-red-400', bgColor: 'bg-red-400/20', icon: ZapOff },
  { type: 'powerSlack', label: 'Power Slack', color: 'text-rose-400', bgColor: 'bg-rose-400/20', icon: Zap },
  { type: 'railroad', label: 'Railroad', color: 'text-slate-400', bgColor: 'bg-slate-400/20', icon: Train },
  { type: 'railroadCrossing', label: 'Railroad Crossing', color: 'text-zinc-400', bgColor: 'bg-zinc-400/20', icon: Train },
  { type: 'railroadMast', label: 'Railroad Mast', color: 'text-slate-400', bgColor: 'bg-slate-400/20', icon: Antenna },
  { type: 'railroadTruss', label: 'Railroad Truss', color: 'text-slate-500', bgColor: 'bg-slate-500/20', icon: RectangleHorizontal },
  { type: 'restricted', label: 'Restricted', color: 'text-red-400', bgColor: 'bg-red-400/20', icon: ShieldAlert },
  { type: 'rightTurn', label: 'Right Turn', color: 'text-teal-500', bgColor: 'bg-teal-500/20', icon: CornerDownRight },
  { type: 'road', label: 'Road', color: 'text-gray-400', bgColor: 'bg-gray-400/20', icon: Road },
  { type: 'roll', label: 'Roll', color: 'text-lime-500', bgColor: 'bg-lime-500/20', icon: RotateCw },
  { type: 'roundabout', label: 'Roundabout', color: 'text-cyan-500', bgColor: 'bg-cyan-500/20', icon: Circle },
  { type: 'signMast', label: 'Sign Mast', color: 'text-amber-400', bgColor: 'bg-amber-400/20', icon: Tag },
  { type: 'signTruss', label: 'Sign Truss', color: 'text-amber-500', bgColor: 'bg-amber-500/20', icon: Flag },
  { type: 'signalization', label: 'Signalization', color: 'text-amber-400', bgColor: 'bg-amber-400/20', icon: SignpostBig },
  { type: 'tollPlaza', label: 'Toll Plaza', color: 'text-orange-500', bgColor: 'bg-orange-500/20', icon: Warehouse },
  { type: 'tollTruss', label: 'Toll Truss', color: 'text-orange-400', bgColor: 'bg-orange-400/20', icon: RectangleHorizontal },
  { type: 'trafficLight', label: 'Traffic Light', color: 'text-purple-400', bgColor: 'bg-purple-400/20', icon: TrafficSign },
  { type: 'trafficMast', label: 'Traffic Mast', color: 'text-purple-500', bgColor: 'bg-purple-500/20', icon: Signal },
  { type: 'trafficSignalizationTruss', label: 'Traffic Signalization Truss', color: 'text-purple-600', bgColor: 'bg-purple-600/20', icon: RectangleHorizontal },
  { type: 'trafficWire', label: 'Traffic Wire', color: 'text-purple-400', bgColor: 'bg-purple-400/20', icon: Cable },
  { type: 'tree', label: 'Trees', color: 'text-green-400', bgColor: 'bg-green-400/20', icon: Tree },
  { type: 'tunnel', label: 'Tunnel', color: 'text-blue-600', bgColor: 'bg-blue-600/20', icon: SquareStack },
  { type: 'uTurn', label: 'U-Turn', color: 'text-indigo-400', bgColor: 'bg-indigo-400/20', icon: RefreshCw },
  { type: 'unpavedRoad', label: 'Unpaved Road', color: 'text-stone-400', bgColor: 'bg-stone-400/20', icon: Mountain },
  { type: 'vmsMast', label: 'VMS Mast', color: 'text-yellow-500', bgColor: 'bg-yellow-500/20', icon: MonitorSpeaker },
  { type: 'vmsTruss', label: 'VMS Truss', color: 'text-yellow-400', bgColor: 'bg-yellow-400/20', icon: Monitor },
  { type: 'voiceNote', label: 'Voice Note', color: 'text-purple-500', bgColor: 'bg-purple-500/20', icon: Mic },
  { type: 'wire', label: 'Wire', color: 'text-yellow-400', bgColor: 'bg-yellow-400/20', icon: Cable },
  { type: 'workRequired', label: 'Work Required', color: 'text-amber-400', bgColor: 'bg-amber-400/20', icon: Wrench },
];

export const AUTO_CAPTURE_POI_TYPES: POIType[] = ['railroad', 'intersection', 'road', 'bridge', 'danger'];
export const MODAL_POI_TYPES: POIType[] = ['information', 'workRequired', 'importantNote', 'lateralObstruction', 'restricted'];

/**
 * POI types that should AUTOMATICALLY record height clearance from the laser.
 * These are overhead infrastructure types where clearance measurement is critical.
 * Measurements must respect ground reference, ignoreAbove, and ignoreBelow thresholds.
 */
export const HEIGHT_CLEARANCE_POI_TYPES: POIType[] = [
  'overheadStructure',
  'opticalFiber',
  'railroad',
  'signalization',
  'overpass',
  'trafficLight',
  'powerLine',
  'bridgeAndWires',
  'wire',
  'tree',
  'powerNoSlack',
  'powerSlack',
  'highVoltage',
  'communicationCable',
  'communicationCluster',
  'pedestrianBridge',
  'trafficWire',
  'trafficMast',
  'trafficSignalizationTruss',
  'tollTruss',
  'motorcycleBridge',
  'railroadMast',
  'railroadTruss',
  'signMast',
  'signTruss',
  'vmsTruss',
  'vmsMast',
  'lightPole',
  'tunnel',
  'pipeRack',
  'flyover',
];

/**
 * POI types that do NOT record automatic height measurements.
 * User can manually enter measurements if required, but laser readings are not auto-captured.
 * This includes all non-overhead infrastructure types.
 */
export const MEASUREMENT_FREE_POI_TYPES: POIType[] = [
  'bridge',
  'lateralObstruction',
  'road',
  'intersection',
  'information',
  'danger',
  'importantNote',
  'workRequired',
  'restricted',
  'gradeUp', 
  'gradeDown',
  'grade10to12Up',
  'grade10to12Down',
  'grade12to14Up',
  'grade12to14Down',
  'grade14PlusUp',
  'grade14PlusDown',
  'autoturnRequired',
  'voiceNote',
  'passingLane',
  'parking',
  'gravelRoad',
  'deadEnd',
  'culvert',
  'emergencyParking',
  'roundabout',
  'tollPlaza',
  'leftTurn',
  'rightTurn',
  'uTurn',
  'clearNote',
  'railroadCrossing',
  'unpavedRoad',
  'logNote',
  'construction',
  'gate',
  'pitch',
  'roll',
  'highwayEntrance',
  'highwayExit',
];

/**
 * Check if a POI type should auto-record height clearance measurements.
 * Returns true only for overhead infrastructure types.
 */
export const shouldRecordHeightClearance = (poiType: POIType | string | null | undefined): boolean => {
  if (!poiType) return false;
  return HEIGHT_CLEARANCE_POI_TYPES.includes(poiType as POIType);
};

interface POIStore {
  selectedType: POIType | '';
  setSelectedType: (type: POIType | '') => void;
  getSelectedType: () => POIType | '';
}

export const usePOIStore = create<POIStore>((set, get) => ({
  selectedType: '',
  setSelectedType: (type) => {
    const previousType = get().selectedType;
    set({ selectedType: type });

    // Play sound when POI type changes — fire-and-forget (no await) for instant UI response
    if (type !== previousType && type !== '') {
      soundManager.playPOITypeChange();
    }
  },
  getSelectedType: (): POIType | '' => get().selectedType,
}));