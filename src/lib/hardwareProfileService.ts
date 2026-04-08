// Stub — original deleted during orphan cleanup
export interface PortFingerprint { vendorId?: string; productId?: string; index: number; }
export interface HardwareProfile { laser?: PortFingerprint; gps?: PortFingerprint; duroUrl?: string; }
export function getPortFingerprint(_port: SerialPort, _allPorts: SerialPort[]): PortFingerprint { return { index: 0 }; }
export function saveHardwareProfile(_userId: string, _profile: HardwareProfile): void {}
export function loadHardwareProfile(_userId: string): HardwareProfile | null { return null; }
export function clearHardwareProfile(_userId: string): void {}
export type AutoReconnectResult = { success: boolean; laser?: boolean; gps?: boolean; duro?: boolean };
export async function checkAutoReconnect(_userId: string): Promise<AutoReconnectResult> { return { success: false }; }
export function getDuroUrl(): string { return ''; }
export function setDuroUrl(_url: string): void {}
