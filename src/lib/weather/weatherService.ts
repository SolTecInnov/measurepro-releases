/**
 * Weather Service — Open-Meteo (current weather) + RainViewer (radar tiles)
 * Both APIs are free and require no API key.
 */

// ── Types ────────────────────────────────────────────────────────────────────

export interface CurrentWeather {
  temperature: number;        // °C
  feelsLike: number;          // °C
  humidity: number;           // %
  windSpeed: number;          // km/h
  windDirection: number;      // degrees
  visibility: number;         // meters
  weatherCode: number;        // WMO weather code
  condition: string;          // Human-readable condition
  icon: WeatherIcon;          // Icon identifier
  isDay: boolean;
  precipitation: number;     // mm
  cloudCover: number;        // %
  fetchedAt: string;         // ISO timestamp
}

export type WeatherIcon =
  | 'sun' | 'moon'
  | 'cloud-sun' | 'cloud-moon'
  | 'cloud' | 'cloud-fog'
  | 'cloud-drizzle' | 'cloud-rain' | 'cloud-rain-heavy'
  | 'cloud-snow' | 'cloud-hail'
  | 'cloud-lightning';

export interface HourlyForecast {
  time: string;               // ISO hour (e.g. "2026-04-14T15:00")
  hour: string;               // Display (e.g. "3 PM")
  precipitation: number;      // mm
  precipitationProbability: number; // %
  snowfall: number;           // cm
  weatherCode: number;
  condition: string;
  icon: WeatherIcon;
  temperature: number;        // °C
}

export interface PrecipitationSummary {
  totalNext6h: number;        // mm total in next 6 hours
  totalNext12h: number;       // mm total in next 12 hours
  nextPrecipHour: string | null; // When precipitation starts (or null if dry)
  precipEndsHour: string | null; // When precipitation stops (or null)
  hourly: HourlyForecast[];   // Next 12 hours
}

export interface RadarFrame {
  path: string;
  time: number; // unix timestamp
}

// ── WMO Weather Code → Condition + Icon ──────────────────────────────────────

