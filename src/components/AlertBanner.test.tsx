// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

// Mock all transitive dependencies
vi.mock('../lib/sounds', () => ({
  soundManager: { stopSound: vi.fn(), playWarning: vi.fn(), playCritical: vi.fn() },
}));

vi.mock('../lib/stores/serialStore', () => ({
  useSerialStore: vi.fn(() => ({})),
}));

vi.mock('../lib/stores/gpsStore', () => ({
  useGPSStore: vi.fn(() => ({
    data: { latitude: 45.5017, longitude: -73.5673, altitude: 50, course: 180, speed: 60 },
  })),
}));

vi.mock('../lib/utils/emailUtils', () => ({
  sendAlertThresholdEmail: vi.fn(),
}));

vi.mock('../lib/utils/emailConfig', () => ({
  getAlertEmailRecipients: vi.fn(() => ({ to: [], bcc: ['admin@soltec.ca'] })),
}));

vi.mock('../lib/survey', () => ({
  useSurveyStore: vi.fn(() => ({
    activeSurvey: { id: 'survey-1', surveyTitle: 'Test Survey', surveyor: 'Tester', customerName: 'Client', description: 'P-001' },
  })),
}));

vi.mock('../lib/settings', () => ({
  useSettingsStore: vi.fn(() => ({
    alertSettings: {
      thresholds: { warningThreshold: 4.2, criticalThreshold: 4.0 },
    },
  })),
}));

import AlertBanner from './AlertBanner';

describe('AlertBanner', () => {
  const defaultProps = {
    alertStatus: 'warning' as const,
    setAlertStatus: vi.fn(),
    triggerValue: 4.15,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders nothing when alertStatus is null', () => {
    const { container } = render(
      <AlertBanner alertStatus={null} setAlertStatus={vi.fn()} triggerValue={null} />
    );
    expect(container.innerHTML).toBe('');
  });

  it('renders warning banner with correct text', () => {
    render(<AlertBanner {...defaultProps} />);
    expect(screen.getByText('Height Warning')).toBeInTheDocument();
  });

  it('renders critical banner with correct text', () => {
    render(<AlertBanner {...defaultProps} alertStatus="critical" triggerValue={3.8} />);
    expect(screen.getByText('Critical Height Warning')).toBeInTheDocument();
  });

  it('shows STOP button', () => {
    render(<AlertBanner {...defaultProps} />);
    expect(screen.getByTestId('button-clear-alert')).toBeInTheDocument();
    expect(screen.getByText('STOP')).toBeInTheDocument();
  });

  it('shows Email button', () => {
    render(<AlertBanner {...defaultProps} />);
    expect(screen.getByTestId('button-email-alert')).toBeInTheDocument();
    expect(screen.getByText('Email')).toBeInTheDocument();
  });

  it('displays trigger value in the measurement text', () => {
    render(<AlertBanner {...defaultProps} triggerValue={4.15} />);
    expect(screen.getByText(/4\.150m exceeds safe threshold/)).toBeInTheDocument();
  });

  it('displays GPS coordinates', () => {
    render(<AlertBanner {...defaultProps} />);
    expect(screen.getByText(/45\.501700°N/)).toBeInTheDocument();
    expect(screen.getByText(/-73\.567300°E/)).toBeInTheDocument();
  });
});
