// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

const mockSetEnabled = vi.fn();
let mockEnabled = true;

vi.mock('../lib/stores/driveModeStore', () => ({
  useDriveModeStore: vi.fn((selector: any) =>
    selector({ enabled: mockEnabled, setEnabled: mockSetEnabled })
  ),
}));

import { DriveModeBadge } from './DriveModeBadge';

describe('DriveModeBadge', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEnabled = true;
  });

  it('renders nothing when drive mode is disabled', () => {
    mockEnabled = false;
    const { container } = render(<DriveModeBadge />);
    expect(container.innerHTML).toBe('');
  });

  it('renders badge when drive mode is enabled', () => {
    render(<DriveModeBadge />);
    expect(screen.getByTestId('drive-mode-badge')).toBeInTheDocument();
  });

  it('displays DRIVE MODE text', () => {
    render(<DriveModeBadge />);
    expect(screen.getByText(/DRIVE MODE/)).toBeInTheDocument();
  });

  it('displays triple-tap instruction', () => {
    render(<DriveModeBadge />);
    expect(screen.getByText(/triple-tap to exit/)).toBeInTheDocument();
  });

  it('has the correct test id', () => {
    render(<DriveModeBadge />);
    const badge = screen.getByTestId('drive-mode-badge');
    expect(badge.tagName).toBe('BUTTON');
  });
});