function decodeWMO(code: number, isDay: boolean): { condition: string; icon: WeatherIcon } {
  const map: Record<number, { condition: string; dayIcon: WeatherIcon; nightIcon: WeatherIcon }> = {
    0:  { condition: 'Clear sky',           dayIcon: 'sun',              nightIcon: 'moon' },
    1:  { condition: 'Mainly clear',        dayIcon: 'sun',              nightIcon: 'moon' },
    2:  { condition: 'Partly cloudy',       dayIcon: 'cloud-sun',        nightIcon: 'cloud-moon' },
    3:  { condition: 'Overcast',            dayIcon: 'cloud',            nightIcon: 'cloud' },
    45: { condition: 'Fog',                 dayIcon: 'cloud-fog',        nightIcon: 'cloud-fog' },
    48: { condition: 'Depositing rime fog', dayIcon: 'cloud-fog',        nightIcon: 'cloud-fog' },
    51: { condition: 'Light drizzle',       dayIcon: 'cloud-drizzle',    nightIcon: 'cloud-drizzle' },
    53: { condition: 'Moderate drizzle',    dayIcon: 'cloud-drizzle',    nightIcon: 'cloud-drizzle' },
    55: { condition: 'Dense drizzle',       dayIcon: 'cloud-drizzle',    nightIcon: 'cloud-drizzle' },
    56: { condition: 'Freezing drizzle',    dayIcon: 'cloud-drizzle',    nightIcon: 'cloud-drizzle' },
    57: { condition: 'Heavy freezing drizzle', dayIcon: 'cloud-rain',    nightIcon: 'cloud-rain' },
    61: { condition: 'Slight rain',         dayIcon: 'cloud-drizzle',    nightIcon: 'cloud-drizzle' },
    63: { condition: 'Moderate rain',       dayIcon: 'cloud-rain',       nightIcon: 'cloud-rain' },
    65: { condition: 'Heavy rain',          dayIcon: 'cloud-rain-heavy', nightIcon: 'cloud-rain-heavy' },
    66: { condition: 'Freezing rain',       dayIcon: 'cloud-rain',       nightIcon: 'cloud-rain' },
    67: { condition: 'Heavy freezing rain', dayIcon: 'cloud-rain-heavy', nightIcon: 'cloud-rain-heavy' },
    71: { condition: 'Slight snow',         dayIcon: 'cloud-snow',       nightIcon: 'cloud-snow' },
    73: { condition: 'Moderate snow',       dayIcon: 'cloud-snow',       nightIcon: 'cloud-snow' },
    75: { condition: 'Heavy snow',          dayIcon: 'cloud-snow',       nightIcon: 'cloud-snow' },
    77: { condition: 'Snow grains',         dayIcon: 'cloud-snow',       nightIcon: 'cloud-snow' },
    80: { condition: 'Slight rain showers', dayIcon: 'cloud-rain',       nightIcon: 'cloud-rain' },
    81: { condition: 'Moderate rain showers', dayIcon: 'cloud-rain',     nightIcon: 'cloud-rain' },
    82: { condition: 'Violent rain showers', dayIcon: 'cloud-rain-heavy', nightIcon: 'cloud-rain-heavy' },
    85: { condition: 'Slight snow showers', dayIcon: 'cloud-snow',       nightIcon: 'cloud-snow' },
    86: { condition: 'Heavy snow showers',  dayIcon: 'cloud-snow',       nightIcon: 'cloud-snow' },
    95: { condition: 'Thunderstorm',        dayIcon: 'cloud-lightning',  nightIcon: 'cloud-lightning' },
    96: { condition: 'Thunderstorm with hail', dayIcon: 'cloud-hail',   nightIcon: 'cloud-hail' },
    99: { condition: 'Thunderstorm with heavy hail', dayIcon: 'cloud-hail', nightIcon: 'cloud-hail' },
  };
  const entry = map[code] || map[0]!;
  return { condition: entry.condition, icon: isDay ? entry.dayIcon : entry.nightIcon };
}

function getWindCardinal(deg: number): string {
  const dirs = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  return dirs[Math.round(deg / 22.5) % 16];
}

// ── Current Weather (Open-Meteo) ─────────────────────────────────────────────

export interface WeatherData {
  current: CurrentWeather;
  precipitation: PrecipitationSummary;
}

function formatHour(isoTime: string): string {
  const d = new Date(isoTime);
  const h = d.getHours();
  if (h === 0) return '12 AM';
  if (h < 12) return `${h} AM`;
  if (h === 12) return '12 PM';
  return `${h - 12} PM`;
}

