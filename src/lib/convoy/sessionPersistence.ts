// Stub — original deleted during orphan cleanup
interface PersistedConvoySession { role: string; memberName: string; sessionId: string; lastActivity: number; }
export const saveConvoySession = (_data: Partial<PersistedConvoySession>) => {};
export const getConvoySession = (): PersistedConvoySession | null => null;
export const clearConvoySession = () => {};
export const updateConvoySessionActivity = () => {};
export const hasActiveConvoySession = (): boolean => false;
