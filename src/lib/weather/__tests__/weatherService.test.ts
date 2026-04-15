import { describe, it, expect, vi, beforeEach } from 'vitest';

// Stub fetch globally before imports
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// Stub AbortSignal.timeout
vi.stubGlobal('AbortSignal', {
  timeout: vi.fn(() => ({})),
});

import {
  fetchWeatherData,
  getRadarTileUrl,
  fetchRadarFrames,
} from '../weatherService';

describe('weatherService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('fetchWeatherData', () => {
    const mockOpenMeteoResponse = {
      current: {
        temperature_2m: 18.5,
        apparent_temperature: 16.2,
        relative_humidity_2m: 65,
        wind_speed_10m: 12.3,
        wind_direction_10m: 180,
        weather_code: 0,
        is_day: 1,
        precipitation: 0,
        cloud_cover: 20,
        visibility: 10000,
      },
      hourly: {
        time: [
          '2026-04-14T13:00',
          '2026-04-14T14:00',
          '2026-04-14T15:00',
        ],
        temperature_2m: [18, 19, 20],
        precipitation: [0, 0, 1.2],
        precipitation_probability: [0, 10, 60],
        snowfall: [0, 0, 0],
        weather_code: [0, 2, 63],
      },
    };

    it('fetches and parses weather data correctly', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockOpenMeteoResponse,
      });

      const data = await fetchWeatherData(45.5, -73.5);

      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(data.current.temperature).toBe(19); // Math.round(18.5)
      expect(data.current.feelsLike).toBe(16); // Math.round(16.2)
      expect(data.current.humidity).toBe(65);
      expect(data.current.windSpeed).toBe(12);
      expect(data.current.condition).toBe('Clear sky');
      expect(data.current.icon).toBe('sun');
      expect(data.current.isDay).toBe(true);
    });

    it('builds hourly forecast from response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockOpenMeteoResponse,
      });

      const data = await fetchWeatherData(45.5, -73.5);

      expect(data.precipitation.hourly).toHaveLength(3);
      expect(data.precipitation.hourly[0].hour).toBe('1 PM');
      expect(data.precipitation.hourly[2].precipitation).toBe(1.2);
      expect(data.precipitation.hourly[2].condition).toBe('Moderate rain');
    });

    it('computes precipitation summary (dry now, precip later)', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockOpenMeteoResponse,
      });

      const data = await fetchWeatherData(45.5, -73.5);

      // Currently dry (precipitation=0), precip starts at hour index 2
      expect(data.precipitation.nextPrecipHour).toBe('3 PM');
      expect(data.precipitation.precipEndsHour).toBeNull();
      expect(data.precipitation.totalNext6h).toBeGreaterThanOrEqual(0);
    });

    it('computes precipitation summary when currently raining', async () => {
      const rainingResponse = {
        ...mockOpenMeteoResponse,
        current: {
          ...mockOpenMeteoResponse.current,
          precipitation: 2.0,
        },
        hourly: {
          ...mockOpenMeteoResponse.hourly,
          precipitation: [1.0, 0.5, 0],
          snowfall: [0, 0, 0],
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => rainingResponse,
      });

      const data = await fetchWeatherData(45.5, -73.5);

      expect(data.precipitation.nextPrecipHour).toBeNull();
      expect(data.precipitation.precipEndsHour).toBe('3 PM');
    });

    it('throws on non-OK response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      await expect(fetchWeatherData(45.5, -73.5)).rejects.toThrow('Open-Meteo error: 500');
    });

    it('includes night icon for nighttime weather', async () => {
      const nightResponse = {
        ...mockOpenMeteoResponse,
        current: {
          ...mockOpenMeteoResponse.current,
          is_day: 0,
          weather_code: 2,
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => nightResponse,
      });

      const data = await fetchWeatherData(45.5, -73.5);
      expect(data.current.icon).toBe('cloud-moon');
      expect(data.current.isDay).toBe(false);
    });
  });

  describe('fetchRadarFrames', () => {
    it('fetches and returns radar frames', async () => {
      // Reset the internal cache by importing fresh module
      vi.resetModules();
      vi.stubGlobal('fetch', mockFetch);
      vi.stubGlobal('AbortSignal', { timeout: vi.fn(() => ({})) });

      const { fetchRadarFrames: freshFetchRadarFrames } = await import('../weatherService');

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          radar: {
            past: [
              { path: '/v2/radar/1234', time: 1234567890 },
              { path: '/v2/radar/1235', time: 1234567900 },
            ],
          },
        }),
      });

      const frames = await freshFetchRadarFrames();
      expect(frames).toHaveLength(2);
      expect(frames[0].path).toBe('/v2/radar/1234');
      expect(frames[1].time).toBe(1234567900);
    });

    it('throws on error response', async () => {
      vi.resetModules();
      vi.stubGlobal('fetch', mockFetch);
      vi.stubGlobal('AbortSignal', { timeout: vi.fn(() => ({})) });

      const { fetchRadarFrames: freshFetchRadarFrames } = await import('../weatherService');

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 503,
      });

      await expect(freshFetchRadarFrames()).rejects.toThrow('RainViewer error: 503');
    });
  });

  describe('getRadarTileUrl', () => {
    it('returns tile URL from latest frame', async () => {
      vi.resetModules();
      vi.stubGlobal('fetch', mockFetch);
      vi.stubGlobal('AbortSignal', { timeout: vi.fn(() => ({})) });

      const { getRadarTileUrl: freshGetRadarTileUrl } = await import('../weatherService');

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          radar: {
            past: [
              { path: '/v2/radar/abc', time: 100 },
              { path: '/v2/radar/def', time: 200 },
            ],
          },
        }),
      });

      const url = await freshGetRadarTileUrl();
      expect(url).toBe(
        'https://tilecache.rainviewer.com/v2/radar/def/256/{z}/{x}/{y}/2/1_1.png'
      );
    });

    it('returns null when no frames available', async () => {
      vi.resetModules();
      vi.stubGlobal('fetch', mockFetch);
      vi.stubGlobal('AbortSignal', { timeout: vi.fn(() => ({})) });

      const { getRadarTileUrl: freshGetRadarTileUrl } = await import('../weatherService');

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          radar: { past: [] },
        }),
      });

      const url = await freshGetRadarTileUrl();
      expect(url).toBeNull();
    });

    it('returns null on fetch error', async () => {
      vi.resetModules();
      vi.stubGlobal('fetch', mockFetch);
      vi.stubGlobal('AbortSignal', { timeout: vi.fn(() => ({})) });

      const { getRadarTileUrl: freshGetRadarTileUrl } = await import('../weatherService');

      mockFetch.mockRejectedValueOnce(new Error('network error'));

      const url = await freshGetRadarTileUrl();
      expect(url).toBeNull();
    });
  });

  describe('formatHour (tested indirectly through hourly forecast)', () => {
    it('formats midnight as "12 AM"', async () => {
      const response = {
        current: {
          temperature_2m: 10,
          apparent_temperature: 8,
          relative_humidity_2m: 50,
          wind_speed_10m: 5,
          wind_direction_10m: 0,
          weather_code: 0,
          is_day: 0,
          precipitation: 0,
          cloud_cover: 0,
          visibility: 10000,
        },
        hourly: {
          time: ['2026-04-14T00:00'],
          temperature_2m: [10],
          precipitation: [0],
          precipitation_probability: [0],
          snowfall: [0],
          weather_code: [0],
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => response,
      });

      const data = await fetchWeatherData(45.5, -73.5);
      expect(data.precipitation.hourly[0].hour).toBe('12 AM');
    });

    it('formats noon as "12 PM"', async () => {
      const response = {
        current: {
          temperature_2m: 10,
          apparent_temperature: 8,
          relative_humidity_2m: 50,
          wind_speed_10m: 5,
          wind_direction_10m: 0,
          weather_code: 0,
          is_day: 1,
          precipitation: 0,
          cloud_cover: 0,
          visibility: 10000,
        },
        hourly: {
          time: ['2026-04-14T12:00'],
          temperature_2m: [20],
          precipitation: [0],
          precipitation_probability: [0],
          snowfall: [0],
          weather_code: [0],
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => response,
      });

      const data = await fetchWeatherData(45.5, -73.5);
      expect(data.precipitation.hourly[0].hour).toBe('12 PM');
    });

    it('formats 3 PM correctly', async () => {
      const response = {
        current: {
          temperature_2m: 10,
          apparent_temperature: 8,
          relative_humidity_2m: 50,
          wind_speed_10m: 5,
          wind_direction_10m: 0,
          weather_code: 0,
          is_day: 1,
          precipitation: 0,
          cloud_cover: 0,
          visibility: 10000,
        },
        hourly: {
          time: ['2026-04-14T15:00'],
          temperature_2m: [22],
          precipitation: [0],
          precipitation_probability: [0],
          snowfall: [0],
          weather_code: [0],
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => response,
      });

      const data = await fetchWeatherData(45.5, -73.5);
      expect(data.precipitation.hourly[0].hour).toBe('3 PM');
    });
  });
});
