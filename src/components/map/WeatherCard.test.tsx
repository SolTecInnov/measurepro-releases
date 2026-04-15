// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import type { WeatherData } from '../../lib/weather/weatherService';

import WeatherCard from './WeatherCard';

const makeHourly = (count: number) =>
  Array.from({ length: count }, (_, i) => ({
    time: `2026-04-14T${String(i + 8).padStart(2, '0')}:00`,
    hour: `${i + 8 > 12 ? i + 8 - 12 : i + 8} ${i + 8 >= 12 ? 'PM' : 'AM'}`,
    precipitation: i === 3 ? 2.5 : 0,
    precipitationProbability: i === 3 ? 80 : 10,
    snowfall: 0,
    weatherCode: 0,
    condition: 'Clear',
    icon: 'sun' as const,
    temperature: 18 + i,
  }));

const mockWeather: WeatherData = {
  current: {
    temperature: 22,
    feelsLike: 20,
    humidity: 55,
    windSpeed: 15,
    windDirection: 225,
    visibility: 10000,
    weatherCode: 2,
    condition: 'Partly cloudy',
    icon: 'cloud-sun',
    isDay: true,
    precipitation: 0,
    cloudCover: 40,
    fetchedAt: new Date().toISOString(),
  },
  precipitation: {
    totalNext6h: 2.5,
    totalNext12h: 4.0,
    nextPrecipHour: '3 PM',
    precipEndsHour: '5 PM',
    hourly: makeHourly(12),
  },
};

describe('WeatherCard', () => {
  const onClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders without crashing', () => {
    const { container } = render(<WeatherCard weather={mockWeather} onClose={onClose} />);
    expect(container).toBeTruthy();
  });

  it('displays current temperature', () => {
    render(<WeatherCard weather={mockWeather} onClose={onClose} />);
    expect(screen.getByText('22°')).toBeInTheDocument();
  });

  it('displays current condition', () => {
    render(<WeatherCard weather={mockWeather} onClose={onClose} />);
    expect(screen.getByText('Partly cloudy')).toBeInTheDocument();
  });

  it('displays wind speed', () => {
    render(<WeatherCard weather={mockWeather} onClose={onClose} />);
    expect(screen.getByText(/15 km\/h/)).toBeInTheDocument();
  });

  it('displays humidity', () => {
    render(<WeatherCard weather={mockWeather} onClose={onClose} />);
    expect(screen.getByText('55%')).toBeInTheDocument();
  });

  it('displays visibility', () => {
    render(<WeatherCard weather={mockWeather} onClose={onClose} />);
    expect(screen.getByText('10 km')).toBeInTheDocument();
  });

  it('shows precipitation forecast when precipitation expected', () => {
    render(<WeatherCard weather={mockWeather} onClose={onClose} />);
    expect(screen.getByText(/Precipitation expected at 3 PM/)).toBeInTheDocument();
  });

  it('displays precipitation totals', () => {
    render(<WeatherCard weather={mockWeather} onClose={onClose} />);
    expect(screen.getByText('2.5 mm')).toBeInTheDocument();
    expect(screen.getByText('4 mm')).toBeInTheDocument();
  });

  it('shows Hourly Precipitation section', () => {
    render(<WeatherCard weather={mockWeather} onClose={onClose} />);
    expect(screen.getByText('Hourly Precipitation')).toBeInTheDocument();
  });

  it('shows no-precipitation message when dry forecast', () => {
    const dryWeather: WeatherData = {
      ...mockWeather,
      precipitation: {
        totalNext6h: 0,
        totalNext12h: 0,
        nextPrecipHour: null,
        precipEndsHour: null,
        hourly: makeHourly(12).map(h => ({ ...h, precipitation: 0 })),
      },
    };
    render(<WeatherCard weather={dryWeather} onClose={onClose} />);
    expect(screen.getByText(/No precipitation expected/)).toBeInTheDocument();
  });

  it('shows active precipitation message when raining', () => {
    const rainingWeather: WeatherData = {
      ...mockWeather,
      current: { ...mockWeather.current, precipitation: 3.2 },
      precipitation: {
        ...mockWeather.precipitation,
        precipEndsHour: '5 PM',
      },
    };
    render(<WeatherCard weather={rainingWeather} onClose={onClose} />);
    expect(screen.getByText(/Precipitating now/)).toBeInTheDocument();
  });
});
