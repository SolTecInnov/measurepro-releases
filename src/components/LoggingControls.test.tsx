// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

// Mock all transitive dependencies
vi.mock('../lib/stores/serialStore', () => ({
  useSerialStore: vi.fn(() => ({
    laserPort: null,
    gpsPort: null,
    lastMeasurement: '5.00',
    electronLaserConnected: false,
  })),
}));

vi.mock('../lib/stores/gpsStore', () => ({
  useGPSStore: vi.fn(() => ({
    data: { latitude: 45.5, longitude: -73.5, altitude: 50, course: 0, speed: 0, source: 'browser' },
    connected: false,
  })),
}));

vi.mock('../lib/survey', () => ({
  useSurveyStore: vi.fn(() => ({ activeSurvey: null })),
}));

vi.mock('../hooks/useMeasurementLogger', () => ({
  useMeasurementLogger: vi.fn(() => ({ logMeasurement: vi.fn() })),
}));

vi.mock('../lib/sounds', () => ({
  soundManager: { playLogEntry: vi.fn(), stopSound: vi.fn() },
}));

vi.mock('../lib/camera', () => ({
  useCameraStore: vi.fn(() => ({})),
}));

vi.mock('../lib/laser', () => ({
  useLaserStore: vi.fn(() => ({ groundReferenceHeight: 1.5 })),
}));

vi.mock('../lib/poi', () => ({
  usePOIStore: vi.fn(() => ({})),
  POI_TYPES: [],
}));

vi.mock('../hooks/useLicenseEnforcement', () => ({
  useEnabledFeatures: vi.fn(() => ({ hasFeature: vi.fn(() => true), features: {} })),
}));

vi.mock('../lib/bluetooth/bluetoothStore', () => ({
  useBluetoothStore: vi.fn(() => ({ laserStatus: 'disconnected', gpsStatus: 'disconnected' })),
}));

vi.mock('../lib/stores/rainModeStore', () => ({
  useRainModeStore: vi.fn((selector: any) => selector({ isSurveyMode: false })),
}));

vi.mock('../lib/utils/laserUtils', () => ({
  isInvalidMeasurement: vi.fn(() => false),
}));

vi.mock('./ManualLogEntryModal', () => ({
  default: () => null,
}));

vi.mock('./GroundReferenceConfirmModal', () => ({
  default: () => null,
}));

vi.mock('sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

import LoggingControls from './LoggingControls';

describe('LoggingControls', () => {
  const defaultProps = {
    loggingMode: 'manual' as const,
    setLoggingMode: vi.fn(),
    isLogging: false,
    setIsLogging: vi.fn(),
    startLogging: vi.fn(),
    stopLogging: vi.fn(),
    handleCaptureImage: vi.fn(),
    pendingPhotos: [] as string[],
    setPendingPhotos: vi.fn(),
    setShowSurveyDialog: vi.fn(),
    setOfflineItems: vi.fn(),
    selectedPOIType: 'bridge',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders without crashing', () => {
    const { container } = render(<LoggingControls {...defaultProps} />);
    expect(container).toBeTruthy();
  });

  it('renders Manual button', () => {
    render(<LoggingControls {...defaultProps} />);
    expect(screen.getByTestId('button-logging-manual')).toBeInTheDocument();
    expect(screen.getByText('Manual')).toBeInTheDocument();
  });

  it('renders All Data button', () => {
    render(<LoggingControls {...defaultProps} />);
    expect(screen.getByTestId('button-logging-all')).toBeInTheDocument();
    expect(screen.getByText('All Data')).toBeInTheDocument();
  });

  it('renders Auto-Capture button', () => {
    render(<LoggingControls {...defaultProps} />);
    expect(screen.getByTestId('button-logging-auto-capture')).toBeInTheDocument();
    expect(screen.getByText('Auto-Capture')).toBeInTheDocument();
  });

  it('renders Manual Log Entry button', () => {
    render(<LoggingControls {...defaultProps} />);
    expect(screen.getByTestId('button-manual-log-entry')).toBeInTheDocument();
    expect(screen.getByText('Manual Log Entry')).toBeInTheDocument();
  });

  it('renders Delete Last Entry button when handler is provided', () => {
    render(<LoggingControls {...defaultProps} handleDeleteLastEntry={vi.fn()} measurementCount={3} />);
    expect(screen.getByTestId('button-delete-last-entry')).toBeInTheDocument();
    expect(screen.getByText('Delete Last Entry')).toBeInTheDocument();
  });

  it('highlights active logging mode', () => {
    render(<LoggingControls {...defaultProps} loggingMode="manual" />);
    const manualBtn = screen.getByTestId('button-logging-manual');
    expect(manualBtn.className).toContain('bg-emerald-600');
  });
});
