import React, { useState, useEffect, useRef } from 'react';
import { Download, Trash2, Play, Film } from 'lucide-react';
import { useCameraStore } from '../lib/camera';
import { toast } from 'sonner';
import { getDetectionImage } from '../lib/storage/detection-storage';

interface CapturedImagesProps {
  pendingPhotos: string[];
  pendingVideos?: { id: string, url: string, thumbnail: string }[];
  capturedData: Array<{
    imageUrl: string;
    overlayData: {
      poi: string;
      time: string;
      gps: { latitude: number; longitude: number };
      height: string;
      course: number;
    };
  }>;
  onDeletePhoto?: (index: number) => void;
  onClearAllPhotos?: () => void;
  onDeleteVideo?: (id: string) => void;
}

const CapturedImages: React.FC<CapturedImagesProps> = ({ 
  pendingPhotos, 
  pendingVideos = [],
  capturedData, 
  onDeletePhoto, 
  onClearAllPhotos,
  onDeleteVideo
}) => {
  const { overlayOptions } = useCameraStore();
  const [selectedVideo, setSelectedVideo] = useState<string | null>(null);
  
  // PERFORMANCE FIX: Store display URLs separately, fetch from IndexedDB
  const [displayPhotos, setDisplayPhotos] = useState<string[]>([]);
  
  // MEMORY LEAK FIX: Track created blob URLs for proper cleanup
  const createdBlobUrlsRef = useRef<string[]>([]);
  
  // Fetch images from IndexedDB when pendingPhotos changes
  useEffect(() => {
    // RACE CONDITION FIX: Create AbortController to cancel stale async operations
    const abortController = new AbortController();
    
    const loadImages = async () => {
      // MEMORY LEAK FIX: Revoke previous blob URLs before creating new ones
      createdBlobUrlsRef.current.forEach(url => {
        URL.revokeObjectURL(url);
      });
      createdBlobUrlsRef.current = [];
      
      // Check if aborted before proceeding
      if (abortController.signal.aborted) return;
      
      // CRITICAL FIX: Process data URLs synchronously first to prevent "No captured media" flicker
      const urls = pendingPhotos.map(id => 
        id.startsWith('data:image/') ? id : ''
      );
      
      // RACE CONDITION FIX: Check if aborted before updating state
      if (abortController.signal.aborted) return;
      setDisplayPhotos([...urls]); // Update UI immediately with data URLs and placeholders
      
      // Async pass: fetch from IndexedDB progressively
      for (let i = 0; i < pendingPhotos.length; i++) {
        // RACE CONDITION FIX: Check if aborted before each iteration
        if (abortController.signal.aborted) return;
        
        if (!pendingPhotos[i].startsWith('data:image/')) {
          try {
            const blob = await getDetectionImage(pendingPhotos[i]);
            
            // RACE CONDITION FIX: Check if aborted after async operation
            if (abortController.signal.aborted) return;
            
            if (blob) {
              const url = URL.createObjectURL(blob);
              urls[i] = url;
              createdBlobUrlsRef.current.push(url); // Track for cleanup
              
              // RACE CONDITION FIX: Check if aborted before updating state
              if (abortController.signal.aborted) return;
              setDisplayPhotos([...urls]); // Progressive update
            }
          } catch (error) {
            console.error('Failed to load image:', error);
            // Leave as empty string placeholder
          }
        }
      }
    };
    
    if (pendingPhotos.length > 0) {
      loadImages();
    } else {
      setDisplayPhotos([]);
    }
    
    // Cleanup function: abort ongoing operations and cleanup object URLs
    return () => {
      abortController.abort(); // Cancel any pending async operations
      createdBlobUrlsRef.current.forEach(url => {
        URL.revokeObjectURL(url);
      });
      createdBlobUrlsRef.current = [];
    };
  }, [pendingPhotos]);

  const renderOverlaysOnCanvas = (imageUrl: string, index: number): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = async () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return resolve(imageUrl);

        ctx.drawImage(img, 0, 0);

        if (overlayOptions.enabled && capturedData[index]?.overlayData) {
          const overlayData = capturedData[index].overlayData;
          
          const scale = Math.min(img.width / 1280, img.height / 720);
          const margin = Math.max(16, 20 * scale);
          const cardPadding = Math.max(12, 16 * scale);
          const radius = Math.max(8, 12 * scale);
          const heightFontSize = Math.max(36, 52 * scale);
          const dateFontSize = Math.max(14, 18 * scale);
          const infoFontSize = Math.max(12, 14 * scale);
          const separatorWidth = 3;
          const separatorMargin = Math.max(8, 12 * scale);
          
          const drawRoundedRect = (x: number, y: number, w: number, h: number, r: number) => {
            ctx.beginPath();
            ctx.moveTo(x + r, y);
            ctx.lineTo(x + w - r, y);
            ctx.quadraticCurveTo(x + w, y, x + w, y + r);
            ctx.lineTo(x + w, y + h - r);
            ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
            ctx.lineTo(x + r, y + h);
            ctx.quadraticCurveTo(x, y + h, x, y + h - r);
            ctx.lineTo(x, y + r);
            ctx.quadraticCurveTo(x, y, x + r, y);
            ctx.closePath();
          };
          
          if (overlayOptions.showLogo) {
            try {
              const logoUrl = localStorage.getItem('app_logo_url') || '/soltec.png';
              const logoImg = new Image();
              await new Promise<void>((resolveLogoLoad, rejectLogoLoad) => {
                logoImg.onload = () => resolveLogoLoad();
                logoImg.onerror = () => {
                  if (logoImg.src !== '/soltec.png') {
                    logoImg.src = '/soltec.png';
                  } else {
                    rejectLogoLoad();
                  }
                };
                logoImg.src = logoUrl;
              });

              const maxLogoHeight = 48;
              const logoAspectRatio = logoImg.width / logoImg.height;
              const logoHeight = maxLogoHeight;
              const logoWidth = logoHeight * logoAspectRatio;
              const logoX = (img.width - logoWidth) / 2;
              const logoY = 10;
              const logoPadding = 8;
              
              ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
              drawRoundedRect(logoX - logoPadding, logoY - logoPadding, logoWidth + (logoPadding * 2), logoHeight + (logoPadding * 2), 8);
              ctx.fill();
              ctx.drawImage(logoImg, logoX, logoY, logoWidth, logoHeight);
            } catch (error) {}
          }
          
          const heightValue = overlayOptions.showHeight && overlayData.height && overlayData.height !== '--' ? overlayData.height : null;
          
          let dateStr = '';
          let timeStr = '';
          if (overlayOptions.showDateTime && overlayData.time) {
            try {
              const d = new Date(overlayData.time);
              const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
              let hours = d.getHours();
              const period = hours >= 12 ? 'PM' : 'AM';
              hours = hours % 12 || 12;
              dateStr = `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
              timeStr = `${hours.toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')} ${period}`;
            } catch { dateStr = overlayData.time; }
          }
          
          const lines: string[] = [];
          if (overlayOptions.showPOI && overlayData.poi) lines.push(`POI: ${overlayData.poi}`);
          if (overlayOptions.showGPS && overlayData.gps && overlayData.gps.latitude !== 0) {
            const latDir = overlayData.gps.latitude >= 0 ? 'N' : 'S';
            const lonDir = overlayData.gps.longitude >= 0 ? 'E' : 'W';
            lines.push(`${Math.abs(overlayData.gps.latitude).toFixed(6)}°${latDir}, ${Math.abs(overlayData.gps.longitude).toFixed(6)}°${lonDir}`);
          }
          if (overlayOptions.showHeading && overlayData.course && overlayData.course !== 0) {
            lines.push(`Heading: ${overlayData.course.toFixed(0)}°`);
          }
          
          const hasHeader = heightValue || (overlayOptions.showDateTime && dateStr);
          if (!hasHeader && lines.length === 0) {
            resolve(canvas.toDataURL('image/jpeg', 0.95));
            return;
          }
          
          let headerWidth = 0;
          if (heightValue) {
            ctx.font = `bold ${heightFontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
            const heightNumWidth = ctx.measureText(heightValue).width;
            if (overlayOptions.showDateTime && dateStr) {
              ctx.font = `${dateFontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
              const dateWidth = ctx.measureText(dateStr).width;
              const timeWidth = ctx.measureText(timeStr).width;
              headerWidth = heightNumWidth + 12 + separatorMargin + separatorWidth + separatorMargin + Math.max(dateWidth, timeWidth);
            } else {
              headerWidth = heightNumWidth + 8;
            }
          } else if (overlayOptions.showDateTime && dateStr) {
            ctx.font = `${dateFontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
            headerWidth = Math.max(ctx.measureText(dateStr).width, ctx.measureText(timeStr).width);
          }
          
          ctx.font = `${infoFontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
          let maxInfoWidth = 0;
          for (const line of lines) {
            const w = ctx.measureText(line).width;
            if (w > maxInfoWidth) maxInfoWidth = w;
          }
          
          const cardWidth = Math.max(headerWidth, maxInfoWidth) + (cardPadding * 2);
          const headerHeight = hasHeader ? heightFontSize + 8 : 0;
          const infoLinesHeight = lines.length * (infoFontSize + 6);
          const cardHeight = cardPadding + headerHeight + (lines.length > 0 && hasHeader ? 12 : 0) + infoLinesHeight + cardPadding;
          
          const cardX = margin;
          const cardY = img.height - margin - cardHeight;
          
          ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
          drawRoundedRect(cardX, cardY, cardWidth, cardHeight, radius);
          ctx.fill();
          
          let textX = cardX + cardPadding;
          let textY = cardY + cardPadding;
          
          if (heightValue) {
            ctx.fillStyle = '#22c55e';
            ctx.font = `bold ${heightFontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
            ctx.fillText(heightValue, textX, textY + heightFontSize * 0.85);
            
            const heightNumWidth = ctx.measureText(heightValue).width;
            
            if (overlayOptions.showDateTime && dateStr) {
              const separatorX = textX + heightNumWidth + 12 + separatorMargin;
              const separatorY = textY + 4;
              const separatorHeight = heightFontSize - 8;
              
              ctx.fillStyle = '#F5A623';
              ctx.fillRect(separatorX, separatorY, separatorWidth, separatorHeight);
              
              const dateX = separatorX + separatorWidth + separatorMargin;
              ctx.fillStyle = 'white';
              ctx.font = `${dateFontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
              ctx.fillText(dateStr, dateX, textY + dateFontSize + 2);
              
              ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
              ctx.fillText(timeStr, dateX, textY + dateFontSize * 2 + 6);
            }
            
            textY += headerHeight + 12;
          } else if (overlayOptions.showDateTime && dateStr) {
            ctx.fillStyle = 'white';
            ctx.font = `bold ${dateFontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
            ctx.fillText(dateStr, textX, textY + dateFontSize);
            
            ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
            ctx.font = `${dateFontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
            ctx.fillText(timeStr, textX, textY + dateFontSize * 2 + 4);
            
            textY += dateFontSize * 2 + 16;
          }
          
          if (lines.length > 0) {
            ctx.font = `${infoFontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
            for (let i = 0; i < lines.length; i++) {
              ctx.fillStyle = i === 0 ? 'white' : 'rgba(255, 255, 255, 0.85)';
              ctx.fillText(lines[i], textX, textY + infoFontSize);
              textY += infoFontSize + 6;
            }
          }
        }

        resolve(canvas.toDataURL('image/jpeg', 0.95));
      };
      img.src = imageUrl;
    });
  };

  const handleDownload = async (imageUrl: string, index: number) => {
    // Overlay is already baked into the captured image - download directly
    const link = document.createElement('a');
    link.href = imageUrl;
    link.download = `capture-${index + 1}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (  
    <div className="bg-gray-800 rounded-xl overflow-hidden max-h-[400px] flex flex-col">
      <div className="p-4 space-y-4 flex-1 min-h-0 overflow-y-auto">
        {displayPhotos.length > 0 || pendingVideos.length > 0 ? (
          <div className="grid grid-cols-2 gap-4">
            {displayPhotos.map((photo, index) => (
              <div key={index} className="aspect-video bg-black rounded-lg overflow-hidden relative group">
                {photo ? (
                  <img src={photo} alt={`Captured ${index + 1}`} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-400">Loading...</div>
                )}
{/* Overlay is already baked into captured images - no need to render separately */}
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                  <a
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      handleDownload(photo, index);
                    }}
                    className="p-2 bg-blue-500 hover:bg-blue-600 rounded-lg transition-colors"
                    title="Download Image"
                  >
                    <Download className="w-5 h-5" />
                  </a>
                  <button
                    onClick={() => onDeletePhoto?.(index)}
                    className="p-2 bg-red-500 hover:bg-red-600 rounded-lg transition-colors"
                    title="Delete Image"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              </div>
            ))}
            
            {/* Video thumbnails */}
            {pendingVideos.map((video) => (
              <div key={video.id} className="aspect-video bg-black rounded-lg overflow-hidden relative group">
                {video.thumbnail ? (
                  <img 
                    src={video.thumbnail} 
                    alt="Video thumbnail" 
                    className="w-full h-full object-cover"
                    onClick={() => setSelectedVideo(video.url)}
                    onError={(e) => {
                      // Replace broken thumbnail with a placeholder
                      e.currentTarget.style.display = 'none';
                      const parent = e.currentTarget.parentElement;
                      if (parent) {
                        const placeholder = document.createElement('div');
                        placeholder.className = 'w-full h-full flex items-center justify-center bg-gray-700';
                        placeholder.innerHTML = '<div class="text-gray-400"><svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v8"></path><path d="m4.93 10.93 1.41 1.41"></path><path d="M2 18h2"></path><path d="M20 18h2"></path><path d="m19.07 10.93-1.41 1.41"></path><path d="M22 22H2"></path><path d="m16 6-4 4-4-4"></path><path d="M16 18a4 4 0 0 0-8 0"></path></svg></div>';
                        parent.appendChild(placeholder);
                      }
                    }}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gray-700">
                    <Film className="w-12 h-12 text-gray-500" />
                  </div>
                )}
                <div className="absolute inset-0 flex items-center justify-center">
                  <Play className="w-12 h-12 text-white opacity-70" />
                </div>
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                  <a
                    href={video.url}
                    download={`video-${video.id}.webm`}
                    className="p-2 bg-blue-500 hover:bg-blue-600 rounded-lg transition-colors"
                    title="Download Video"
                    onClick={(e) => {
                      // Ensure the URL is valid before downloading
                      if (!video.url) {
                        e.preventDefault();
                        toast.error('Video URL is not available');
                      }
                    }}
                  >
                    <Download className="w-5 h-5" />
                  </a>
                  <button
                    onClick={() => onDeleteVideo?.(video.id)}
                    className="p-2 bg-red-500 hover:bg-red-600 rounded-lg transition-colors"
                    title="Delete Video"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-400 h-full flex items-center justify-center">
            No captured media
          </div>
        )}
      </div>
      
      {/* Video player modal */}
      {selectedVideo && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50" onClick={() => setSelectedVideo(null)}>
          <div className="max-w-3xl w-full p-4" onClick={e => e.stopPropagation()}>
            <video 
              src={selectedVideo} 
              controls 
              autoPlay 
              className="w-full rounded-lg"
            />
            <button
              onClick={() => setSelectedVideo(null)}
              className="mt-4 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg mx-auto block"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default CapturedImages;