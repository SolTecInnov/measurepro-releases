import React, { useState, useEffect } from 'react';
import { X, MapPin, Camera, Video, Edit3, Download, Calendar, Clock, Navigation, Ruler, Eye, Trash2, Play } from 'lucide-react';
import { POI_TYPES } from '../lib/poi';
import { toast } from 'sonner';
import GeoReferencedVideoPlayer from './video/GeoReferencedVideoPlayer';

// Add the formatCoordinate function directly since it might not be available in deployment
const formatCoordinate = (dd: number, isLatitude: boolean): string => {
  if (isNaN(dd)) return '--°';
  
  const degrees = Math.floor(Math.abs(dd));
  const minutes = Math.floor((Math.abs(dd) - degrees) * 60);
  const seconds = ((Math.abs(dd) - degrees - minutes / 60) * 3600).toFixed(2);
  
  const direction = isLatitude 
    ? (dd >= 0 ? 'N' : 'S')
    : (dd >= 0 ? 'E' : 'W');
  
  return `${degrees}° ${minutes}' ${parseFloat(seconds)}" ${direction}`;
};

interface POIDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  poiData: {
    id: string;
    rel: number;
    altGPS: number;
    latitude: number;
    longitude: number;
    utcDate: string;
    utcTime: string;
    speed: number;
    heading: number;
    roadNumber: number | null;
    poiNumber: number | null;
    poi_type: string;
    note: string | null;
    imageUrl: string | null;
    videoUrl: string | null;
    videoTimestamp?: number | null;
    videoBlobId?: string | null;
    drawingUrl?: string | null;
    widthMeasure?: number | null;
    lengthMeasure?: number | null;
    createdAt: string;
    source?: string;
  } | null;
  onEdit?: (poiData: any) => void;
  onDelete?: (poiId: string) => void;
}

