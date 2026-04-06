import { useCameraStore, TimelapseFrame } from '../camera';
import { captureFrameWithOverlay } from '../camera/capture';
import { Measurement } from '../survey/types';

export async function addPOIFrameToTimelapse(
  imageUrl: string,
  measurement: Measurement,
  videoElement?: HTMLVideoElement
): Promise<number | null> {
  const store = useCameraStore.getState();
  const currentFrameCount = store.timelapseFrames.length;
  
  // EXCLUDE wires and trees from timelapse per user requirement
  // Only certain POI types should add frames - wires and trees are filtered out
  const poiType = measurement.poi_type?.toLowerCase();
  if (poiType === 'wire' || poiType === 'tree') {
    // Return null to signal that frame was NOT added (excluded POI type)
    return null;
  }
  
  let finalImageUrl = imageUrl;
  
  // If videoElement is provided, capture fresh image with full overlay
  if (videoElement) {
    try {
      const overlayData = {
        poi: `${measurement.poi_type} #${measurement.poiNumber}`,
        gps: measurement.latitude && measurement.longitude ? {
          latitude: measurement.latitude,
          longitude: measurement.longitude
        } : undefined,
        height: measurement.rel !== undefined ? `${measurement.rel.toFixed(2)}m` : undefined,
        course: measurement.heading,
        time: new Date(measurement.createdAt).toISOString(),
        surveyTitle: store.overlayFields.surveyTitle,
        projectNumber: store.overlayFields.projectNumber,
        surveyorName: store.overlayFields.surveyorName,
        poiNotes: measurement.note || undefined,
        showLogo: store.overlayOptions.showLogo,
      };
      
      const result = await captureFrameWithOverlay(
        videoElement,
        overlayData,
        store.overlayOptions,
        'image/jpeg'
      );
      
      finalImageUrl = result.dataUrl;
    } catch (error) {
      console.error('Failed to capture POI frame with overlay, using provided imageUrl:', error);
      // Fall back to provided imageUrl if capture fails
    }
  }
  
  // Create timelapse frame from POI captured image
  const frame: TimelapseFrame = {
    id: crypto.randomUUID(),
    imageUrl: finalImageUrl,
    timestamp: new Date().toISOString(),
    frameNumber: currentFrameCount,
    metadata: {
      latitude: measurement.latitude,
      longitude: measurement.longitude,
      height: measurement.rel,
      poiId: measurement.id
    },
    associatedPOIs: [{
      id: measurement.id,
      poiType: measurement.poi_type || 'Unknown',
      poiNumber: measurement.poiNumber || 0,
      roadNumber: measurement.roadNumber || 0,
      note: measurement.note || undefined,
      timestamp: measurement.createdAt
    }],
    hasPOI: true
  };
  
  // Add frame to timelapse
  store.addTimelapseFrame(frame);
  
  return currentFrameCount;
}
