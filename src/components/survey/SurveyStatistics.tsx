import React, { useEffect, useState } from 'react';
import { PieChart, BarChart2, Activity, Map as MapIcon, AlertTriangle, Clock, Camera, Video } from 'lucide-react';
import { openSurveyDB } from '../../lib/survey/db';
import { Survey } from '../../lib/survey/types';
import { calculateDistance } from '../../lib/utils/geoUtils';
import { useCameraStore } from '../../lib/camera';
import { openDB } from 'idb';

interface SurveyStatisticsProps {
  activeSurvey: Survey;
}

const SurveyStatistics: React.FC<SurveyStatisticsProps> = ({ activeSurvey }) => {
  const { timelapseFrames } = useCameraStore();
  const [statistics, setStatistics] = useState({
    totalPOIs: 0,
    totalDistance: 0,
    warningAlerts: 0,
    criticalAlerts: 0,
    poiByType: {} as Record<string, number>,
    timelapseCount: 0,
    timelapseWithPOI: 0,
    videoCount: 0,
    videoDurationMinutes: 0
  });

  useEffect(() => {
    if (!activeSurvey) return;

    const calculateStatistics = async () => {
      try {
        // Open the database
        const db = await openSurveyDB();
        
        // Get all measurements for this survey
        let measurements = await db.getAllFromIndex('measurements', 'by-date');
        measurements = measurements.filter((m: any) => m.user_id === activeSurvey.id);
        
        // Calculate total POIs
        const totalPOIs = measurements.length;
        
        // Count POIs by type
        const poiByType = measurements.reduce((acc: Record<string, number>, m: any) => {
          const poiType = m.poi_type || 'none';
          acc[poiType] = (acc[poiType] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);
        
        // Calculate total distance traveled
        let totalDistance = 0;
        if (measurements.length > 1) {
          // Sort by creation time
          measurements.sort((a: any, b: any) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
          
          // Calculate distance between consecutive points
          for (let i = 1; i < measurements.length; i++) {
            const prevPoint = measurements[i-1];
            const currPoint = measurements[i];
            
            totalDistance += calculateDistance(
              prevPoint.latitude, prevPoint.longitude, 
              currPoint.latitude, currPoint.longitude
            );
          }
        }
        
        // Count warning and critical alerts
        let warningAlerts = 0;
        let criticalAlerts = 0;
        
        measurements.forEach((m: any) => {
          if (m.note?.includes('WARNING Alert')) warningAlerts++;
          if (m.note?.includes('DANGER Alert')) criticalAlerts++;
        });
        
        // Get timelapse stats from camera store
        const timelapseCount = timelapseFrames.length;
        const timelapseWithPOI = timelapseFrames.filter(f => f.hasPOI).length;
        
        // Get video recordings stats
        let videoCount = 0;
        let videoDurationMinutes = 0;
        try {
          const videoDB = await openDB('MeasureProVideo', 1);
          if (videoDB.objectStoreNames.contains('videoRecordings')) {
            const allVideos = await videoDB.getAll('videoRecordings');
            const surveyVideos = allVideos.filter((v: any) => v.surveyId === activeSurvey.id);
            videoCount = surveyVideos.length;
            videoDurationMinutes = surveyVideos.reduce((acc: number, v: any) => {
              return acc + ((v.duration || 0) / 60);
            }, 0);
          }
          videoDB.close();
        } catch (e) {
          // Video DB may not exist yet
        }
        
        setStatistics({
          totalPOIs,
          totalDistance,
          warningAlerts,
          criticalAlerts,
          poiByType,
          timelapseCount,
          timelapseWithPOI,
          videoCount,
          videoDurationMinutes
        });
        
      } catch (error) {
      }
    };
    
    calculateStatistics();
    
    // Set up interval to refresh statistics every 30 seconds
    const intervalId = setInterval(calculateStatistics, 30000);
    return () => clearInterval(intervalId);
    
  }, [activeSurvey, timelapseFrames]);

  return (
    <div className="mt-6 pt-4 border-t border-green-500/30">
      <h4 className="text-base font-medium mb-4 flex items-center gap-2">
        <Activity className="w-4 h-4 text-blue-400" />
        Survey Statistics
      </h4>
      
      <div className="grid grid-cols-3 gap-4">
        {/* Total POIs */}
        <div className="bg-gray-700/50 p-3 rounded-lg">
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm text-gray-300">Total POIs</span>
            <PieChart className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-xl font-bold">{statistics.totalPOIs}</div>
        </div>
        
        {/* Total Distance */}
        <div className="bg-gray-700/50 p-3 rounded-lg">
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm text-gray-300">Distance</span>
            <MapIcon className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-xl font-bold">{statistics.totalDistance.toFixed(1)} km</div>
        </div>
        
        {/* Alerts */}
        <div className="bg-gray-700/50 p-3 rounded-lg">
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm text-gray-300">Alerts</span>
            <AlertTriangle className="w-4 h-4 text-blue-400" />
          </div>
          <div className="flex items-center gap-3">
            <div className="text-yellow-400 font-bold">{statistics.warningAlerts} <span className="text-xs">warn</span></div>
            <div className="text-red-400 font-bold">{statistics.criticalAlerts} <span className="text-xs">crit</span></div>
          </div>
        </div>
        
        {/* Elapsed Time */}
        <div className="bg-gray-700/50 p-3 rounded-lg">
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm text-gray-300">Duration</span>
            <Clock className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-xl font-bold">
            {Math.floor((Date.now() - new Date(activeSurvey.createdAt).getTime()) / 3600000)} hrs
          </div>
        </div>
        
        {/* Timelapse Frames */}
        <div className="bg-gray-700/50 p-3 rounded-lg">
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm text-gray-300">Timelapse</span>
            <Camera className="w-4 h-4 text-purple-400" />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xl font-bold text-purple-400">{statistics.timelapseCount}</span>
            <span className="text-xs text-gray-400">frames</span>
            {statistics.timelapseWithPOI > 0 && (
              <span className="text-xs text-yellow-400">({statistics.timelapseWithPOI} POI)</span>
            )}
          </div>
        </div>
        
        {/* Video Recordings */}
        <div className="bg-gray-700/50 p-3 rounded-lg">
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm text-gray-300">Videos</span>
            <Video className="w-4 h-4 text-green-400" />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xl font-bold text-green-400">{statistics.videoCount}</span>
            <span className="text-xs text-gray-400">clips</span>
            {statistics.videoDurationMinutes > 0 && (
              <span className="text-xs text-gray-400">({statistics.videoDurationMinutes.toFixed(1)} min)</span>
            )}
          </div>
        </div>
      </div>
      
      {/* POIs by Type */}
      {statistics?.poiByType && Object.keys(statistics.poiByType).length > 0 && (
        <div className="mt-4">
          <h5 className="text-sm font-medium mb-2 flex items-center gap-2">
            <BarChart2 className="w-4 h-4 text-blue-400" />
            POIs by Type
          </h5>
          <div className="grid grid-cols-4 gap-2 text-sm">
            {Object.entries(statistics.poiByType || {}).map(([type, count]) => (
              type !== 'none' && (
                <div key={type} className="flex items-center justify-between bg-gray-700/30 px-3 py-1.5 rounded">
                  <span className="capitalize">{type}</span>
                  <span className="font-bold">{count}</span>
                </div>
              )
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default SurveyStatistics;