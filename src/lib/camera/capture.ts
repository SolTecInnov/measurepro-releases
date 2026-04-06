import piexif from 'piexifjs';
import { frameBuffer } from './frameBuffer';

export interface CaptureOverlayData {
  poi?: string;
  poiType?: string;
  gps?: { latitude: number; longitude: number; altitude?: number };
  height?: string;
  course?: number;
  time?: string;
  surveyTitle?: string;
  projectNumber?: string;
  surveyorName?: string;
  poiNotes?: string;
  showLogo?: boolean;
}

export interface CaptureResult {
  dataUrl: string;
  blob: Blob;
  metadata: {
    latitude?: number;
    longitude?: number;
    altitude?: number;
    height?: string;
    poi?: string;
    surveyTitle?: string;
    projectNumber?: string;
    surveyorName?: string;
    poiNotes?: string;
    timestamp: string;
  };
}

function decimalToDMS(decimal: number): [number, number, number] {
  const absolute = Math.abs(decimal);
  const degrees = Math.floor(absolute);
  const minutesDecimal = (absolute - degrees) * 60;
  const minutes = Math.floor(minutesDecimal);
  const seconds = (minutesDecimal - minutes) * 60;
  
  return [degrees, minutes, seconds];
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

function drawTextWithRoundedBackground(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  fontSize: number = 16
) {
  const padding = 8;
  const radius = 8;
  
  ctx.font = `${fontSize}px sans-serif`;
  const metrics = ctx.measureText(text);
  const textHeight = fontSize * 1.2;
  
  const bgWidth = metrics.width + (padding * 2);
  const bgHeight = textHeight + (padding * 2);
  
  ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
  drawRoundedRect(ctx, x - padding, y - padding, bgWidth, bgHeight, radius);
  ctx.fill();
  
  ctx.fillStyle = 'white';
  ctx.fillText(text, x, y + fontSize);
}

function getCardinalDirection(degrees: number): string {
  const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  const index = Math.round(degrees / 45) % 8;
  return directions[index];
}

function formatDateTimeForOverlay(isoTime: string): string {
  try {
    const d = new Date(isoTime);
    const year = d.getFullYear();
    const month = (d.getMonth() + 1).toString().padStart(2, '0');
    const day = d.getDate().toString().padStart(2, '0');
    const hours = d.getHours().toString().padStart(2, '0');
    const minutes = d.getMinutes().toString().padStart(2, '0');
    return `${year}-${month}-${day} - ${hours}:${minutes}`;
  } catch {
    return '--';
  }
}

function drawProfessionalOverlay(
  ctx: CanvasRenderingContext2D,
  canvasWidth: number,
  canvasHeight: number,
  overlayData: CaptureOverlayData,
  overlayOptions: {
    showPOI?: boolean;
    showPOIType?: boolean;
    showGPS?: boolean;
    showHeight?: boolean;
    showDateTime?: boolean;
    showHeading?: boolean;
    showSurveyTitle?: boolean;
    showProjectNumber?: boolean;
    showSurveyorName?: boolean;
    showPOINotes?: boolean;
  }
): { cardX: number; cardY: number; cardWidth: number; cardHeight: number } | null {
  const baseScale = Math.min(canvasWidth / 1280, canvasHeight / 720);
  const scale = baseScale * 0.8; // 20% smaller base
  const widthScale = scale * 1.2; // 20% wider
  const margin = Math.max(12, 20 * scale);
  const cardPadding = Math.max(10, 14 * scale); // 10% less vertical padding
  const radius = Math.max(10, 12 * scale);
  
  const heightLabelFontSize = Math.max(11, 14 * scale);
  const heightValueFontSize = Math.max(34, 45 * scale);
  const labelFontSize = Math.max(10, 13 * scale);
  const valueFontSize = Math.max(12, 14 * scale);
  const bottomLabelFontSize = Math.max(10, 12 * scale);
  const bottomValueFontSize = Math.max(11, 14 * scale);
  const separatorWidth = Math.max(2, 3 * scale);
  const separatorMargin = Math.max(10, 12 * widthScale); // wider separator spacing
  const lineHeight = Math.max(20, 23 * scale); // 10% shorter line height
  
  const showHeight = overlayOptions.showHeight !== false;
  const heightValue = showHeight ? (overlayData.height && overlayData.height !== '--' ? overlayData.height : '--') : null;
  
  const dateTimeStr = overlayData.time 
    ? formatDateTimeForOverlay(overlayData.time) 
    : formatDateTimeForOverlay(new Date().toISOString());
  
  const formatPoiTypeLabel = (poiType: string): string => {
    if (!poiType) return '';
    return poiType
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, str => str.toUpperCase())
      .trim();
  };

  const topRightLines: { label: string; value: string }[] = [];
  if (overlayOptions.showPOI !== false && overlayData.poi) {
    topRightLines.push({ label: 'POI ID', value: overlayData.poi });
  }
  if (overlayOptions.showPOIType !== false && overlayData.poiType) {
    topRightLines.push({ label: 'Type', value: formatPoiTypeLabel(overlayData.poiType) });
  }
  if (overlayOptions.showDateTime !== false) {
    topRightLines.push({ label: 'Date', value: dateTimeStr });
  }
  if (overlayOptions.showSurveyorName !== false && overlayData.surveyorName) {
    topRightLines.push({ label: 'Surveyor', value: overlayData.surveyorName });
  }
  
  const bottomLines: { label: string; value: string }[] = [];
  if (overlayOptions.showProjectNumber !== false && overlayData.projectNumber) {
    bottomLines.push({ label: 'Project No', value: overlayData.projectNumber });
  }
  if (overlayOptions.showSurveyTitle !== false && overlayData.surveyTitle) {
    bottomLines.push({ label: 'Survey title', value: overlayData.surveyTitle });
  }
  if (overlayOptions.showGPS !== false) {
    if (overlayData.gps && (overlayData.gps.latitude !== 0 || overlayData.gps.longitude !== 0)) {
      const latDir = overlayData.gps.latitude >= 0 ? 'N' : 'S';
      const lonDir = overlayData.gps.longitude >= 0 ? 'W' : 'E';
      const gpsStr = `${Math.abs(overlayData.gps.latitude).toFixed(4)}° ${latDir}, ${Math.abs(overlayData.gps.longitude).toFixed(4)}° ${lonDir}`;
      bottomLines.push({ label: 'GPS', value: gpsStr });
    } else {
      bottomLines.push({ label: 'GPS', value: '--' });
    }
  }
  if (overlayOptions.showHeading !== false) {
    if (overlayData.course !== undefined && overlayData.course !== 0) {
      const cardinal = getCardinalDirection(overlayData.course);
      bottomLines.push({ label: 'Heading', value: `${overlayData.course.toFixed(0)}° ${cardinal}` });
    } else {
      bottomLines.push({ label: 'Heading', value: '--' });
    }
  }
  if (overlayOptions.showPOINotes !== false && overlayData.poiNotes) {
    bottomLines.push({ label: 'Notes', value: overlayData.poiNotes });
  }
  
  const hasTopSection = heightValue || topRightLines.length > 0;
  const hasBottomSection = bottomLines.length > 0;
  
  if (!hasTopSection && !hasBottomSection) {
    return null;
  }
  
  ctx.font = `bold ${heightValueFontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
  const heightBlockWidth = heightValue ? ctx.measureText(heightValue).width + 20 : 0;
  
  ctx.font = `${valueFontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
  let maxRightWidth = 0;
  for (const line of topRightLines) {
    ctx.font = `${labelFontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
    const labelW = ctx.measureText(line.label + ' ').width;
    ctx.font = `bold ${valueFontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
    const valueW = ctx.measureText(line.value).width;
    maxRightWidth = Math.max(maxRightWidth, labelW + valueW);
  }
  
  ctx.font = `${bottomValueFontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
  let maxBottomWidth = 0;
  for (const line of bottomLines) {
    ctx.font = `${bottomLabelFontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
    const labelW = ctx.measureText(line.label + ' ').width;
    ctx.font = `bold ${bottomValueFontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
    const valueW = ctx.measureText(line.value).width;
    maxBottomWidth = Math.max(maxBottomWidth, labelW + valueW);
  }
  
  const topSectionWidth = (heightValue ? heightBlockWidth + separatorMargin + separatorWidth + separatorMargin : 0) + maxRightWidth;
  const cardWidth = (Math.max(topSectionWidth, maxBottomWidth) + (cardPadding * 2)) * 1.2; // 20% wider
  
  const topSectionHeight = hasTopSection ? Math.max(
    heightValue ? heightValueFontSize + heightLabelFontSize + 6 : 0, // reduced from 8
    topRightLines.length * lineHeight
  ) + 6 : 0; // reduced from 8
  const separatorLineHeight = hasTopSection && hasBottomSection ? 12 : 0; // reduced from 16 (10% shorter)
  const bottomSectionHeight = hasBottomSection ? bottomLines.length * lineHeight + 6 : 0; // reduced from 8
  const cardHeight = cardPadding + topSectionHeight + separatorLineHeight + bottomSectionHeight + cardPadding;
  
  const cardX = margin;
  const cardY = canvasHeight - margin - cardHeight;
  
  ctx.fillStyle = 'rgba(0, 0, 0, 0.80)';
  drawRoundedRect(ctx, cardX, cardY, cardWidth, cardHeight, radius);
  ctx.fill();
  
  let textY = cardY + cardPadding;
  const textX = cardX + cardPadding;
  
  if (hasTopSection) {
    let leftColEndX = textX;
    
    if (heightValue) {
      ctx.fillStyle = 'rgba(156, 163, 175, 1)';
      ctx.font = `${heightLabelFontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
      ctx.fillText('Height', textX, textY + heightLabelFontSize);
      
      ctx.fillStyle = 'white';
      ctx.font = `bold ${heightValueFontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
      ctx.fillText(heightValue, textX, textY + heightLabelFontSize + 8 + heightValueFontSize * 0.85);
      
      leftColEndX = textX + heightBlockWidth;
      
      ctx.fillStyle = '#F5A623';
      const sepX = leftColEndX + separatorMargin;
      const sepY = textY + 4;
      const sepHeight = topSectionHeight - 8;
      ctx.fillRect(sepX, sepY, separatorWidth, sepHeight);
      
      leftColEndX = sepX + separatorWidth + separatorMargin;
    }
    
    if (topRightLines.length > 0) {
      let rightY = textY + lineHeight * 0.75;
      
      for (const line of topRightLines) {
        ctx.fillStyle = 'rgba(156, 163, 175, 1)';
        ctx.font = `${labelFontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
        const labelText = line.label + ' ';
        ctx.fillText(labelText, leftColEndX, rightY);
        const labelWidth = ctx.measureText(labelText).width;
        
        ctx.fillStyle = 'white';
        ctx.font = `bold ${valueFontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
        ctx.fillText(line.value, leftColEndX + labelWidth, rightY);
        
        rightY += lineHeight;
      }
    }
    
    textY += topSectionHeight;
  }
  
  if (hasTopSection && hasBottomSection) {
    const lineY = textY + 8;
    ctx.strokeStyle = 'rgba(107, 114, 128, 0.6)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(textX, lineY);
    ctx.lineTo(cardX + cardWidth - cardPadding, lineY);
    ctx.stroke();
    textY += separatorLineHeight;
  }
  
  if (hasBottomSection) {
    let bottomY = textY + lineHeight * 0.75;
    
    for (const line of bottomLines) {
      ctx.fillStyle = 'rgba(156, 163, 175, 1)';
      ctx.font = `${bottomLabelFontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
      const labelText = line.label + ' ';
      ctx.fillText(labelText, textX, bottomY);
      const labelWidth = ctx.measureText(labelText).width;
      
      ctx.fillStyle = 'white';
      ctx.font = `bold ${bottomValueFontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
      ctx.fillText(line.value, textX + labelWidth, bottomY);
      
      bottomY += lineHeight;
    }
  }
  
  return { cardX, cardY, cardWidth, cardHeight };
}

export async function captureFrameWithOverlay(
  videoElement: HTMLVideoElement,
  overlayData: CaptureOverlayData,
  overlayOptions: {
    showPOI?: boolean;
    showPOIType?: boolean;
    showGPS?: boolean;
    showHeight?: boolean;
    showDateTime?: boolean;
    showHeading?: boolean;
    showLogo?: boolean;
    showSurveyTitle?: boolean;
    showProjectNumber?: boolean;
    showSurveyorName?: boolean;
    showPOINotes?: boolean;
  },
  imageFormat: 'image/jpeg' | 'image/png' = 'image/jpeg'
): Promise<CaptureResult> {
  const canvas = document.createElement('canvas');
  canvas.width = videoElement.videoWidth || 1280;
  canvas.height = videoElement.videoHeight || 720;
  const ctx = canvas.getContext('2d');
  
  if (!ctx) {
    throw new Error('Failed to get canvas context');
  }

  ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);

  const margin = Math.max(10, canvas.width / 128);

  // Draw the overlay card first and get its bounds
  const cardBounds = drawProfessionalOverlay(ctx, canvas.width, canvas.height, overlayData, overlayOptions);

  // Draw logo above the overlay card (bottom-left, no background)
  if (overlayOptions.showLogo && overlayData.showLogo !== false) {
    try {
      const logoUrl = localStorage.getItem('app_logo_url');
      if (!logoUrl) {
        // No logo configured, skip drawing
      } else {
        const logoImg = new Image();
        
        await new Promise<void>((resolve, reject) => {
          logoImg.onload = () => resolve();
          logoImg.onerror = () => reject();
          logoImg.src = logoUrl;
          setTimeout(() => reject(), 2000);
        }).catch(() => {});

        if (logoImg.complete && logoImg.naturalWidth > 0) {
          const maxLogoHeight = canvas.height * 0.06;
          const logoAspectRatio = logoImg.width / logoImg.height;
          const logoHeight = maxLogoHeight;
          const logoWidth = logoHeight * logoAspectRatio;
          
          // Position logo above the actual card bounds
          const logoX = margin;
          const logoY = cardBounds 
            ? cardBounds.cardY - logoHeight - 8  // Use actual card position
            : canvas.height - margin - logoHeight; // Fallback if no card
          
          // Draw with drop shadow (no background)
          ctx.shadowColor = 'rgba(0, 0, 0, 0.7)';
          ctx.shadowBlur = 6;
          ctx.shadowOffsetX = 2;
          ctx.shadowOffsetY = 2;
          ctx.drawImage(logoImg, logoX, logoY, logoWidth, logoHeight);
          ctx.shadowColor = 'transparent';
          ctx.shadowBlur = 0;
          ctx.shadowOffsetX = 0;
          ctx.shadowOffsetY = 0;
        }
      }
    } catch (error) {
    }
  }

  // JPEG quality reduced to 75% for optimal file size (was 95%)
  // 75% provides excellent quality while reducing file size by ~60%
  let dataUrl = canvas.toDataURL(imageFormat, 0.75);

  if (overlayData.gps && (overlayData.gps.latitude !== 0 || overlayData.gps.longitude !== 0)) {
    try {
      const zeroth: any = {};
      const exif: any = {};
      const gps: any = {};

      if (overlayData.surveyTitle || overlayData.projectNumber) {
        const description = [
          overlayData.surveyTitle,
          overlayData.projectNumber
        ].filter(Boolean).join(' - ');
        zeroth[piexif.ImageIFD.ImageDescription] = description;
      }

      const userComment = JSON.stringify({
        surveyTitle: overlayData.surveyTitle || '',
        projectNumber: overlayData.projectNumber || '',
        surveyorName: overlayData.surveyorName || '',
        poiNotes: overlayData.poiNotes || '',
        poi: overlayData.poi || '',
        height: overlayData.height || '',
        course: overlayData.course || 0,
      });
      exif[piexif.ExifIFD.UserComment] = userComment;

      const latDMS = decimalToDMS(overlayData.gps.latitude);
      const lonDMS = decimalToDMS(overlayData.gps.longitude);
      
      gps[piexif.GPSIFD.GPSLatitudeRef] = overlayData.gps.latitude >= 0 ? 'N' : 'S';
      gps[piexif.GPSIFD.GPSLatitude] = [
        [latDMS[0], 1],
        [Math.floor(latDMS[1] * 100), 100],
        [Math.floor(latDMS[2] * 10000), 10000]
      ];
      
      gps[piexif.GPSIFD.GPSLongitudeRef] = overlayData.gps.longitude >= 0 ? 'E' : 'W';
      gps[piexif.GPSIFD.GPSLongitude] = [
        [lonDMS[0], 1],
        [Math.floor(lonDMS[1] * 100), 100],
        [Math.floor(lonDMS[2] * 10000), 10000]
      ];

      if (overlayData.gps.altitude !== undefined) {
        gps[piexif.GPSIFD.GPSAltitude] = [Math.floor(overlayData.gps.altitude * 100), 100];
        gps[piexif.GPSIFD.GPSAltitudeRef] = overlayData.gps.altitude >= 0 ? 0 : 1;
      }

      const exifObj = { '0th': zeroth, 'Exif': exif, 'GPS': gps };
      const exifBytes = piexif.dump(exifObj);
      dataUrl = piexif.insert(exifBytes, dataUrl);
    } catch (error) {
    }
  }

  // Create blob with same 75% quality for consistency
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => {
      if (b) resolve(b);
      else reject(new Error('Failed to create blob'));
    }, imageFormat, 0.75);
  });

  return {
    dataUrl,
    blob,
    metadata: {
      latitude: overlayData.gps?.latitude,
      longitude: overlayData.gps?.longitude,
      altitude: overlayData.gps?.altitude,
      height: overlayData.height,
      poi: overlayData.poi,
      surveyTitle: overlayData.surveyTitle,
      projectNumber: overlayData.projectNumber,
      surveyorName: overlayData.surveyorName,
      poiNotes: overlayData.poiNotes,
      timestamp: overlayData.time || new Date().toISOString(),
    },
  };
}

export async function captureBufferedFrameWithOverlay(
  delaySeconds: number,
  overlayData: CaptureOverlayData,
  overlayOptions: {
    showPOI?: boolean;
    showPOIType?: boolean;
    showGPS?: boolean;
    showHeight?: boolean;
    showDateTime?: boolean;
    showHeading?: boolean;
    showLogo?: boolean;
    showSurveyTitle?: boolean;
    showProjectNumber?: boolean;
    showSurveyorName?: boolean;
    showPOINotes?: boolean;
  },
  imageFormat: 'image/jpeg' | 'image/png' = 'image/jpeg'
): Promise<CaptureResult | null> {
  const bufferedCanvas = frameBuffer.getFrameAtOffset(delaySeconds);
  
  if (!bufferedCanvas) {
    return null;
  }

  const canvas = document.createElement('canvas');
  canvas.width = bufferedCanvas.width;
  canvas.height = bufferedCanvas.height;
  const ctx = canvas.getContext('2d');
  
  if (!ctx) {
    throw new Error('Failed to get canvas context');
  }

  ctx.drawImage(bufferedCanvas, 0, 0);

  const margin = Math.max(10, canvas.width / 128);

  if (overlayOptions.showLogo && overlayData.showLogo !== false) {
    try {
      const logoUrl = localStorage.getItem('app_logo_url') || '/soltec.png';
      const logoImg = new Image();
      
      await new Promise<void>((resolve, reject) => {
        logoImg.onload = () => resolve();
        logoImg.onerror = () => reject(new Error('Failed to load logo'));
        logoImg.src = logoUrl;
        setTimeout(() => reject(new Error('Logo load timeout')), 5000);
      });
      
      const maxLogoWidth = canvas.width * 0.15;
      const maxLogoHeight = canvas.height * 0.08;
      const aspectRatio = logoImg.width / logoImg.height;
      
      let logoWidth = maxLogoWidth;
      let logoHeight = maxLogoWidth / aspectRatio;
      
      if (logoHeight > maxLogoHeight) {
        logoHeight = maxLogoHeight;
        logoWidth = maxLogoHeight * aspectRatio;
      }
      
      const logoX = canvas.width - logoWidth - margin;
      const logoY = margin;
      
      ctx.drawImage(logoImg, logoX, logoY, logoWidth, logoHeight);
    } catch (error) {
    }
  }

  drawProfessionalOverlay(ctx, canvas.width, canvas.height, overlayData, overlayOptions);

  let dataUrl = canvas.toDataURL(imageFormat, 0.75);

  if (overlayData.gps) {
    try {
      const zeroth: Record<number, any> = {};
      const exif: Record<number, any> = {};
      const gps: Record<number, any> = {};
      
      zeroth[piexif.ImageIFD.Make] = 'MeasurePRO';
      zeroth[piexif.ImageIFD.Software] = 'MeasurePRO v1.0';

      if (overlayData.poi) {
        exif[piexif.ExifIFD.UserComment] = `POI: ${overlayData.poi}`;
      }

      if (overlayData.height) {
        zeroth[piexif.ImageIFD.ImageDescription] = `Height: ${overlayData.height}`;
      }

      const latDMS = decimalToDMS(overlayData.gps.latitude);
      const lonDMS = decimalToDMS(overlayData.gps.longitude);
      
      gps[piexif.GPSIFD.GPSLatitudeRef] = overlayData.gps.latitude >= 0 ? 'N' : 'S';
      gps[piexif.GPSIFD.GPSLatitude] = [
        [latDMS[0], 1],
        [Math.floor(latDMS[1] * 100), 100],
        [Math.floor(latDMS[2] * 10000), 10000]
      ];
      
      gps[piexif.GPSIFD.GPSLongitudeRef] = overlayData.gps.longitude >= 0 ? 'E' : 'W';
      gps[piexif.GPSIFD.GPSLongitude] = [
        [lonDMS[0], 1],
        [Math.floor(lonDMS[1] * 100), 100],
        [Math.floor(lonDMS[2] * 10000), 10000]
      ];

      if (overlayData.gps.altitude !== undefined) {
        gps[piexif.GPSIFD.GPSAltitude] = [Math.floor(overlayData.gps.altitude * 100), 100];
        gps[piexif.GPSIFD.GPSAltitudeRef] = overlayData.gps.altitude >= 0 ? 0 : 1;
      }

      const exifObj = { '0th': zeroth, 'Exif': exif, 'GPS': gps };
      const exifBytes = piexif.dump(exifObj);
      dataUrl = piexif.insert(exifBytes, dataUrl);
    } catch (error) {
    }
  }

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => {
      if (b) resolve(b);
      else reject(new Error('Failed to create blob'));
    }, imageFormat, 0.75);
  });

  return {
    dataUrl,
    blob,
    metadata: {
      latitude: overlayData.gps?.latitude,
      longitude: overlayData.gps?.longitude,
      altitude: overlayData.gps?.altitude,
      height: overlayData.height,
      poi: overlayData.poi,
      surveyTitle: overlayData.surveyTitle,
      projectNumber: overlayData.projectNumber,
      surveyorName: overlayData.surveyorName,
      poiNotes: overlayData.poiNotes,
      timestamp: overlayData.time || new Date().toISOString(),
    },
  };
}
