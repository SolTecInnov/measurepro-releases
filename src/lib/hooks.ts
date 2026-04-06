import { useEffect } from 'react';
import { getSettingsByCategory, getSetting } from './settings';
import { useSettingsStore } from './settings';
import { useSurveyStore } from './survey/store';
import { useSerialStore } from './stores/serialStore';
import { usePOIStore } from './poi';
import { useLaserStore } from './laser';

export const useLoadSettings = () => {
  const {
    setLaserSettings,
    setGPSSettings,
    setCameraSettings,
    setMapSettings,
    setLoggingSettings,
    setAlertSettings
  } = useSettingsStore();
  const { setLaserType } = useSerialStore();
  const { setGroundReferenceHeight } = useLaserStore();

  useEffect(() => {
    const loadSettings = async () => {
      const categories = ['laser', 'gps', 'camera', 'map', 'logging', 'alerts'];
      
      // Load laser type and config first
      const savedLaserType = await getSetting('laser', 'laserType');
      if (savedLaserType && typeof savedLaserType === 'string') {
        setLaserType(savedLaserType as any);
      } else {
        // Try localStorage fallback
        const localLaserType = localStorage.getItem('laserType');
        if (localLaserType) {
          setLaserType(localLaserType as any);
        }
      }

      // Load ground reference height
      const savedGroundRef = await getSetting('laser', 'groundReferenceHeight');
      if (savedGroundRef !== null && savedGroundRef !== undefined) {
        setGroundReferenceHeight(savedGroundRef);
      } else {
        // Try localStorage as fallback
        const localStorageGroundRef = localStorage.getItem('groundReferenceHeight');
        if (localStorageGroundRef) {
          const value = parseFloat(localStorageGroundRef);
          if (!isNaN(value)) {
            setGroundReferenceHeight(value);
          }
        } else {
          // Set default value if nothing is found
          setGroundReferenceHeight(0.0);
        }
      }
      
      const setters: Record<string, (settings: any) => Promise<void>> = {
        laser: setLaserSettings,
        gps: setGPSSettings,
        camera: setCameraSettings,
        map: setMapSettings,
        logging: setLoggingSettings,
        alerts: setAlertSettings
      };

      // Load all settings
      for (const category of categories) {
        const settings = await getSettingsByCategory(category);
        if (Object.keys(settings).length > 0) {
          const setter = setters[category];
          if (setter) {
            setter(settings[`${category}Settings`]);
          }
        }
      }
    };

    loadSettings();
  }, []);
};

export const useLoadSurvey = () => {
  const { loadSurveys } = useSurveyStore();
  const { setSelectedType } = usePOIStore();

  useEffect(() => {
    loadSurveys();
    
    // Reset POI type to none when app loads
    setSelectedType('');
  }, []);
};