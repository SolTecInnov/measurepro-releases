import { describe, it, expect, vi } from 'vitest';
import { handleTypeScriptError, handleDuplicateCodeError } from './errorHandler';

// Mock the fs module
vi.mock('fs', () => {
  const mockReadFileSync = vi.fn((path: string) => {
    if (path === '/home/project/src/lib/readers/serialLaserReader.ts') {
      return `
import { useSerialStore } from '../stores/serialStore';

class LaserReader {
  private buffer: string = '';
  
  // Simulated duplicate code block for testing
  private parseJenoptikData(data: string): string {
    const trimmed = data.trim();
    console.log('Parsing Jenoptik data:', trimmed);
    
    // First block
    if (trimmed.startsWith('D')) {
      return '3.225';
    }
    
    // Duplicate block that causes the error
    console.log('Jenoptik measurement in meters:', 3.225);
    return '3.225';
    
    // Duplicate block that causes the error
    console.log('Jenoptik measurement in meters:', 3.225);
    return '3.225';
  }
}
      `;
    }
    throw new Error(`File not found: ${path}`);
  });
  
  return {
    default: { readFileSync: mockReadFileSync },
    readFileSync: mockReadFileSync,
  };
});

describe('Error Handler Utilities', () => {
  describe('handleTypeScriptError', () => {
    it('should correctly analyze syntax errors', () => {
      const result = handleTypeScriptError(
        'Expected identifier but found "/"',
        287
      );
      
      expect(result.errorType).toBe('syntax');
      expect(result.suggestedFixes.length).toBeGreaterThan(0);
      expect(result.formattedMessage).toContain('Syntax Error');
    });
    
    it('should correctly analyze type errors', () => {
      const result = handleTypeScriptError(
        'Type string is not assignable to type number',
        42
      );
      
      expect(result.errorType).toBe('type');
      expect(result.suggestedFixes.length).toBeGreaterThan(0);
      expect(result.formattedMessage).toContain('Type Error');
    });
    
    it('should correctly analyze reference errors', () => {
      const result = handleTypeScriptError(
        'Cannot find name "foo"',
        123
      );
      
      expect(result.errorType).toBe('reference');
      expect(result.suggestedFixes.length).toBeGreaterThan(0);
      expect(result.formattedMessage).toContain('Reference Error');
    });
    
    it('should handle invalid inputs gracefully', () => {
      // @ts-ignore - Testing invalid input
      const result = handleTypeScriptError(null, -1);
      
      expect(result.errorType).toBe('unknown');
      expect(result.formattedMessage).toContain('Error in error handler');
    });
  });
  
  describe('handleDuplicateCodeError', () => {
    it('should detect and analyze duplicate code blocks', () => {
      const result = handleDuplicateCodeError(
        '/home/project/src/lib/readers/serialLaserReader.ts',
        287
      );
      
      expect(result.errorType).toBe('duplicate-code');
      expect(result.suggestedFixes.length).toBeGreaterThan(0);
      expect(result.formattedMessage).toContain('Duplicate code block detected');
    });
    
    it('should handle file access errors gracefully', () => {
      const result = handleDuplicateCodeError(
        '/non/existent/file.ts',
        42
      );
      
      expect(result.errorType).toBe('file-access');
      expect(result.formattedMessage).toContain('Could not read file');
    });
  });
});