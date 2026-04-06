import React from 'react';
import { SlaveAppWithPairing } from '../components/slave/SlaveAppWithPairing';
import { useSurveyStore } from '../lib/survey';
import { useEffect, useState } from 'react';
import { openSurveyDB } from '../lib/survey/db';
import { toast } from 'sonner';

const SlaveAppPage: React.FC = () => {
  const { activeSurvey } = useSurveyStore();
  const [isMobileDevice, setIsMobileDevice] = useState(false);
  
  // Check if this is a mobile device
  useEffect(() => {
    const checkIfMobile = () => {
      const isMobile = window.innerWidth <= 768 || 
                       /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      setIsMobileDevice(isMobile);
    };
    
    checkIfMobile();
    window.addEventListener('resize', checkIfMobile);
    
    return () => {
      window.removeEventListener('resize', checkIfMobile);
    };
  }, []);
  
  // Share active survey with slave app via localStorage
  useEffect(() => {
    if (activeSurvey) {
      // First, clear any existing survey data to avoid stale data
      localStorage.removeItem('mainApp_activeSurvey');
      
      // Then set the new survey data with a small delay to ensure clean state
      setTimeout(() => {
      localStorage.setItem('mainApp_activeSurvey', JSON.stringify(activeSurvey));
      }, 100);
      
      // Also share the next available road and POI numbers
      const getNextAvailableNumbers = async () => {
        try {
          // PERFORMANCE FIX: Load only recent measurements to find highest road/POI numbers
          // Previous: getAllFromIndex loaded ALL measurements causing O(n) lag
          // Current: Cursor-based query loads last 500 measurements (sufficient for numbering)
          const db = await openSurveyDB();
          const tx = db.transaction('measurements', 'readonly');
          const index = tx.objectStore('measurements').index('by-survey');
          
          // Open cursor in reverse (newest first)
          let cursor = await index.openCursor(activeSurvey.id, 'prev');
          const recentMeasurements: any[] = [];
          
          // Load last 100 measurements (slave app only creates 1-3 POIs, highest number is always recent)
          while (cursor && recentMeasurements.length < 100) {
            recentMeasurements.push(cursor.value);
            cursor = await cursor.continue();
          }
          
          // Find the highest road number
          const highestRoadNumber = Math.max(
            ...recentMeasurements
              .filter(m => m.roadNumber !== null && m.roadNumber !== undefined)
              .map(m => m.roadNumber || 0),
            0
          );
          
          // Find the highest POI number for the highest road
          const measurementsForHighestRoad = recentMeasurements.filter(m => m.roadNumber === highestRoadNumber);
          const highestPoiNumber = Math.max(
            ...measurementsForHighestRoad
              .filter(m => m.poiNumber !== null && m.poiNumber !== undefined)
              .map(m => m.poiNumber || 0),
            0
          );
          
          // Share with slave app
          localStorage.setItem('mainApp_nextRoadNumber', String(highestRoadNumber));
          localStorage.setItem('mainApp_nextPoiNumber', String(highestPoiNumber + 1));
        } catch (error) {
        }
      };
      
      getNextAvailableNumbers();
    }
  }, [activeSurvey]);
  
  // Check for slave app measurements and notify user
  useEffect(() => {
    const checkSlaveAppMeasurements = () => {
      const measurementsJson = localStorage.getItem('slaveApp_measurements');
      if (measurementsJson) {
        try {
          const measurements = JSON.parse(measurementsJson);
          if (measurements.length > 0) {
            toast.info(`${measurements.length} measurements available from slave app`, {
              description: 'Go to the main app to import them',
              duration: 5000
            });
          }
        } catch (error) {
        }
      }
    };
    
    // Check on mount
    checkSlaveAppMeasurements();
    
    // Check periodically
    const intervalId = setInterval(checkSlaveAppMeasurements, 30000);
    
    return () => {
      clearInterval(intervalId);
    };
  }, []);
  
  // Force update the localStorage when the component mounts
  useEffect(() => {
    if (activeSurvey) {
      localStorage.setItem('mainApp_activeSurvey', JSON.stringify(activeSurvey));
    }
  }, []);
  
  return <SlaveAppWithPairing />;
};

export default SlaveAppPage;