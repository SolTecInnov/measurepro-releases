import { readFileSync } from 'fs';

/**
 * Interface for error details
 */
interface ErrorDetails {
  filePath: string;
  lineNumber: number;
  errorMessage: string;
  errorType: 'syntax' | 'type' | 'reference' | 'unknown';
}

/**
 * Interface for error analysis result
 */
interface ErrorAnalysisResult {
  errorLocation: {
    filePath: string;
    lineNumber: number;
    columnNumber?: number;
  };
  formattedMessage: string;
  suggestedFixes: string[];
  errorType: string;
  codeContext?: string;
}

/**
 * Analyzes TypeScript syntax errors and provides detailed information and suggestions
 * @param errorMessage - The error message from the compiler
 * @param lineNumber - The line number where the error occurred
 * @returns An object containing error analysis and suggested fixes
 */
export function analyzeTypeScriptError(errorMessage: string, lineNumber: number): ErrorAnalysisResult {
  // Parse the error message
  const errorDetails = parseErrorMessage(errorMessage, lineNumber);
  
  // Get code context if possible
  let codeContext: string | undefined;
  try {
    if (errorDetails.filePath) {
      const fileContent = readFileSync(errorDetails.filePath, 'utf-8');
      const lines = fileContent.split('\n');
      const startLine = Math.max(0, errorDetails.lineNumber - 3);
      const endLine = Math.min(lines.length, errorDetails.lineNumber + 3);
      codeContext = lines.slice(startLine, endLine).join('\n');
    }
  } catch (error) {
    // Silent fail
  }
  
  // Generate suggested fixes based on error type
  const suggestedFixes = generateSuggestedFixes(errorDetails);
  
  return {
    errorLocation: {
      filePath: errorDetails.filePath,
      lineNumber: errorDetails.lineNumber
    },
    formattedMessage: formatErrorMessage(errorDetails),
    suggestedFixes,
    errorType: errorDetails.errorType,
    codeContext
  };
}

/**
 * Parses an error message to extract relevant details
 * @param errorMessage - The raw error message
 * @param lineNumber - The line number where the error occurred
 * @returns Parsed error details
 */
function parseErrorMessage(errorMessage: string, lineNumber: number): ErrorDetails {
  // Extract file path from error message
  const filePathMatch = errorMessage.match(/([\/\\][^:]+):/);
  const filePath = filePathMatch ? filePathMatch[1] : '';
  
  // Determine error type
  let errorType: 'syntax' | 'type' | 'reference' | 'unknown' = 'unknown';
  
  if (errorMessage.includes('Expected identifier') || 
      errorMessage.includes('Unexpected token') ||
      errorMessage.includes('Unexpected end of input')) {
    errorType = 'syntax';
  } else if (errorMessage.includes('Type') && 
            (errorMessage.includes('is not assignable') || 
             errorMessage.includes('has no property'))) {
    errorType = 'type';
  } else if (errorMessage.includes('Cannot find') || 
            errorMessage.includes('is not defined')) {
    errorType = 'reference';
  }
  
  return {
    filePath,
    lineNumber,
    errorMessage,
    errorType
  };
}

/**
 * Formats the error message for better readability
 * @param errorDetails - The parsed error details
 * @returns A formatted error message
 */
function formatErrorMessage(errorDetails: ErrorDetails): string {
  const { errorType, errorMessage, filePath, lineNumber } = errorDetails;
  
  let prefix = '';
  switch (errorType) {
    case 'syntax':
      prefix = '🔍 Syntax Error';
      break;
    case 'type':
      prefix = '⚠️ Type Error';
      break;
    case 'reference':
      prefix = '❓ Reference Error';
      break;
    default:
      prefix = '❌ Error';
  }
  
  return `${prefix} at ${filePath}:${lineNumber}: ${errorMessage}`;
}

/**
 * Generates suggested fixes based on the error type
 * @param errorDetails - The parsed error details
 * @returns An array of suggested fixes
 */
function generateSuggestedFixes(errorDetails: ErrorDetails): string[] {
  const { errorType, errorMessage } = errorDetails;
  
  const suggestions: string[] = [];
  
  switch (errorType) {
    case 'syntax':
      if (errorMessage.includes('Expected identifier')) {
        suggestions.push('Check for missing variable or property names');
        suggestions.push('Look for duplicate code blocks or statements');
        suggestions.push('Ensure all code blocks are properly closed');
        suggestions.push('Check for misplaced or duplicate punctuation');
      } else if (errorMessage.includes('Unexpected token')) {
        suggestions.push('Check for mismatched brackets, parentheses, or braces');
        suggestions.push('Ensure statements are properly terminated with semicolons');
        suggestions.push('Look for invalid characters in identifiers');
      }
      break;
      
    case 'type':
      suggestions.push('Verify the type definitions match the expected types');
      suggestions.push('Check if you need to add type assertions or conversions');
      suggestions.push('Ensure imported types are correctly referenced');
      break;
      
    case 'reference':
      suggestions.push('Verify the variable or function is defined before use');
      suggestions.push('Check import statements for missing imports');
      suggestions.push('Ensure the referenced name is spelled correctly');
      break;
      
    default:
      suggestions.push('Review the code around the error line for issues');
      suggestions.push('Check for any recent changes that might have introduced the error');
  }
  
  return suggestions;
}

