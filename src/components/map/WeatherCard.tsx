import React from 'react';
import {
  Sun, Moon, Cloud, CloudDrizzle, CloudRain, CloudSnow,
  CloudLightning, CloudFog, Wind, Droplets, Eye, X, CloudSun, CloudMoon,
  CloudHail, Snowflake,
} from 'lucide-react';
import type { WeatherData, WeatherIcon, HourlyForecast } from '../../lib/weather/weatherService';

interface WeatherCardProps {
  weather: WeatherData;
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

function getPrecipBarColor(mm: number, snowfall: number): string {
  if (snowfall > 0) return 'bg-cyan-400';
  if (mm >= 5) return 'bg-blue-500';
  if (mm >= 2) return 'bg-blue-400';
  if (mm > 0) return 'bg-blue-300';
  return 'bg-gray-700';
}

function getPrecipBarHeight(mm: number, maxMm: number): number {
  if (maxMm === 0) return 2;
  return Math.max(2, Math.round((mm / maxMm) * 32));
}

const WeatherCard: React.FC<WeatherCardProps> = ({ weather, onClose }) => {
  const { current, precipitation } = weather;
  const maxPrecip = Math.max(1, ...precipitation.hourly.map(h => h.precipitation + h.snowfall));

  return (
    <div className="bg-gray-900/90 backdrop-blur-md border border-gray-600/50 rounded-xl p-3 shadow-2xl min-w-[280px] max-w-[320px]">
      {/* Header: current conditions */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          {getWeatherIconComponent(current.icon, 22)}
          <span className="text-sm font-medium text-gray-200">{current.condition}</span>
          <span className="text-lg font-bold text-white ml-1">{current.temperature}°</span>
        </div>
        <button onClick={onClose} className="p-1 rounded-md hover:bg-gray-700 transition-colors">
          <X size={14} className="text-gray-400" />
        </button>
      </div>

      {/* Current details row */}
      <div className="flex items-center gap-3 text-xs text-gray-400 mb-3">
        <span className="flex items-center gap-1"><Wind size={11} className="text-blue-400" />{current.windSpeed} km/h {getWindCardinal(current.windDirection)}</span>
        <span className="flex items-center gap-1"><Droplets size={11} className="text-blue-400" />{current.humidity}%</span>
        <span className="flex items-center gap-1"><Eye size={11} className="text-green-400" />{formatVisibility(current.visibility)}</span>
      </div>

      {/* Precipitation alert banner */}
      <div className={`rounded-lg px-3 py-2 mb-3 text-sm font-medium ${
        current.precipitation > 0
          ? 'bg-blue-600/30 border border-blue-500/40 text-blue-200'
          : precipitation.nextPrecipHour
            ? 'bg-amber-600/20 border border-amber-500/30 text-amber-200'
            : 'bg-green-600/20 border border-green-500/30 text-green-200'
      }`}>
        {current.precipitation > 0 ? (
          <>
            <Droplets size={14} className="inline mr-1.5" />
            Precipitating now — {current.precipitation} mm/h
            {precipitation.precipEndsHour && (
              <span className="block text-xs mt-0.5 opacity-80">
                Expected to stop around {precipitation.precipEndsHour}
              </span>
            )}
          </>
        ) : precipitation.nextPrecipHour ? (
          <>
            <CloudRain size={14} className="inline mr-1.5" />
            Precipitation expected at {precipitation.nextPrecipHour}
            {precipitation.totalNext6h > 0 && (
              <span className="block text-xs mt-0.5 opacity-80">
                ~{precipitation.totalNext6h} mm in next 6h
              </span>
            )}
          </>
        ) : (
          <>
            <Sun size={14} className="inline mr-1.5" />
            No precipitation expected (next 12h)
          </>
        )}
      </div>

      {/* Precipitation totals */}
      {(precipitation.totalNext6h > 0 || precipitation.totalNext12h > 0) && (
        <div className="flex gap-3 mb-3 text-xs">
          <div className="flex-1 bg-gray-800/60 rounded-lg px-2 py-1.5 text-center">
            <div className="text-gray-400">Next 6h</div>
            <div className="text-white font-bold">{precipitation.totalNext6h} mm</div>
          </div>
          <div className="flex-1 bg-gray-800/60 rounded-lg px-2 py-1.5 text-center">
            <div className="text-gray-400">Next 12h</div>
            <div className="text-white font-bold">{precipitation.totalNext12h} mm</div>
          </div>
        </div>
      )}

      {/* Hourly precipitation bar chart */}
      <div className="mb-1">
        <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Hourly Precipitation</div>
        <div className="flex items-end gap-[3px] h-[40px]">
          {precipitation.hourly.map((h, i) => {
            const total = h.precipitation + h.snowfall;
            const barH = getPrecipBarHeight(total, maxPrecip);
            return (
              <div key={i} className="flex-1 flex flex-col items-center justify-end" title={`${h.hour}: ${total.toFixed(1)} mm${h.snowfall > 0 ? ` (${h.snowfall} cm snow)` : ''} — ${h.precipitationProbability}% chance`}>
                <div
                  className={`w-full rounded-t-sm ${getPrecipBarColor(h.precipitation, h.snowfall)} transition-all`}
                  style={{ height: `${barH}px` }}
                />
              </div>
            );
          })}
        </div>
        {/* Hour labels (every 2 hours) */}
        <div className="flex gap-[3px] mt-0.5">
          {precipitation.hourly.map((h, i) => (
            <div key={i} className="flex-1 text-center">
              {i % 2 === 0 ? (
                <span className="text-[9px] text-gray-500">{h.hour.replace(' AM', 'a').replace(' PM', 'p')}</span>
              ) : null}
            </div>
          ))}
        </div>
        {/* Probability row */}
        <div className="flex gap-[3px] mt-0.5">
          {precipitation.hourly.map((h, i) => (
            <div key={i} className="flex-1 text-center">
              {i % 3 === 0 && h.precipitationProbability > 0 ? (
                <span className="text-[9px] text-blue-400">{h.precipitationProbability}%</span>
              ) : null}
            </div>
          ))}
        </div>
      </div>

      {/* Snow indicator */}
      {precipitation.hourly.some(h => h.snowfall > 0) && (
        <div className="flex items-center gap-1.5 text-xs text-cyan-300 mt-1">
          <Snowflake size={12} />
          <span>Snow expected — {precipitation.hourly.reduce((s, h) => s + h.snowfall, 0).toFixed(1)} cm total</span>
        </div>
      )}
    </div>
  );
};

export default WeatherCard;
