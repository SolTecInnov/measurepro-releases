// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

vi.mock('../lib/poiActions', () => ({
  usePOIActionsStore: vi.fn(() => ({
    getActionForPOI: vi.fn(() => 'auto-capture-and-log'),
  })),
}));

vi.mock('../lib/poi', () => ({
  POI_TYPES: [
    { type: '', label: 'None', color: 'text-gray-400', bgColor: 'bg-gray-400/20', icon: () => null },
    { type: 'bridge', label: 'Bridge', color: 'text-blue-400', bgColor: 'bg-blue-400/20', icon: () => null },
    { type: 'sign', label: 'Sign', color: 'text-green-400', bgColor: 'bg-green-400/20', icon: () => null },
  ],
}));

vi.mock('sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

import POISelector from './POISelector';

describe('POISelector', () => {
  const defaultProps = {
    selectedType: '' as const,
    setSelectedType: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders without crashing', () => {
    const { container } = render(<POISelector {...defaultProps} />);
    expect(container).toBeTruthy();
  });

  it('displays Active POI Type heading', () => {
    render(<POISelector {...defaultProps} />);
    expect(screen.getByText('Active POI Type')).toBeInTheDocument();
  });

  it('renders a select dropdown', () => {
    render(<POISelector {...defaultProps} />);
    const select = screen.getByRole('combobox');
    expect(select).toBeInTheDocument();
  });

  it('renders all POI type options', () => {
    render(<POISelector {...defaultProps} />);
    // "None" appears twice: once in the <option> and once in the preview label
    expect(screen.getAllByText('None').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByRole('option', { name: 'Bridge' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Sign' })).toBeInTheDocument();
  });

  it('shows the selected POI type label', () => {
    render(<POISelector {...defaultProps} selectedType="bridge" />);
    const select = screen.getByRole('combobox') as HTMLSelectElement;
    expect(select.value).toBe('bridge');
  });
});
