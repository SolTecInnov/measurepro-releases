import { OverheadAggregator } from './overhead-aggregator';
import type { Sample, POI } from './types';

export function runTests() {
  
  testBridge();
  testUtilWires();
  testHVWires();
  testCityMode();
  
}

function testBridge() {
  const agg = new OverheadAggregator();
  agg.setPendingTag('bridge');
  
  const pois: POI[] = [];
  let t = 0;
  
  for (let i = 0; i < 10; i++) {
    pois.push(...agg.feed({
      t: t += 100,
      lat: 45.5 + i * 0.0001,
      lon: -73.5,
      headingDeg: 90,
      speedKph: 50,
      rawDistM: null
    }));
  }
  
  for (let i = 0; i < 20; i++) {
    const d = 5.5 - (i < 10 ? i : 20 - i) * 0.2;
    pois.push(...agg.feed({
      t: t += 100,
      lat: 45.5 + (10 + i) * 0.0001,
      lon: -73.5,
      headingDeg: 90,
      speedKph: 50,
      rawDistM: d
    }));
  }
  
  for (let i = 0; i < 10; i++) {
    pois.push(...agg.feed({
      t: t += 100,
      lat: 45.5 + (30 + i) * 0.0001,
      lon: -73.5,
      headingDeg: 90,
      speedKph: 50,
      rawDistM: null
    }));
  }
}

function testUtilWires() {
  const agg = new OverheadAggregator();
  agg.setPendingTag('wires_util');
  
  const pois: POI[] = [];
  let t = 0;
  
  for (let i = 0; i < 10; i++) {
    pois.push(...agg.feed({
      t: t += 100,
      lat: 45.5 + i * 0.0001,
      lon: -73.5,
      headingDeg: 90,
      speedKph: 30,
      rawDistM: null
    }));
  }
  
  for (let i = 0; i < 30; i++) {
    const d = 6.0 + Math.sin(i * 0.5) * 0.3;
    pois.push(...agg.feed({
      t: t += 100,
      lat: 45.5 + (10 + i) * 0.0001,
      lon: -73.5,
      headingDeg: 90,
      speedKph: 30,
      rawDistM: d
    }));
  }
  
  for (let i = 0; i < 10; i++) {
    pois.push(...agg.feed({
      t: t += 100,
      lat: 45.5 + (40 + i) * 0.0001,
      lon: -73.5,
      headingDeg: 90,
      speedKph: 30,
      rawDistM: null
    }));
  }
}

function testHVWires() {
  const agg = new OverheadAggregator();
  agg.setPendingTag('wires_hv');
  
  const pois: POI[] = [];
  let t = 0;
  
  for (let i = 0; i < 10; i++) {
    pois.push(...agg.feed({
      t: t += 100,
      lat: 45.5 + i * 0.0001,
      lon: -73.5,
      headingDeg: 90,
      speedKph: 60,
      rawDistM: null
    }));
  }
  
  for (let i = 0; i < 15; i++) {
    const conductors = [8.0, 8.3, 8.6];
    const d = conductors[i % 3] + (Math.random() - 0.5) * 0.05;
    pois.push(...agg.feed({
      t: t += 100,
      lat: 45.5 + (10 + i) * 0.0001,
      lon: -73.5,
      headingDeg: 90,
      speedKph: 60,
      rawDistM: d
    }));
  }
  
  for (let i = 0; i < 10; i++) {
    pois.push(...agg.feed({
      t: t += 100,
      lat: 45.5 + (25 + i) * 0.0001,
      lon: -73.5,
      headingDeg: 90,
      speedKph: 60,
      rawDistM: null
    }));
  }
}

function testCityMode() {
  const agg = new OverheadAggregator();
  agg.setCityMode(true);
  agg.setPendingTag('wires_util');
  
  const pois: POI[] = [];
  let t = 0;
  
  for (let i = 0; i < 10; i++) {
    pois.push(...agg.feed({
      t: t += 100,
      lat: 45.5 + i * 0.0001,
      lon: -73.5,
      headingDeg: 90,
      speedKph: 20,
      rawDistM: null
    }));
  }
  
  for (let i = 0; i < 100; i++) {
    const d = 6.0 + Math.sin(i * 0.3) * 0.4;
    pois.push(...agg.feed({
      t: t += 100,
      lat: 45.5 + (10 + i) * 0.0001,
      lon: -73.5,
      headingDeg: 90,
      speedKph: 20,
      rawDistM: d
    }));
  }
  
  for (let i = 0; i < 10; i++) {
    pois.push(...agg.feed({
      t: t += 100,
      lat: 45.5 + (110 + i) * 0.0001,
      lon: -73.5,
      headingDeg: 90,
      speedKph: 20,
      rawDistM: null
    }));
  }
}