/**
 * Handles TypeScript errors by providing detailed analysis and suggestions
 * @param errorMessage - The error message from the compiler
 * @param lineNumber - The line number where the error occurred
 * @returns An object with error analysis and suggestions
 */
export function handleTypeScriptError(
  errorMessage: string, 
  lineNumber: number
): ErrorAnalysisResult {
  try {
    // Validate inputs
    if (!errorMessage || typeof errorMessage !== 'string') {
      throw new Error('Invalid error message provided');
    }
    
    if (typeof lineNumber !== 'number' || lineNumber < 0) {
      throw new Error('Invalid line number provided');
    }
    
    // Parse file path from error message
    const filePathMatch = errorMessage.match(/([\/\\][^:]+):/);
    const filePath = filePathMatch ? filePathMatch[1] : 'unknown-file';
    
    // Analyze the error
    return analyzeTypeScriptError(errorMessage, lineNumber);
  } catch (error) {
    // Handle errors in the error handler itself
    return {
      errorLocation: {
        filePath: 'unknown',
        lineNumber: lineNumber || 0
      },
      formattedMessage: `Error in error handler: ${error.message}`,
      suggestedFixes: ['Check the error handler implementation'],
      errorType: 'unknown'
    };
  }
}

/**
 * Specifically handles duplicate code block errors in TypeScript files
 * @param filePath - Path to the file with the error
 * @param lineNumber - Line number where the error was detected
 * @returns Analysis of the duplicate code error
 */
export function handleDuplicateCodeError(
  filePath: string,
  lineNumber: number
): ErrorAnalysisResult {
  try {
    // Try to read the file content
    let fileContent: string;
    try {
      fileContent = readFileSync(filePath, 'utf-8');
    } catch (error) {
      return {
        errorLocation: { filePath, lineNumber },
        formattedMessage: `Could not read file: ${error.message}`,
        suggestedFixes: ['Ensure the file exists and is accessible'],
        errorType: 'file-access'
      };
    }
    
    // Split into lines
    const lines = fileContent.split('\n');
    
    // Get the problematic line
    const errorLine = lines[lineNumber - 1] || '';
    
    // Look for similar code blocks
    const similarBlocks: { startLine: number; endLine: number; content: string }[] = [];
    let currentBlock: string[] = [];
    let blockStart = 0;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Simple heuristic: if we find a line that looks like a block start
      if (line.includes('{') && !currentBlock.length) {
        blockStart = i;
        currentBlock.push(line);
      } else if (currentBlock.length > 0) {
        currentBlock.push(line);
        
        // If we find a closing brace, consider it a complete block
        if (line.includes('}')) {
          const blockContent = currentBlock.join('\n');
          
          // Check if this block appears elsewhere in the file
          const blockRegex = new RegExp(blockContent.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
          const matches = fileContent.match(blockRegex);
          
          if (matches && matches.length > 1) {
            similarBlocks.push({
              startLine: blockStart + 1,
              endLine: i + 1,
              content: blockContent
            });
          }
          
          currentBlock = [];
        }
      }
    }
    
    // Generate suggestions based on findings
    const suggestedFixes = [
      'Remove the duplicate code block',
      'If the code is needed, refactor it into a function to avoid duplication',
      'Check for copy-paste errors that might have introduced duplicates'
    ];
    
    if (similarBlocks.length > 0) {
      suggestedFixes.push(`Check lines ${similarBlocks.map(b => `${b.startLine}-${b.endLine}`).join(', ')} for similar code blocks`);
    }
    
    return {
      errorLocation: { 
        filePath, 
        lineNumber 
      },
      formattedMessage: `Duplicate code block detected at line ${lineNumber}`,
      suggestedFixes,
      errorType: 'duplicate-code',
      codeContext: lines.slice(Math.max(0, lineNumber - 5), Math.min(lines.length, lineNumber + 5)).join('\n')
    };
  } catch (error) {
    return {
      errorLocation: { filePath, lineNumber },
      formattedMessage: `Error analyzing duplicate code: ${error.message}`,
      suggestedFixes: ['Manual code review required'],
      errorType: 'analysis-error'
    };
  }
}