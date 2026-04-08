// Stub — original deleted during orphan cleanup
interface OrchestratorConfig { enabled: boolean; }
export function useWorkerOrchestrator(_config: Partial<OrchestratorConfig> = {}) {
  return { isActive: false, start: () => {}, stop: () => {}, stats: {} };
}
