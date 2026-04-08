// Stub — original deleted during orphan cleanup
interface UseProfileRecordingReturn {
  isRecording: boolean;
  isPaused: boolean;
  sampleCount: number;
  duration: number;
  start: () => void;
  stop: () => void;
  pause: () => void;
  resume: () => void;
  reset: () => void;
}
export function useProfileRecording(): UseProfileRecordingReturn {
  return { isRecording: false, isPaused: false, sampleCount: 0, duration: 0, start: () => {}, stop: () => {}, pause: () => {}, resume: () => {}, reset: () => {} };
}
export default useProfileRecording;
