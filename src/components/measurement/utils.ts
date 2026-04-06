/**
 * Calculate the optimal number of columns for measurement history display
 * @param cardWidth - Available width of the card
 * @param itemCount - Number of items to display
 * @returns Optimal number of columns
 */
export const calculateOptimalColumns = (cardWidth: number, itemCount: number): number => {
  // Minimum width needed per measurement item (including padding and text)
  const minItemWidth = 80; // 80px minimum for "5.12m" + padding
  
  // Calculate maximum columns that can fit
  const maxPossibleColumns = Math.floor(cardWidth / minItemWidth);
  
  // Don't exceed the number of items we have
  const optimalColumns = Math.min(maxPossibleColumns, itemCount, 4); // Cap at 4 columns max
  
  // Ensure at least 1 column
  return Math.max(1, optimalColumns);
};

/**
 * Check if a measurement value is invalid
 * @param value - The measurement value to check
 * @returns Boolean indicating if the measurement is invalid
 */
export const isInvalidMeasurement = (value: string | null): boolean => {
  if (!value) return true;
  return value === 'infinity' || 
         value === 'DE02' || 
         value.includes('DE02') || 
         value === '--' || 
         value === 'NaN' || 
         value === 'undefined' || 
         value === 'null' || 
         value === '';
};