// Stub — original deleted during orphan cleanup
interface UseGnssDataReturn {
  sample: any;
  isConnected: boolean;
  fixQuality: string;
  dataSource: string;
  satellites: number;
  hdop: number;
}
export function useGnssData(): UseGnssDataReturn {
  return { sample: null, isConnected: false, fixQuality: 'No Fix', dataSource: 'none', satellites: 0, hdop: 99 };
}
