// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

// Mock all transitive dependencies
vi.mock('../lib/sounds', () => ({
  soundManager: { stopSound: vi.fn(), playWarning: vi.fn(), playCritical: vi.fn(), playLogEntry: vi.fn() },
}));

vi.mock('../lib/laser', () => ({
  useLaserStore: vi.fn(() => ({ groundReferenceHeight: 1.5 })),
}));

vi.mock('../lib/settings', () => ({
  useSettingsStore: vi.fn(() => ({
    alertSettings: {
      thresholds: { minHeight: 0, maxHeight: 25, warningThreshold: 4.2, criticalThreshold: 4.0 },
    },
  })),
}));

vi.mock('../lib/stores/serialStore', () => ({
  useSerialStore: vi.fn(() => ({
    lastMeasurement: '5.00',
    measurementSampleId: 1,
  })),
}));

vi.mock('../lib/stores/alertsStore', () => ({
  useAlertsStore: vi.fn(() => ({
    alertStatus: null,
    setAlertStatus: vi.fn(),
    triggerValue: null,
    setTriggerValue: vi.fn(),
  })),
}));

vi.mock('../lib/utils/laserUtils', () => ({
  isInvalidMeasurement: vi.fn(() => false),
}));

vi.mock('../lib/stores/gpsStore', () => ({
  useGPSStore: vi.fn(() => ({
    data: { latitude: 45.5, longitude: -73.5, altitude: 50, course: 0, speed: 0 },
  })),
}));

vi.mock('../lib/survey', () => ({
  useSurveyStore: vi.fn(() => ({ activeSurvey: null })),
}));

vi.mock('../lib/utils/emailUtils', () => ({
  sendAlertThresholdEmail: vi.fn(),
}));

vi.mock('../lib/utils/emailConfig', () => ({
  getAlertEmailRecipients: vi.fn(() => ({ to: [], bcc: [] })),
}));

vi.mock('../lib/utils/unitConversion', () => ({
  formatMeasurementDual: vi.fn((v: number) => ({ meters: v.toFixed(2), feet: (v * 3.28084).toFixed(2) })),
}));

// Mock sub-components to simplify rendering
vi.mock('./measurement/CurrentMeasureCard', () => ({
  default: ({ measurementInMeters }: any) => (
    <div data-testid="current-measure-card">{measurementInMeters}</div>
  ),
}));

vi.mock('./measurement/LastMeasureCard', () => ({
  default: () => <div data-testid="last-measure-card" />,
}));

vi.mock('./measurement/MinimumDistanceCard', () => ({
  default: () => <div data-testid="min-distance-card" />,
}));

vi.mock('./measurement/HistorySettingsModal', () => ({
  default: () => null,
}));

vi.mock('./measurement/utils', () => ({
  calculateOptimalColumns: vi.fn(() => 2),
}));

import MeasurementCards from './MeasurementCards';

describe('MeasurementCards', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock localStorage
    vi.spyOn(Storage.prototype, 'getItem').mockReturnValue(null);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {});
  });

  it('renders without crashing', () => {
    const { container } = render(<MeasurementCards />);
    expect(container).toBeTruthy();
  });

  it('renders the current measure card', () => {
    render(<MeasurementCards />);
    expect(screen.getByTestId('current-measure-card')).toBeInTheDocument();
  });

  it('displays Last Measure section', () => {
    render(<MeasurementCards />);
    expect(screen.getByText('Last Measure')).toBeInTheDocument();
  });

  it('displays Session Min section', () => {
    render(<MeasurementCards />);
    expect(screen.getByText('Session Min')).toBeInTheDocument();
  });
});