export async function fetchWeatherData(lat: number, lon: number): Promise<WeatherData> {
  const params = new URLSearchParams({
    latitude: lat.toFixed(4),
    longitude: lon.toFixed(4),
    current: [
      'temperature_2m', 'apparent_temperature', 'relative_humidity_2m',
      'wind_speed_10m', 'wind_direction_10m', 'weather_code',
      'is_day', 'precipitation', 'cloud_cover', 'visibility',
    ].join(','),
    hourly: [
      'temperature_2m', 'precipitation', 'precipitation_probability',
      'snowfall', 'weather_code',
    ].join(','),
    forecast_hours: '12',
    wind_speed_unit: 'kmh',
    timezone: 'auto',
  });

  const res = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`, {
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`Open-Meteo error: ${res.status}`);

  const data = await res.json();

  // Current weather
  const c = data.current;
  const isDay = c.is_day === 1;
  const { condition, icon } = decodeWMO(c.weather_code, isDay);

  const current: CurrentWeather = {
    temperature: Math.round(c.temperature_2m),
    feelsLike: Math.round(c.apparent_temperature),
    humidity: c.relative_humidity_2m,
    windSpeed: Math.round(c.wind_speed_10m),
    windDirection: c.wind_direction_10m,
    visibility: c.visibility,
    weatherCode: c.weather_code,
    condition,
    icon,
    isDay,
    precipitation: c.precipitation,
    cloudCover: c.cloud_cover,
    fetchedAt: new Date().toISOString(),
  };

  // Hourly precipitation forecast (next 12 hours)
  const h = data.hourly;
  const hourly: HourlyForecast[] = [];
  const count = Math.min(12, h.time?.length || 0);

  for (let i = 0; i < count; i++) {
    const wmo = decodeWMO(h.weather_code[i], true);
    hourly.push({
      time: h.time[i],
      hour: formatHour(h.time[i]),
      precipitation: h.precipitation[i] || 0,
      precipitationProbability: h.precipitation_probability[i] || 0,
      snowfall: h.snowfall[i] || 0,
      weatherCode: h.weather_code[i],
      condition: wmo.condition,
      icon: wmo.icon,
      temperature: Math.round(h.temperature_2m[i]),
    });
  }

  // Compute summary
  const totalNext6h = hourly.slice(0, 6).reduce((s, h) => s + h.precipitation + h.snowfall, 0);
  const totalNext12h = hourly.reduce((s, h) => s + h.precipitation + h.snowfall, 0);

  // When does precipitation start?
  const nowHasPrecip = current.precipitation > 0;
  let nextPrecipHour: string | null = null;
  let precipEndsHour: string | null = null;

  if (nowHasPrecip) {
    // Currently precipitating — when does it stop?
    const stopIdx = hourly.findIndex(h => h.precipitation === 0 && h.snowfall === 0);
    precipEndsHour = stopIdx >= 0 ? hourly[stopIdx].hour : null;
  } else {
    // Currently dry — when does it start?
    const startIdx = hourly.findIndex(h => h.precipitation > 0 || h.snowfall > 0);
    nextPrecipHour = startIdx >= 0 ? hourly[startIdx].hour : null;
  }

  return {
    current,
    precipitation: {
      totalNext6h: Math.round(totalNext6h * 10) / 10,
      totalNext12h: Math.round(totalNext12h * 10) / 10,
      nextPrecipHour,
      precipEndsHour,
      hourly,
    },
  };
}

/** @deprecated Use fetchWeatherData instead */
export async function fetchCurrentWeather(lat: number, lon: number): Promise<CurrentWeather> {
  const data = await fetchWeatherData(lat, lon);
  return data.current;
}

// ── Radar Frames (RainViewer) ────────────────────────────────────────────────

let cachedRadarFrames: RadarFrame[] = [];
let lastRadarFetch = 0;
const RADAR_CACHE_MS = 5 * 60 * 1000; // 5 minutes

export async function fetchRadarFrames(): Promise<RadarFrame[]> {
  if (Date.now() - lastRadarFetch < RADAR_CACHE_MS && cachedRadarFrames.length > 0) {
    return cachedRadarFrames;
  }

  const res = await fetch('https://api.rainviewer.com/public/weather-maps.json', {
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) throw new Error(`RainViewer error: ${res.status}`);

  const data = await res.json();
  // Use the most recent radar frame
  cachedRadarFrames = (data.radar?.past || []).map((f: any) => ({
    path: f.path,
    time: f.time,
  }));

  lastRadarFetch = Date.now();
  return cachedRadarFrames;
}

/**
 * Get the tile URL for the latest radar frame.
 * Returns null if no frames available.
 * Template: https://tilecache.rainviewer.com{path}/256/{z}/{x}/{y}/{color}/{smooth}_{snow}.png
 *   color scheme 4 = dark sky (vivid colors for dark map backgrounds)
 *   smooth=1, snow=1
 */
export async function getRadarTileUrl(): Promise<string | null> {
  try {
    const frames = await fetchRadarFrames();
    if (frames.length === 0) return null;
    const latest = frames[frames.length - 1];
    return `https://tilecache.rainviewer.com${latest.path}/256/{z}/{x}/{y}/4/1_1.png`;
  } catch {
    return null;
  }
}
