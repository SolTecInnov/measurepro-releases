// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

// Mock all transitive dependencies
vi.mock('../lib/survey/index', () => ({
  useSurveyStore: vi.fn(() => ({
    activeSurvey: null,
    loadSurveys: vi.fn().mockResolvedValue([]),
    surveys: [],
    setActiveSurvey: vi.fn(),
    clearSurvey: vi.fn(),
  })),
  exportSurvey: vi.fn(),
}));

vi.mock('../lib/utils/exportUtils', () => ({
  exportSurveyWithMedia: vi.fn(),
}));

vi.mock('../lib/stores/serialStore', () => ({
  useSerialStore: vi.fn(() => ({ lastMeasurement: '--' })),
}));

vi.mock('../lib/firebase', () => ({
  getSafeAuth: vi.fn(() => ({ currentUser: null })),
}));

vi.mock('../lib/auth/masterAdmin', () => ({
  isBetaUser: vi.fn(() => false),
}));

vi.mock('../hooks/useLicenseEnforcement', () => ({
  useEnabledFeatures: vi.fn(() => ({ hasFeature: vi.fn(() => true), features: {} })),
}));

vi.mock('./survey/SaveNowButton', () => ({
  default: () => null,
}));

vi.mock('../lib/auditLog', () => ({
  auditLog: { surveyExport: vi.fn() },
}));

vi.mock('./survey/SurveyDetails', () => ({
  default: () => <div data-testid="survey-details" />,
}));

vi.mock('./survey/SurveyStatistics', () => ({
  default: () => <div data-testid="survey-statistics" />,
}));

vi.mock('./survey/SurveyActions', () => ({
  default: () => <div data-testid="survey-actions" />,
}));

vi.mock('./survey/SurveyForm', () => ({
  default: () => null,
}));

vi.mock('./survey/SurveyList', () => ({
  default: () => null,
}));

vi.mock('./survey/SurveyPartsOverview', () => ({
  default: () => null,
}));

vi.mock('./survey/NoActiveSurvey', () => ({
  default: () => <div data-testid="no-active-survey">No active survey</div>,
}));

import SurveyManager from './SurveyManager';

describe('SurveyManager', () => {
  const defaultProps = {
    showSurveyDialog: false,
    setShowSurveyDialog: vi.fn(),
    setOfflineItems: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(Storage.prototype, 'getItem').mockReturnValue(null);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {});
  });

  it('renders without crashing', () => {
    const { container } = render(<SurveyManager {...defaultProps} />);
    expect(container).toBeTruthy();
  });

  it('renders the survey manager container', () => {
    render(<SurveyManager {...defaultProps} />);
    expect(screen.getByTestId('survey-manager')).toBeInTheDocument();
  });

  it('displays Survey Management heading', () => {
    render(<SurveyManager {...defaultProps} />);
    expect(screen.getByText('Survey Management')).toBeInTheDocument();
  });

  it('shows New Survey button when no active survey', () => {
    render(<SurveyManager {...defaultProps} />);
    expect(screen.getByText('New Survey')).toBeInTheDocument();
  });

  it('shows Load Survey button', () => {
    render(<SurveyManager {...defaultProps} />);
    expect(screen.getByText('Load Survey')).toBeInTheDocument();
  });

  it('shows no-active-survey message when no survey is active', () => {
    render(<SurveyManager {...defaultProps} />);
    expect(screen.getByTestId('no-active-survey')).toBeInTheDocument();
  });

  it('shows Active Survey when a survey is active', async () => {
    const { useSurveyStore } = await import('../lib/survey/index');
    (useSurveyStore as any).mockReturnValue({
      activeSurvey: { id: 'survey-1', surveyTitle: 'Test', name: 'Test', poiCount: 5 },
      loadSurveys: vi.fn().mockResolvedValue([]),
      surveys: [],
      setActiveSurvey: vi.fn(),
      clearSurvey: vi.fn(),
    });

    render(<SurveyManager {...defaultProps} />);
    expect(screen.getByText('Active Survey')).toBeInTheDocument();
  });
});
