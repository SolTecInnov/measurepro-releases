// Stub — original deleted during orphan cleanup
class DemoRuntime {
  start() {}
  stop() {}
  pause() {}
  resume() {}
  get isRunning() { return false; }
  get currentChapter() { return null; }
}
export const demoRuntime = new DemoRuntime();
export function useDemoRuntime() { return { isRunning: false, start: () => {}, stop: () => {}, currentChapter: null }; }