const POIDetailsModal: React.FC<POIDetailsModalProps> = ({
  isOpen,
  onClose,
  poiData,
  onEdit,
  onDelete
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    note: '',
    poi_type: '',
    widthMeasure: '',
    lengthMeasure: ''
  });
  const [showImageModal, setShowImageModal] = useState(false);
  const [showVideoModal, setShowVideoModal] = useState(false);
  const [showGeoVideoPlayer, setShowGeoVideoPlayer] = useState(false);
  const [showDrawingModal, setShowDrawingModal] = useState(false);

  // Helper function to format video timestamp to MM:SS
  const formatVideoTimestamp = (seconds: number | null | undefined): string => {
    if (seconds === null || seconds === undefined) return '--';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Initialize edit form when POI data changes
  useEffect(() => {
    if (poiData) {
      setEditForm({
        note: poiData.note || '',
        poi_type: poiData.poi_type || '',
        widthMeasure: poiData.widthMeasure?.toString() || '',
        lengthMeasure: poiData.lengthMeasure?.toString() || ''
      });
    }
  }, [poiData]);

  // REMOVED: Video player navigation not used in field workflow
  // POI Details Modal only displays single POI data, no need to load survey measurements

  if (!isOpen || !poiData) return null;

  // Get POI type configuration for styling
  const poiTypeConfig = POI_TYPES.find(poi => poi.type === poiData.poi_type);
  const poiColor = poiTypeConfig?.color || 'text-gray-400';
  const poiBgColor = poiTypeConfig?.bgColor || 'bg-gray-400/20';
  const PoiIcon = poiTypeConfig?.icon;

  // Format POI ID - always use unique ID
  const formatPOIId = () => {
    return poiData.id.substring(0, 8);
  };

  // Handle save edit
  const handleSaveEdit = () => {
    if (onEdit) {
      const updatedData = {
        ...poiData,
        note: editForm.note,
        poi_type: editForm.poi_type,
        widthMeasure: editForm.widthMeasure ? parseFloat(editForm.widthMeasure) : null,
        lengthMeasure: editForm.lengthMeasure ? parseFloat(editForm.lengthMeasure) : null
      };
      onEdit(updatedData);
    }
    setIsEditing(false);
    toast.success('POI updated successfully');
  };

  // Handle delete
  const handleDelete = () => {
    if (confirm('Are you sure you want to delete this POI? This action cannot be undone.')) {
      if (onDelete) {
        onDelete(poiData.id);
      }
      onClose();
      // Success/error toast is handled by the parent component (VehicleMap)
      // which performs the actual database deletion
    }
  };

  // Download media file
  const downloadMedia = (url: string, filename: string) => {
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 overflow-y-auto py-8">
        <div className="bg-gray-800 rounded-xl w-full max-w-4xl p-6 mx-4 my-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${poiBgColor}`}>
                {PoiIcon && <PoiIcon className={`w-6 h-6 ${poiColor}`} />}
              </div>
              <div>
                <h2 className="text-xl font-semibold">POI Details</h2>
                <p className="text-gray-400">ID: {formatPOIId()}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsEditing(!isEditing)}
                className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm"
              >
                <Edit3 className="w-4 h-4" />
                {isEditing ? 'Cancel Edit' : 'Edit POI'}
              </button>
              <button
                onClick={handleDelete}
                className="flex items-center gap-2 px-3 py-1.5 bg-red-600 hover:bg-red-700 rounded-lg text-sm"
              >
                <Trash2 className="w-4 h-4" />
                Delete
              </button>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-300"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6">
            {/* Left Column - Basic Information */}
            <div className="space-y-6">
              {/* POI Information */}
              <div className="bg-gray-700 rounded-lg p-4">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-blue-400" />
                  POI Information
                </h3>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm text-gray-400">POI Type</label>
                    {isEditing ? (
                      <select
                        value={editForm.poi_type}
                        onChange={(e) => setEditForm(prev => ({ ...prev, poi_type: e.target.value }))}
                        className="w-full px-3 py-2 bg-gray-600 border border-gray-500 text-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                      >
                        {POI_TYPES.map((poiType) => (
                          <option key={poiType.type} value={poiType.type}>
                            {poiType.label}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${poiBgColor}`}>
                        {PoiIcon && <PoiIcon className={`w-4 h-4 ${poiColor}`} />}
                        <span className={`font-medium ${poiColor}`}>
                          {poiTypeConfig?.label || 'Unknown'}
                        </span>
                      </div>
                    )}
                  </div>
                  
                  <div>
                    <label className="text-sm text-gray-400">Source</label>
                    <div className="font-medium">
                      {poiData.source === 'slaveApp' ? (
                        <span className="px-2 py-1 bg-purple-500/20 text-purple-400 rounded-full text-sm">
                          Slave App
                        </span>
                      ) : poiData.source === 'detection' ? (
                        <span className="px-2 py-1 bg-amber-500/20 text-amber-400 rounded-full text-sm">
                          Detection
                        </span>
                      ) : poiData.source === 'all' ? (
                        <span className="px-2 py-1 bg-blue-500/20 text-blue-400 rounded-full text-sm">
                          Auto
                        </span>
                      ) : (
                        <span className="px-2 py-1 bg-gray-500/20 text-gray-400 rounded-full text-sm">
                          Manual
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Measurements */}
              <div className="bg-gray-700 rounded-lg p-4">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <Ruler className="w-5 h-5 text-blue-400" />
                  Measurements
                </h3>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm text-gray-400">Height Clearance</label>
                    <div className="font-mono text-lg font-bold">
                      {poiData.rel.toFixed(3)}m
                    </div>
                    <div className="text-gray-400 font-mono">
                      {(poiData.rel * 3.28084).toFixed(3)}ft
                    </div>
                  </div>
                  
                  <div>
                    <label className="text-sm text-gray-400">GPS Altitude</label>
                    <div className="font-mono text-lg">
                      {poiData.altGPS.toFixed(1)}m
                    </div>
                    <div className="text-gray-400 font-mono">
                      {(poiData.altGPS * 3.28084).toFixed(1)}ft
                    </div>
                  </div>

                  {(poiData.widthMeasure || isEditing) && (
                    <div>
                      <label className="text-sm text-gray-400">Width</label>
                      {isEditing ? (
                        <input
                          type="number"
                          value={editForm.widthMeasure}
                          onChange={(e) => setEditForm(prev => ({ ...prev, widthMeasure: e.target.value }))}
                          className="w-full px-3 py-2 bg-gray-600 border border-gray-500 text-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                          step="0.001"
                          placeholder="0.000"
                        />
                      ) : (
                        <div className="font-mono text-lg">
                          {poiData.widthMeasure ? `${poiData.widthMeasure.toFixed(3)}m` : '--'}
                        </div>
                      )}
                    </div>
                  )}

                  {(poiData.lengthMeasure || isEditing) && (
                    <div>
                      <label className="text-sm text-gray-400">Length</label>
                      {isEditing ? (
                        <input
                          type="number"
                          value={editForm.lengthMeasure}
                          onChange={(e) => setEditForm(prev => ({ ...prev, lengthMeasure: e.target.value }))}
                          className="w-full px-3 py-2 bg-gray-600 border border-gray-500 text-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                          step="0.001"
                          placeholder="0.000"
                        />
                      ) : (
                        <div className="font-mono text-lg">
                          {poiData.lengthMeasure ? `${poiData.lengthMeasure.toFixed(3)}m` : '--'}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Location & Time */}
              <div className="bg-gray-700 rounded-lg p-4">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <Navigation className="w-5 h-5 text-blue-400" />
                  Location & Time
                </h3>
                
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm text-gray-400">Latitude</label>
                      <div className="font-mono text-sm">
                        {formatCoordinate(poiData.latitude, true)}
                      </div>
                      <div className="text-xs text-gray-500">
                        {poiData.latitude.toFixed(6)}°
                      </div>
                    </div>
                    
                    <div>
                      <label className="text-sm text-gray-400">Longitude</label>
                      <div className="font-mono text-sm">
                        {formatCoordinate(poiData.longitude, false)}
                      </div>
                      <div className="text-xs text-gray-500">
                        {poiData.longitude.toFixed(6)}°
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm text-gray-400">Date & Time</label>
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-gray-400" />
                        <span className="font-mono">{poiData.utcDate}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-gray-400" />
                        <span className="font-mono">{poiData.utcTime} UTC</span>
                      </div>
                    </div>
                    
                    <div>
                      <label className="text-sm text-gray-400">Vehicle Data</label>
                      <div className="text-sm">
                        Speed: <span className="font-mono">{poiData.speed.toFixed(1)} km/h</span>
                      </div>
                      <div className="text-sm">
                        Heading: <span className="font-mono">{poiData.heading.toFixed(1)}°</span>
                      </div>
                      {poiData.videoTimestamp !== null && poiData.videoTimestamp !== undefined && poiData.videoBlobId && (
                        <div 
                          className="text-sm flex items-center gap-1 mt-1 cursor-pointer hover:text-blue-300 transition-colors"
                          onClick={() => setShowGeoVideoPlayer(true)}
                          title="Click to play video at this timestamp"
                        >
                          <Play className="w-3 h-3 text-blue-400" />
                          Video Time: <span className="font-mono text-blue-400 underline">{formatVideoTimestamp(poiData.videoTimestamp)}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Notes */}
              <div className="bg-gray-700 rounded-lg p-4">
                <h3 className="text-lg font-semibold mb-4">Notes</h3>
                {isEditing ? (
                  <textarea
                    value={editForm.note}
                    onChange={(e) => setEditForm(prev => ({ ...prev, note: e.target.value }))}
                    className="w-full px-3 py-2 bg-gray-600 border border-gray-500 text-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 h-24"
                    placeholder="Add notes about this POI..."
                  />
                ) : (
                  <div className="text-gray-300">
                    {poiData.note || (
                      <span className="text-gray-500 italic">No notes available</span>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Right Column - Media */}
            <div className="space-y-6">
              {/* Media Gallery */}
              <div className="bg-gray-700 rounded-lg p-4">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <Camera className="w-5 h-5 text-blue-400" />
                  Media Gallery
                </h3>
                
                <div className="grid grid-cols-2 gap-4">
                  {/* Image */}
                  {poiData.imageUrl ? (
                    <div className="relative group">
                      <img 
                        src={poiData.imageUrl} 
                        alt="POI Image" 
                        className="w-full h-32 object-cover rounded-lg cursor-pointer"
                        onClick={() => setShowImageModal(true)}
                      />
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 rounded-lg">
                        <button
                          onClick={() => setShowImageModal(true)}
                          className="p-2 bg-blue-500 hover:bg-blue-600 rounded-lg"
                          title="View full size"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => downloadMedia(poiData.imageUrl!, `poi-image-${formatPOIId()}.jpg`)}
                          className="p-2 bg-green-500 hover:bg-green-600 rounded-lg"
                          title="Download image"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="absolute bottom-2 left-2 bg-black/70 text-white text-xs px-2 py-1 rounded">
                        Photo
                      </div>
                    </div>
                  ) : (
                    <div className="w-full h-32 bg-gray-600 rounded-lg flex items-center justify-center">
                      <div className="text-center text-gray-400">
                        <Camera className="w-8 h-8 mx-auto mb-2" />
                        <p className="text-xs">No image</p>
                      </div>
                    </div>
                  )}

                  {/* Video - Geo-Referenced or Legacy */}
                  {poiData.videoBlobId ? (
                    <div 
                      className="relative group cursor-pointer"
                      onClick={() => setShowGeoVideoPlayer(true)}
                    >
                      <div className="w-full h-32 bg-gradient-to-br from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
                        <div className="text-center text-white">
                          <Play className="w-12 h-12 mx-auto mb-2" />
                          <p className="text-xs font-medium">Geo-Referenced Video</p>
                          {poiData.videoTimestamp !== null && poiData.videoTimestamp !== undefined && (
                            <p className="text-xs mt-1 font-mono">{formatVideoTimestamp(poiData.videoTimestamp)}</p>
                          )}
                        </div>
                      </div>
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 rounded-lg">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowGeoVideoPlayer(true);
                          }}
                          className="p-2 bg-blue-500 hover:bg-blue-600 rounded-lg"
                          title="Play geo-referenced video with POI navigation"
                        >
                          <Play className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="absolute bottom-2 left-2 bg-black/70 text-white text-xs px-2 py-1 rounded flex items-center gap-1">
                        <Video className="w-3 h-3" />
                        Geo Video
                      </div>
                    </div>
                  ) : poiData.videoUrl ? (
                    <div className="relative group">
                      <video 
                        src={poiData.videoUrl} 
                        className="w-full h-32 object-cover rounded-lg cursor-pointer"
                        onClick={() => setShowVideoModal(true)}
                      />
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 rounded-lg">
                        <button
                          onClick={() => setShowVideoModal(true)}
                          className="p-2 bg-blue-500 hover:bg-blue-600 rounded-lg"
                          title="Play video"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => downloadMedia(poiData.videoUrl!, `poi-video-${formatPOIId()}.webm`)}
                          className="p-2 bg-green-500 hover:bg-green-600 rounded-lg"
                          title="Download video"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="absolute bottom-2 left-2 bg-black/70 text-white text-xs px-2 py-1 rounded">
                        Video
                      </div>
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <div className="bg-black/50 rounded-full p-2">
                          <Video className="w-6 h-6 text-white" />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="w-full h-32 bg-gray-600 rounded-lg flex items-center justify-center">
                      <div className="text-center text-gray-400">
                        <Video className="w-8 h-8 mx-auto mb-2" />
                        <p className="text-xs">No video</p>
                      </div>
                    </div>
                  )}

                  {/* Drawing */}
                  {poiData.drawingUrl ? (
                    <div className="relative group col-span-2">
                      <img 
                        src={poiData.drawingUrl} 
                        alt="POI Drawing" 
                        className="w-full h-32 object-contain bg-white rounded-lg cursor-pointer"
                        onClick={() => setShowDrawingModal(true)}
                      />
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 rounded-lg">
                        <button
                          onClick={() => setShowDrawingModal(true)}
                          className="p-2 bg-blue-500 hover:bg-blue-600 rounded-lg"
                          title="View full size"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => downloadMedia(poiData.drawingUrl!, `poi-drawing-${formatPOIId()}.png`)}
                          className="p-2 bg-green-500 hover:bg-green-600 rounded-lg"
                          title="Download drawing"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="absolute bottom-2 left-2 bg-black/70 text-white text-xs px-2 py-1 rounded">
                        Drawing
                      </div>
                    </div>
                  ) : isEditing && (
                    <div className="col-span-2 w-full h-32 bg-gray-600 rounded-lg flex items-center justify-center">
                      <div className="text-center text-gray-400">
                        <Edit3 className="w-8 h-8 mx-auto mb-2" />
                        <p className="text-xs">No drawing available</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Technical Details */}
              <div className="bg-gray-700 rounded-lg p-4">
                <h3 className="text-lg font-semibold mb-4">Technical Details</h3>
                
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-400">POI ID:</span>
                    <span className="font-mono">{poiData.id}</span>
                  </div>
                  
                  <div className="flex justify-between">
                    <span className="text-gray-400">Created:</span>
                    <span className="font-mono">
                      {new Date(poiData.createdAt).toLocaleString()}
                    </span>
                  </div>
                  
                  <div className="flex justify-between">
                    <span className="text-gray-400">Coordinates:</span>
                    <span className="font-mono text-xs">
                      {poiData.latitude.toFixed(6)}, {poiData.longitude.toFixed(6)}
                    </span>
                  </div>
                  
                  <div className="flex justify-between">
                    <span className="text-gray-400">POI ID (short):</span>
                    <span className="font-mono">
                      {poiData.id.substring(0, 8)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          {isEditing && (
            <div className="flex justify-end gap-4 mt-6 pt-4 border-t border-gray-600">
              <button
                onClick={() => setIsEditing(false)}
                className="px-4 py-2 bg-gray-600 hover:bg-gray-500 rounded-lg text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEdit}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm"
              >
                Save Changes
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Image Modal */}
      {showImageModal && poiData.imageUrl && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[60]" onClick={() => setShowImageModal(false)}>
          <div className="max-w-4xl max-h-[90vh] p-4" onClick={e => e.stopPropagation()}>
            <img 
              src={poiData.imageUrl} 
              alt="POI Image" 
              className="max-w-full max-h-full object-contain rounded-lg"
            />
            <div className="flex justify-center gap-4 mt-4">
              <button
                onClick={() => downloadMedia(poiData.imageUrl!, `poi-image-${formatPOIId()}.jpg`)}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg"
              >
                <Download className="w-4 h-4" />
                Download
              </button>
              <button
                onClick={() => setShowImageModal(false)}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Video Modal */}
      {showVideoModal && poiData.videoUrl && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[60]" onClick={() => setShowVideoModal(false)}>
          <div className="max-w-4xl max-h-[90vh] p-4" onClick={e => e.stopPropagation()}>
            <video 
              src={poiData.videoUrl} 
              controls 
              autoPlay 
              className="max-w-full max-h-full rounded-lg"
            />
            <div className="flex justify-center gap-4 mt-4">
              <button
                onClick={() => downloadMedia(poiData.videoUrl!, `poi-video-${formatPOIId()}.webm`)}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg"
              >
                <Download className="w-4 h-4" />
                Download
              </button>
              <button
                onClick={() => setShowVideoModal(false)}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Drawing Modal */}
      {showDrawingModal && poiData.drawingUrl && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[60]" onClick={() => setShowDrawingModal(false)}>
          <div className="max-w-4xl max-h-[90vh] p-4" onClick={e => e.stopPropagation()}>
            <img 
              src={poiData.drawingUrl} 
              alt="POI Drawing" 
              className="max-w-full max-h-full object-contain bg-white rounded-lg"
            />
            <div className="flex justify-center gap-4 mt-4">
              <button
                onClick={() => downloadMedia(poiData.drawingUrl!, `poi-drawing-${formatPOIId()}.png`)}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg"
              >
                <Download className="w-4 h-4" />
                Download
              </button>
              <button
                onClick={() => setShowDrawingModal(false)}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Geo-Referenced Video Player Modal */}
      {showGeoVideoPlayer && poiData.videoBlobId && (
        <div className="fixed inset-0 bg-black/95 flex items-center justify-center z-[60]" onClick={() => setShowGeoVideoPlayer(false)}>
          <div className="w-full h-full max-w-7xl p-4 flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold text-white">Geo-Referenced Video - {formatPOIId()}</h2>
              <button
                onClick={() => setShowGeoVideoPlayer(false)}
                className="p-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-white"
                data-testid="button-close-video-player"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="flex-1 overflow-hidden">
              <GeoReferencedVideoPlayer
                videoRecordingId={poiData.videoBlobId}
                measurements={surveyMeasurements}
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default POIDetailsModal;