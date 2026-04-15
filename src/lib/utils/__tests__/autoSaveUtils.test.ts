import { describe, it, expect, vi, beforeEach } from 'vitest';

const localStorageData: Record<string, string> = {};

vi.stubGlobal('localStorage', {
  getItem: vi.fn((key: string) => localStorageData[key] ?? null),
  setItem: vi.fn((key: string, val: string) => { localStorageData[key] = val; }),
  removeItem: vi.fn((key: string) => { delete localStorageData[key]; }),
  clear: vi.fn(() => { Object.keys(localStorageData).forEach(k => delete localStorageData[k]); }),
});

vi.stubGlobal('window', {
  setInterval: vi.fn(() => 42),
  clearInterval: vi.fn(),
  dispatchEvent: vi.fn(),
  electronAPI: undefined,
});

// Mock heavy dependencies
vi.mock('jszip', () => ({
  default: vi.fn(() => ({
    file: vi.fn(),
    folder: vi.fn(() => ({ file: vi.fn() })),
    generateAsync: vi.fn().mockResolvedValue(new Blob(['test'])),
  })),
}));

vi.mock('file-saver', () => ({
  saveAs: vi.fn(),
}));

vi.mock('../../survey/db', () => ({
  openSurveyDB: vi.fn().mockResolvedValue({
    getAllFromIndex: vi.fn().mockResolvedValue([]),
    objectStoreNames: { contains: vi.fn().mockReturnValue(false) },
    put: vi.fn().mockResolvedValue(undefined),
  }),
}));

import { resetAutoSavePartNumber, setupAutoSave, clearAutoSave } from '../autoSaveUtils';

describe('autoSaveUtils', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(localStorageData).forEach(k => delete localStorageData[k]);
  });

  describe('resetAutoSavePartNumber', () => {
    it('resets part number to 0 in localStorage', () => {
      resetAutoSavePartNumber('survey-123');
      expect(localStorage.setItem).toHaveBeenCalledWith('autoSave_partNumber_survey-123', '0');
    });
  });

  describe('setupAutoSave', () => {
    it('returns 0 for null survey', () => {
      const id = setupAutoSave(null);
      expect(id).toBe(0);
    });

    it('sets up interval and returns interval ID', () => {
      const survey = { id: 'survey-1', surveyTitle: 'Test' } as any;
      const id = setupAutoSave(survey, 30);
      expect(id).toBe(42);
      expect(window.setInterval).toHaveBeenCalledWith(expect.any(Function), 30 * 60 * 1000);
    });
  });

  describe('clearAutoSave', () => {
    it('clears the interval', () => {
      clearAutoSave(42);
      expect(window.clearInterval).toHaveBeenCalledWith(42);
    });

    it('does nothing for 0', () => {
      clearAutoSave(0);
      expect(window.clearInterval).not.toHaveBeenCalled();
    });
  });
});
