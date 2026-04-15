import React from 'react';
import {
  Sun, Moon, Cloud, CloudDrizzle, CloudRain, CloudSnow,
  CloudLightning, CloudFog, Wind, Droplets, Eye, X, CloudSun, CloudMoon,
  CloudHail,
} from 'lucide-react';
import type { CurrentWeather, WeatherIcon } from '../../lib/weather/weatherService';

interface WeatherCardProps {
  weather: CurrentWeather;
  onClose: () => void;
}

function getWeatherIconComponent(icon: WeatherIcon, size = 28) {
  const props = { size, strokeWidth: 1.5 };
  switch (icon) {
    case 'sun':              return <Sun {...props} className="text-yellow-400" />;
    case 'moon':             return <Moon {...props} className="text-blue-200" />;
    case 'cloud-sun':        return <CloudSun {...props} className="text-yellow-300" />;
    case 'cloud-moon':       return <CloudMoon {...props} className="text-blue-300" />;
    case 'cloud':            return <Cloud {...props} className="text-gray-300" />;
    case 'cloud-fog':        return <CloudFog {...props} className="text-gray-400" />;
    case 'cloud-drizzle':    return <CloudDrizzle {...props} className="text-blue-300" />;
    case 'cloud-rain':       return <CloudRain {...props} className="text-blue-400" />;
    case 'cloud-rain-heavy': return <CloudRain {...props} className="text-blue-500" />;
    case 'cloud-snow':       return <CloudSnow {...props} className="text-white" />;
    case 'cloud-hail':       return <CloudHail {...props} className="text-cyan-300" />;
    case 'cloud-lightning':  return <CloudLightning {...props} className="text-yellow-500" />;
    default:                 return <Cloud {...props} className="text-gray-300" />;
  }
}

function formatVisibility(meters: number): string {
  if (meters >= 10000) return `${(meters / 1000).toFixed(0)} km`;
  if (meters >= 1000) return `${(meters / 1000).toFixed(1)} km`;
  return `${meters} m`;
}

function getWindCardinal(deg: number): string {
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  return dirs[Math.round(deg / 45) % 8];
}

const WeatherCard: React.FC<WeatherCardProps> = ({ weather, onClose }) => {
  return (
    <div className="bg-gray-900/90 backdrop-blur-md border border-gray-600/50 rounded-xl p-3 shadow-2xl min-w-[220px] max-w-[260px]">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          {getWeatherIconComponent(weather.icon, 24)}
          <span className="text-sm font-medium text-gray-200">{weather.condition}</span>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded-md hover:bg-gray-700 transition-colors"
        >
          <X size={14} className="text-gray-400" />
        </button>
      </div>

      {/* Temperature */}
      <div className="flex items-baseline gap-1 mb-2">
        <span className="text-3xl font-bold text-white">{weather.temperature}°</span>
        <span className="text-sm text-gray-400">Feels {weather.feelsLike}°</span>
      </div>

      {/* Details grid */}
      <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
        <div className="flex items-center gap-1.5 text-gray-300">
          <Wind size={13} className="text-blue-400 flex-shrink-0" />
          <span>{weather.windSpeed} km/h {getWindCardinal(weather.windDirection)}</span>
        </div>
        <div className="flex items-center gap-1.5 text-gray-300">
          <Droplets size={13} className="text-blue-400 flex-shrink-0" />
          <span>{weather.humidity}%</span>
        </div>
        <div className="flex items-center gap-1.5 text-gray-300">
          <Eye size={13} className="text-green-400 flex-shrink-0" />
          <span>{formatVisibility(weather.visibility)}</span>
        </div>
        <div className="flex items-center gap-1.5 text-gray-300">
          <Cloud size={13} className="text-gray-400 flex-shrink-0" />
          <span>{weather.cloudCover}% cover</span>
        </div>
      </div>

      {/* Precipitation */}
      {weather.precipitation > 0 && (
        <div className="mt-2 px-2 py-1 bg-blue-900/30 border border-blue-500/20 rounded-md text-xs text-blue-300">
          Precipitation: {weather.precipitation} mm
        </div>
      )}
    </div>
  );
};

export default WeatherCard;
