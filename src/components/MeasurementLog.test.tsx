// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

// Mock all transitive dependencies
vi.mock('../lib/survey', () => ({
  useSurveyStore: vi.fn(() => ({
    activeSurvey: {
      id: 'survey-1',
      surveyTitle: 'Test Survey',
      name: 'Test',
    },
  })),
  deleteMeasurement: vi.fn(),
  deleteAllMeasurements: vi.fn(),
}));

vi.mock('../hooks/useMeasurementLogger', () => ({
  useMeasurementLogger: vi.fn(() => ({ logMeasurement: vi.fn() })),
}));

vi.mock('../lib/settings', () => ({
  useSettingsStore: vi.fn(() => ({
    alertSettings: {
      thresholds: { minHeight: 0, maxHeight: 25, warningThreshold: 4.2, criticalThreshold: 4.0 },
    },
    displaySettings: { units: 'metric' },
  })),
}));

vi.mock('../lib/utils/unitConversion', () => ({
  formatMeasurement: vi.fn((v: number) => v.toFixed(2)),
}));

vi.mock('../lib/utils/emailUtils', () => ({
  sendMeasurementLogEmail: vi.fn(),
}));

vi.mock('../lib/survey/export', () => ({
  generateCSV: vi.fn(() => ''),
  generateJSON: vi.fn(() => '{}'),
}));

vi.mock('../lib/survey/db', () => ({
  openSurveyDB: vi.fn(),
}));

vi.mock('./measurement/VoiceNotePlayer', () => ({
  VoiceNotePlayer: () => null,
}));

vi.mock('../lib/voice/VoiceNoteManager', () => ({
  VoiceNoteManager: class {
    getNotesForSurvey() { return []; }
    static getInstance() { return new this(); }
  },
}));

vi.mock('../hooks/useLicenseEnforcement', () => ({
  useEnabledFeatures: vi.fn(() => ({ hasFeature: vi.fn(() => true), features: {} })),
}));

vi.mock('../hooks/useMeasurementFeed', () => ({
  useMeasurementFeed: vi.fn(() => ({
    getMeasurementsWithLimit: vi.fn(() => []),
    cacheSize: 0,
  })),
}));

vi.mock('./VirtualizedListErrorBoundary', () => ({
  default: ({ children }: any) => <div>{children}</div>,
}));

vi.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: vi.fn(() => ({
    getVirtualItems: () => [],
    getTotalSize: () => 0,
    measureElement: vi.fn(),
  })),
}));

vi.mock('sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() },
}));

import MeasurementLog from './MeasurementLog';

describe('MeasurementLog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(Storage.prototype, 'getItem').mockReturnValue(null);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {});
  });

  it('renders without crashing', () => {
    const { container } = render(<MeasurementLog />);
    expect(container).toBeTruthy();
  });

  it('displays empty state message', () => {
    render(<MeasurementLog />);
    expect(screen.getByText('No measurements logged yet')).toBeInTheDocument();
  });

  it('displays entry count', () => {
    render(<MeasurementLog />);
    expect(screen.getByText(/entries/)).toBeInTheDocument();
  });
});
