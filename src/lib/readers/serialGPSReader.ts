import { useGPSStore } from '../stores/gpsStore';

export class GPSReader {
  private buffer: string = '';
  private callbacks: Set<(data: string) => void> = new Set();
  private readonly MAX_BUFFER_SIZE = 8192;
  private readonly NMEA_START_CHARS = ['$GP', '$GN', '$GL'];
  private rawNMEABuffer: string[] = [];
  private readonly MAX_NMEA_HISTORY = 100;

  private chunkCount: number = 0;

  processData(chunk: Uint8Array): void {
    this.chunkCount++;
    const decoder = new TextDecoder();
    const text = decoder.decode(chunk, { stream: true });
    
    // Debug: Log first few chunks and then periodically
    if (this.chunkCount <= 5 || this.chunkCount % 100 === 0) {
      console.log(`[GPSReader] processData: ${chunk.length} bytes, chunk #${this.chunkCount}, preview: ${text.substring(0, 40)}`);
    }
    
    // Add to buffer
    this.buffer += text;

    // Prevent buffer overflow
    if (this.buffer.length > this.MAX_BUFFER_SIZE) {
      this.buffer = this.buffer.slice(-this.MAX_BUFFER_SIZE);
    }

    // Process complete NMEA sentences
    const lines = this.buffer.split('\r\n');
    this.buffer = lines.pop() || ''; // Keep incomplete line

    for (const line of lines) {
      const trimmedLine = line.trim();
      // Only process valid NMEA sentences
      if (trimmedLine.length > 0 && this.NMEA_START_CHARS.some(start => trimmedLine.startsWith(start))) {
        // Reduced logging spam - uncomment for debugging
        // console.log('🛰️ Valid NMEA sentence:', trimmedLine.substring(0, 50) + (trimmedLine.length > 50 ? '...' : ''));
        
        // Store raw NMEA sentence in buffer
        this.rawNMEABuffer.push(trimmedLine);
        if (this.rawNMEABuffer.length > this.MAX_NMEA_HISTORY) {
          this.rawNMEABuffer.shift();
        }
        
        // Update global GPS store
        try {
          this.processNMEASentence(trimmedLine);
        } catch (err) {
        }
        
        // Notify callbacks
        this.callbacks.forEach(cb => {
          try {
            // Reduced logging spam
            // console.log('🛰️ Notifying GPS callback');
            cb(trimmedLine);
          } catch (err) {
          }
        });
        
        // Also add to GPS store directly
        useGPSStore.getState().addNMEASentence(trimmedLine);
      } else {
        if (trimmedLine.length > 0) {
        }
      }
    }
  }

  private processNMEASentence(sentence: string): void {
    try {
      const parts = sentence.split(',');
      const type = parts[0];
      
      switch (type) {
        case '$GPGGA': 
        case '$GNGGA': // Global Positioning System Fix Data
          if (parts.length >= 10) {
            const time = parts[1] || '';
            const lat = parts[2] || '';
            const latDir = parts[3] || '';
            const lon = parts[4] || '';
            const lonDir = parts[5] || '';
            const alt = parts[9] || '';
            
            if (time && lat && lon) {
              const formattedTime = time.length >= 6 ? `${time.slice(0,2)}:${time.slice(2,4)}:${time.slice(4,6)}` : '--:--:--';
              let latitude = 0;
              let longitude = 0;
              
              if (lat && lon) {
                // Convert from DDMM.MMMM to decimal degrees
                const latDeg = parseFloat(lat.substring(0, 2));
                const latMin = parseFloat(lat.substring(2));
                latitude = latDeg + (latMin / 60);
                if (latDir === 'S') latitude = -latitude;

                const lngDeg = parseFloat(lon.substring(0, 3));
                const lngMin = parseFloat(lon.substring(3));
                longitude = lngDeg + (lngMin / 60);
                if (lonDir === 'W') longitude = -longitude;
              }
              
              // Get other important data
              const fixQuality = parts[6] === '0' ? 'No Fix' : parts[6] === '1' ? 'GPS Fix' : 'DGPS Fix';
              const satellites = parseInt(parts[7]) || 0;
              const hdop = parseFloat(parts[8]) || 0;
              const altitude = parseFloat(alt) || 0;
              
              // Reduced logging spam - uncomment for debugging
              // console.log('🛰️ Parsed GPS data:', { time: formattedTime, latitude, longitude, altitude, fixQuality, satellites, hdop });
              
              // Update GPS store
              useGPSStore.getState().updateData({
                time: formattedTime,
                latitude,
                longitude,
                altitude,
                fixQuality,
                satellites,
                hdop,
                source: 'serial'
              });
              
              // Update last serial data time for failsafe monitoring
              useGPSStore.setState({ lastSerialDataTime: Date.now() });
            }
          }
          break;

        case '$GPRMC': 
        case '$GNRMC': // Recommended Minimum Navigation Information
          if (parts.length >= 9) {
            const speed = parts[7] ? parseFloat(parts[7]) * 1.852 : 0; // Convert knots to km/h
            const course = parseFloat(parts[8]) || 0;
            const date = parts[9] || '';
            // Reduced logging spam
            // console.log('🛰️ Parsed GPS speed/course:', { speed, course });
            
            // Update GPS store with speed and course
            useGPSStore.getState().updateData({
              speed,
              course
            });
            
            // Process date if available
            if (date && date.length >= 6) {
              const day = date.slice(0, 2);
              const month = date.slice(2, 4);
              const year = date.slice(4, 6);
            }
          }
          break;

        case '$GPGSV': 
        case '$GNGSV': // Satellites in View
          // Satellite info processing could be added here
          break;
      }
      
    } catch (error) {
    }
  }

  registerCallback(callback: (data: string) => void): void {
    this.callbacks.add(callback);
  }

  unregisterCallback(callback: (data: string) => void): void {
    this.callbacks.delete(callback);
  }

  clearCallbacks(): void {
    this.callbacks.clear();
  }

  getRawNMEABuffer(): string[] {
    return [...this.rawNMEABuffer];
  }

  reset(): void {
    this.buffer = '';
    this.rawNMEABuffer = [];
    this.callbacks.clear();
  }
}