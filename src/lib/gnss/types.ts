// Stub — original deleted during orphan cleanup
export interface RoadProfileStrict { id: string; sessionId: string; name: string; samples: RoadProfileSampleStrict[]; events: RoadProfileEventStrict[]; }
export interface RoadProfileSampleStrict { timestamp: number; latitude: number; longitude: number; altitude: number; grade: number; distance: number; }
export interface RoadProfileEventStrict { id: string; type: string; timestamp: number; latitude: number; longitude: number; value: number; }
export interface LegacyRoadProfile { id: string; [key: string]: any; }
export interface LegacyRoadProfileSample { [key: string]: any; }
export interface LegacyRoadProfileEvent { [key: string]: any; }
export type RoadProfileRead = RoadProfileStrict | LegacyRoadProfile;
export type RoadProfileSampleRead = RoadProfileSampleStrict | LegacyRoadProfileSample;
export type RoadProfileEventRead = RoadProfileEventStrict | LegacyRoadProfileEvent;
export function isStrictRoadProfile(_profile: any): _profile is RoadProfileStrict { return false; }
export function isStrictRoadProfileSample(_sample: any): _sample is RoadProfileSampleStrict { return false; }
export function isStrictRoadProfileEvent(_event: any): _event is RoadProfileEventStrict { return false; }
