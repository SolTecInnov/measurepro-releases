// Stub — original deleted during orphan cleanup
export interface ActiveSessionState { sessionId: string; isRecording: boolean; startTime: number; }
export interface GnssSample { timestamp: number; latitude: number; longitude: number; altitude: number; }
export async function saveSessionState(_state: ActiveSessionState): Promise<void> {}
export function loadSessionState(): ActiveSessionState | null { return null; }
export function clearSessionState(): void {}
export async function persistSamples(_sessionId: string, _samples: GnssSample[]): Promise<void> {}
export async function loadSessionSamples(_sessionId: string): Promise<GnssSample[]> { return []; }
export async function clearSessionSamples(_sessionId: string): Promise<void> {}
export async function appendSamples(_sessionId: string, _newSamples: GnssSample[]): Promise<void> {}
