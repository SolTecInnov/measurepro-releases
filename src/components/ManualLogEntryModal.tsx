import React, { useState, useRef, useEffect } from 'react';
import { X, Camera, Video, Save, Trash2, Eye, Play, PenTool, Mic } from 'lucide-react';
import { POI_TYPES, MODAL_POI_TYPES, type POIType } from '../lib/poi';
import { useSurveyStore } from '../lib/survey';
import { useMeasurementLogger } from '../hooks/useMeasurementLogger';
import { useGPSStore } from '../lib/stores/gpsStore';
import { useSerialStore } from '../lib/stores/serialStore';
import { useCameraStore } from '../lib/camera';
import { soundManager } from '../lib/sounds';
import { toast } from 'sonner';
import { useSettingsStore } from '../lib/settings';
import { parseInputToMeters, formatMeasurement } from '../lib/utils/unitConversion';
import { captureFrameWithOverlay } from '../lib/camera/capture';

declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

interface ManualLogEntryModalProps {
  isOpen: boolean;
  onClose: () => void;
  videoRef?: React.RefObject<HTMLVideoElement>;
  setOfflineItems: (items: number | ((prev: number) => number)) => void;
  preSelectedPOIType?: POIType | null;
}

interface CapturedMedia {
  id: string;
  type: 'image' | 'video';
  url: string;
  thumbnail?: string;
  timestamp: string;
}

const ManualLogEntryModal: React.FC<ManualLogEntryModalProps> = ({
  isOpen,
  onClose,
  videoRef,
  setOfflineItems,
  preSelectedPOIType
}) => {
  const { activeSurvey } = useSurveyStore();
  const { data: gpsData } = useGPSStore();
  const { currentMeasurement } = useSerialStore();
  const { displaySettings } = useSettingsStore();
  const displayUnits = displaySettings?.units || 'metric';
  
  // PERFORMANCE FIX: Use worker-based measurement logging
  const { logMeasurement: logMeasurementViaWorker } = useMeasurementLogger();
  const [formData, setFormData] = useState({
    heightMeasure: '',
    widthMeasure: '',
    lengthMeasure: '',
    rollDeg: '',
    pitchDeg: '',
    poiType: '' as POIType | '',
    note: '',
    roadNumber: 1,
    poiNumber: 1
  });
  const [capturedMedia, setCapturedMedia] = useState<CapturedMedia[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingIntervalRef = useRef<number | null>(null);
  const [showDrawingModal, setShowDrawingModal] = useState(false);
  const [drawingCanvas, setDrawingCanvas] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawingActive, setIsDrawingActive] = useState(false);
  const [lastPoint, setLastPoint] = useState<{ x: number; y: number } | null>(null);
  const [capturedPhoto, setCapturedPhoto] = useState<HTMLImageElement | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  
  // Voice control state
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const recognitionRef = useRef<any>(null);
  const isListeningRef = useRef(false);

  // Reset form when modal opens and calculate next POI number
  useEffect(() => {
    if (isOpen) {
      // Calculate next POI number from existing measurements
      const calculateNextPOI = async () => {
        let nextPoiNumber = 1;
        
        if (activeSurvey) {
          try {
            const { getNextPOINumber } = await import('@/lib/survey/measurements');
            nextPoiNumber = await getNextPOINumber(activeSurvey.id);
          } catch (error) {
          }
        }
        
        // Pre-populate height with current laser measurement if available
        let initialHeight = '';
        if (currentMeasurement && currentMeasurement !== '--' && currentMeasurement !== 'DE02') {
          const measurementInMeters = parseFloat(currentMeasurement);
          if (!isNaN(measurementInMeters) && measurementInMeters > 0) {
            // Convert to display units
            if (displayUnits === 'imperial') {
              // Convert meters to feet (1 meter = 3.28084 feet) and round to 3 decimal places
              const measurementInFeet = measurementInMeters * 3.28084;
              initialHeight = measurementInFeet.toFixed(3);
            } else {
              // Keep in meters, round to 3 decimal places
              initialHeight = measurementInMeters.toFixed(3);
            }
          }
        }
        
        setFormData({
          heightMeasure: initialHeight,
          widthMeasure: '',
          lengthMeasure: '',
          rollDeg: '',
          pitchDeg: '',
          poiType: preSelectedPOIType || '',
          note: '',
          roadNumber: 1,
          poiNumber: nextPoiNumber
        });
      };
      
      calculateNextPOI();
      setCapturedMedia([]);
      setDrawingCanvas(null);
      setIsRecording(false);
      setRecordingTime(0);
      setIsListening(false);
      setTranscript('');
    } else {
      // Modal is closing - stop voice recognition via state (useEffect will handle actual stop)
      setIsListening(false);
      setTranscript('');
    }
  }, [isOpen, activeSurvey, preSelectedPOIType, currentMeasurement, displayUnits]);
  
  // Initialize Web Speech API once
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      return;
    }
    
    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    
    recognition.onresult = (event: any) => {
      let finalTranscript = '';
      let interimTranscript = '';
      
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript;
        } else {
          interimTranscript += transcript;
        }
      }
      
      // Update transcript display
      setTranscript(interimTranscript || finalTranscript);
      
      // Process final results
      if (finalTranscript) {
        parseVoiceCommand(finalTranscript);
      }
    };
    
    recognition.onerror = (event: any) => {
      if (event.error === 'no-speech') {
        // Ignore no-speech errors
        return;
      }
      if (event.error === 'not-allowed') {
        toast.error('Microphone access denied', { description: 'Allow microphone in Windows settings.' });
        setIsListening(false);
      } else if (event.error === 'network') {
        toast.error('Voice recognition needs internet', {
          description: 'Google Speech API requires an active internet connection. Check your connection and try again.',
          duration: 5000
        });
        setIsListening(false);
      } else {
        toast.error(`Voice recognition error: ${event.error}`);
        setIsListening(false);
      }
    };
    
    recognition.onend = () => {
      // Recognition ended - auto-restart if we're still supposed to be listening
      if (isListeningRef.current && recognitionRef.current) {
        try {
          recognitionRef.current.start();
        } catch (e) {
        }
      }
    };
    
    recognitionRef.current = recognition;
    
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {
          // Ignore errors on cleanup
        }
        recognitionRef.current = null;
      }
    };
  }, []); // Empty dependencies - initialize once
  
  // Manage start/stop based on isListening
  useEffect(() => {
    isListeningRef.current = isListening;
    
    if (!recognitionRef.current) {
      return;
    }
    
    if (isListening) {
      try {
        recognitionRef.current.start();
      } catch (e) {
        setIsListening(false);
      }
    } else {
      try {
        recognitionRef.current.stop();
        setTranscript(''); // Clear transcript when stopping
      } catch (e) {
        // Ignore errors when stopping
      }
    }
  }, [isListening]);
  
  // Voice command parser
  const parseVoiceCommand = (text: string) => {
    const lowerText = text.toLowerCase().trim();
    
    // POI Type patterns
    const poiTypePatterns = [
      /(?:poi type|type|set type to?)\s+(.+)/i,
    ];
    
    // Measurement patterns (support both "meters" and just numbers)
    const heightPattern = /(?:height|clearance)\s+(\d+\.?\d*)/i;
    const widthPattern = /width\s+(\d+\.?\d*)/i;
    const lengthPattern = /length\s+(\d+\.?\d*)/i;
    
    // Number patterns
    const roadPattern = /road number\s+(\d+)/i;
    const poiPattern = /poi number\s+(\d+)/i;
    
    // Note pattern
    const notePattern = /(?:note|add note)\s+(.+)/i;
    
    // Check POI type
    for (const pattern of poiTypePatterns) {
      const match = lowerText.match(pattern);
      if (match) {
        const poiTypeName = match[1].trim();
        // Find matching POI type
        const matchedType = POI_TYPES.find(type => 
          type.label.toLowerCase().includes(poiTypeName) ||
          poiTypeName.includes(type.label.toLowerCase())
        );
        if (matchedType && matchedType.type !== '') {
          setFormData(prev => ({ ...prev, poiType: matchedType.type as POIType }));
          // toast suppressed
          return true;
        }
      }
    }
    
    // Check measurements
    const heightMatch = lowerText.match(heightPattern);
    if (heightMatch) {
      setFormData(prev => ({ ...prev, heightMeasure: heightMatch[1] }));
      // toast suppressed
      return true;
    }
    
    const widthMatch = lowerText.match(widthPattern);
    if (widthMatch) {
      setFormData(prev => ({ ...prev, widthMeasure: widthMatch[1] }));
      // toast suppressed
      return true;
    }
    
    const lengthMatch = lowerText.match(lengthPattern);
    if (lengthMatch) {
      setFormData(prev => ({ ...prev, lengthMeasure: lengthMatch[1] }));
      // toast suppressed
      return true;
    }
    
    // Check road/POI numbers
    const roadMatch = lowerText.match(roadPattern);
    if (roadMatch) {
      setFormData(prev => ({ ...prev, roadNumber: parseInt(roadMatch[1]) }));
      // toast suppressed
      return true;
    }
    
    const poiNumberMatch = lowerText.match(poiPattern);
    if (poiNumberMatch) {
      setFormData(prev => ({ ...prev, poiNumber: parseInt(poiNumberMatch[1]) }));
      // toast suppressed
      return true;
    }
    
    // Check note
    const noteMatch = lowerText.match(notePattern);
    if (noteMatch) {
      setFormData(prev => ({ ...prev, note: noteMatch[1] }));
      // toast suppressed
      return true;
    }
    
    // Action commands
    if (lowerText.includes('take photo') || lowerText.includes('capture image')) {
      handleCapturePhoto();
      // toast suppressed
      return true;
    }
    
    if (lowerText.includes('record video') || lowerText.includes('start video')) {
      handleStartVideoRecording();
      return true;
    }
    
    if (lowerText.includes('stop video') || lowerText.includes('stop recording')) {
      handleStopVideoRecording();
      return true;
    }
    
    if (lowerText.includes('save entry') || lowerText.includes('save poi') || lowerText.includes('submit')) {
      handleSave();
      return true;
    }
    
    if (lowerText.includes('cancel') || lowerText.includes('close')) {
      onClose();
      return true;
    }
    
    return false;
  };
  
  // Toggle voice control
  const toggleVoiceControl = () => {
    if (!recognitionRef.current) {
      toast.error('Voice recognition not supported');
      return;
    }
    
    // Just toggle the state - the useEffect will handle start/stop
    if (isListening) {
      setIsListening(false);
      setTranscript('');
    } else {
      setIsListening(true);
      // toast suppressed
    }
  };

  // Drawing functions
  const startDrawing = (e: React.TouchEvent | React.MouseEvent) => {
    if (!canvasRef.current) return;
    
    e.preventDefault();
    setIsDrawingActive(true);
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    
    const x = (clientX - rect.left) * scaleX;
    const y = (clientY - rect.top) * scaleY;
    
    setLastPoint({ x, y });
  };

  const draw = (e: React.TouchEvent | React.MouseEvent) => {
    if (!isDrawingActive || !canvasRef.current || !lastPoint) return;
    
    e.preventDefault();
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    
    const x = (clientX - rect.left) * scaleX;
    const y = (clientY - rect.top) * scaleY;
    
    ctx.beginPath();
    ctx.moveTo(lastPoint.x, lastPoint.y);
    ctx.lineTo(x, y);
    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.stroke();
    
    setLastPoint({ x, y });
  };

  const stopDrawing = () => {
    setIsDrawingActive(false);
    setLastPoint(null);
  };

  const clearDrawing = () => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      setCapturedPhoto(null);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
  };

  const handlePhotoCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      setCapturedPhoto(img);
      URL.revokeObjectURL(objectUrl);
    };
    img.src = objectUrl;
    e.target.value = '';
  };

  const saveDrawing = () => {
    if (!canvasRef.current) return;
    const dataUrl = canvasRef.current.toDataURL('image/png');
    setDrawingCanvas(dataUrl);
    setShowDrawingModal(false);
    // toast suppressed
  };

  // Update recording time
  useEffect(() => {
    if (isRecording) {
      recordingIntervalRef.current = window.setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } else {
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
        recordingIntervalRef.current = null;
      }
      setRecordingTime(0);
    }

    return () => {
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
      }
    };
  }, [isRecording]);

  const handleCapturePhoto = async () => {
    if (!videoRef?.current) {
      toast.error('Camera not available');
      return;
    }

    const videoWidth = videoRef.current.videoWidth;
    const videoHeight = videoRef.current.videoHeight;
    
    if (!videoWidth || !videoHeight) {
      toast.error('Failed to capture image');
      return;
    }
    
    try {
      const { overlayOptions, overlayFields, imageFormat } = useCameraStore.getState();
      const timestamp = new Date().toISOString();
      
      const captureResult = await captureFrameWithOverlay(
        videoRef.current,
        {
          poi: activeSurvey ? formData.id?.substring(0, 8) || 'pending' : undefined,
          gps: {
            latitude: gpsData.latitude,
            longitude: gpsData.longitude,
            altitude: gpsData.altitude,
          },
          height: formData.heightMeasure ? `${formData.heightMeasure}` : undefined,
          course: gpsData.course,
          time: timestamp,
          surveyTitle: overlayFields.surveyTitle || activeSurvey?.name,
          projectNumber: overlayFields.projectNumber,
          surveyorName: overlayFields.surveyorName,
          poiNotes: overlayFields.poiNotes || formData.note,
          showLogo: true,
        },
        overlayOptions,
        imageFormat
      );
      
      const newMedia: CapturedMedia = {
        id: crypto.randomUUID(),
        type: 'image',
        url: captureResult.dataUrl,
        timestamp: captureResult.metadata.timestamp
      };
      
      setCapturedMedia(prev => [...prev, newMedia]);
      // toast suppressed
    } catch (error) {
      toast.error('Failed to capture photo');
    }
  };

  const handleStartVideoRecording = () => {
    if (!videoRef?.current?.srcObject) {
      toast.error('Camera not available');
      return;
    }

    try {
      const stream = videoRef.current.srcObject as MediaStream;
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
      const chunks: Blob[] = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const videoBlob = new Blob(chunks, { type: 'video/webm' });
        const videoUrl = URL.createObjectURL(videoBlob);
        
        // Generate thumbnail
        const video = document.createElement('video');
        video.src = videoUrl;
        video.currentTime = 1; // Seek to 1 second for thumbnail
        
        video.onloadeddata = () => {
          const canvas = document.createElement('canvas');
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          const ctx = canvas.getContext('2d');
          
          if (ctx) {
            ctx.drawImage(video, 0, 0);
            const thumbnailUrl = canvas.toDataURL('image/jpeg');
            
            const newMedia: CapturedMedia = {
              id: crypto.randomUUID(),
              type: 'video',
              url: videoUrl,
              thumbnail: thumbnailUrl,
              timestamp: new Date().toISOString()
            };
            
            setCapturedMedia(prev => [...prev, newMedia]);
            // toast suppressed
          }
        };
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);
    } catch (error) {
      toast.error('Failed to start recording');
    }
  };

  const handleStopVideoRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      mediaRecorderRef.current = null;
    }
  };

  const handleDeleteMedia = (id: string) => {
    setCapturedMedia(prev => prev.filter(media => media.id !== id));
  };

  const handleSave = async () => {
    if (!activeSurvey) {
      toast.error('Please create a survey first');
      return;
    }

    if (!formData.poiType) {
      toast.error('Please select a POI type');
      return;
    }

    // Validate measurements - only required for non-modal POI types
    const isModalType = MODAL_POI_TYPES.includes(formData.poiType as POIType);
    const hasMeasurements = formData.heightMeasure || formData.widthMeasure || formData.lengthMeasure;
    
    if (!isModalType && !hasMeasurements) {
      toast.error('Please enter at least one measurement (height, width, or length)');
      return;
    }

    try {
      // Convert input values to meters (values are entered in display units)
      const heightInMeters = formData.heightMeasure ? parseInputToMeters(formData.heightMeasure, displayUnits) : 0;
      const widthInMeters = formData.widthMeasure ? parseInputToMeters(formData.widthMeasure, displayUnits) : null;
      const lengthInMeters = formData.lengthMeasure ? parseInputToMeters(formData.lengthMeasure, displayUnits) : null;
      
      // Create note with all measurements in the current display units
      const measurements = [];
      if (formData.heightMeasure) {
        const heightDisplay = formatMeasurement(heightInMeters, displayUnits, { decimals: 3 });
        measurements.push(`Height: ${heightDisplay}`);
      }
      if (formData.widthMeasure) {
        const widthDisplay = formatMeasurement(widthInMeters!, displayUnits, { decimals: 3 });
        measurements.push(`Width: ${widthDisplay}`);
      }
      if (formData.lengthMeasure) {
        const lengthDisplay = formatMeasurement(lengthInMeters!, displayUnits, { decimals: 3 });
        measurements.push(`Length: ${lengthDisplay}`);
      }
      
      const measurementNote = measurements.length > 0 ? measurements.join(', ') : '';
      const fullNote = measurementNote 
        ? `MANUAL ENTRY - ${measurementNote}${formData.note ? ` | ${formData.note}` : ''}`
        : `MANUAL ENTRY${formData.note ? ` - ${formData.note}` : ''}`;

      const newMeasurement = {
        id: crypto.randomUUID(),
        user_id: activeSurvey.id,
        survey_id: activeSurvey.id,
        rel: heightInMeters,
        widthMeasure: widthInMeters,
        lengthMeasure: lengthInMeters,
        rollDeg: formData.rollDeg !== '' ? parseFloat(formData.rollDeg) : null,
        pitchDeg: formData.pitchDeg !== '' ? parseFloat(formData.pitchDeg) : null,
        altGPS: gpsData.altitude,
        latitude: gpsData.latitude,
        longitude: gpsData.longitude,
        utcDate: new Date().toISOString().split('T')[0],
        utcTime: new Date().toTimeString().split(' ')[0],
        speed: gpsData.speed,
        heading: gpsData.course,
        roadNumber: formData.roadNumber,
        poiNumber: formData.poiNumber,
        poi_type: formData.poiType,
        imageUrl: capturedMedia.find(m => m.type === 'image')?.url || null,
        videoUrl: capturedMedia.find(m => m.type === 'video')?.url || null,
        drawingUrl: drawingCanvas,
        note: fullNote,
        createdAt: new Date().toISOString(),
        source: 'manual' as const
      };

      // PERFORMANCE FIX: Use worker-based logging for off-thread, batched writes
      await logMeasurementViaWorker(newMeasurement);
      
      // Add POI image to timelapse if images are attached
      const imageUrl = capturedMedia.find(m => m.type === 'image')?.url;
      if (imageUrl) {
        const { addPOIFrameToTimelapse } = await import('@/lib/timelapse/poiIntegration');
        const { updateMeasurement } = await import('@/lib/survey/measurements');
        const frameNumber = await addPOIFrameToTimelapse(imageUrl, newMeasurement);
        
        // Only update measurement with frame number if frame was actually added (not excluded)
        if (frameNumber !== null) {
          await updateMeasurement(newMeasurement.id, { timelapseFrameNumber: frameNumber });
        }
      }
      
      setOfflineItems(prev => prev + 1);
      soundManager.playLogEntry();
      
      // Toast notification disabled per user request
      // // toast suppressed

      onClose();
    } catch (error) {
      toast.error('Failed to save manual entry');
    }
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 overflow-y-auto py-8">
      <div className="bg-gray-800 rounded-xl w-full max-w-4xl p-6 mx-4 my-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Manual Log Entry</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-300"
            data-testid="button-close-modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        {/* Voice Control Button */}
        <div className="mb-4">
          <button
            onClick={toggleVoiceControl}
            className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg transition-all ${
              isListening 
                ? 'bg-green-600 animate-pulse shadow-lg shadow-green-500/50' 
                : 'bg-blue-600 hover:bg-blue-700'
            }`}
            data-testid="button-voice-control"
          >
            <Mic className="w-5 h-5" />
            <span className="font-medium">
              {isListening ? 'Listening...' : 'Voice Fill Form'}
            </span>
          </button>
          
          {/* Transcript Display */}
          {isListening && transcript && (
            <div className="mt-2 bg-blue-900/30 border border-blue-700 rounded-lg p-3">
              <div className="text-xs text-blue-400 mb-1">Listening:</div>
              <div className="text-sm text-white">{transcript}</div>
            </div>
          )}
          
          {/* Voice Commands Help */}
          {isListening && !transcript && (
            <div className="mt-2 bg-gray-700/50 border border-gray-600 rounded-lg p-3">
              <div className="text-xs text-gray-400 mb-2">Try saying:</div>
              <div className="text-xs text-gray-300 space-y-1">
                <div>• "POI type bridge" or "type traffic light"</div>
                <div>• "height 5.5" or "width 3 meters"</div>
                <div>• "road number 3" or "POI number 15"</div>
                <div>• "note needs inspection"</div>
                <div>• "take photo" or "save entry"</div>
              </div>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-6">
          {/* Left Column - Form */}
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Road Number
                </label>
                <div
                  className="w-full px-3 py-2 bg-gray-700/50 border border-gray-600 text-gray-400 rounded-lg select-none"
                  data-testid="text-road-number"
                >
                  {formData.roadNumber}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  POI Number
                </label>
                <div
                  className="w-full px-3 py-2 bg-gray-700/50 border border-gray-600 text-gray-400 rounded-lg select-none"
                  data-testid="text-poi-number"
                >
                  {formData.poiNumber}
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                POI Type *
              </label>
              <select
                value={formData.poiType}
                onChange={(e) => setFormData(prev => ({ ...prev, poiType: e.target.value as POIType }))}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 text-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                required
              >
                <option value="">Select POI Type</option>
                {POI_TYPES.filter(poi => poi.type !== '').map((poiType) => (
                  <option key={poiType.type} value={poiType.type}>
                    {poiType.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Height Clearance ({displayUnits === 'imperial' ? 'ft' : 'm'})
                </label>
                <input
                  type="number"
                  value={formData.heightMeasure}
                  onChange={(e) => setFormData(prev => ({ ...prev, heightMeasure: e.target.value }))}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 text-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                  step={displayUnits === 'imperial' ? '0.1' : '0.001'}
                  placeholder={displayUnits === 'imperial' ? '0.0' : '0.000'}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Width ({displayUnits === 'imperial' ? 'ft' : 'm'})
                </label>
                <input
                  type="number"
                  value={formData.widthMeasure}
                  onChange={(e) => setFormData(prev => ({ ...prev, widthMeasure: e.target.value }))}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 text-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                  step={displayUnits === 'imperial' ? '0.1' : '0.001'}
                  placeholder={displayUnits === 'imperial' ? '0.0' : '0.000'}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Length ({displayUnits === 'imperial' ? 'ft' : 'm'})
                </label>
                <input
                  type="number"
                  value={formData.lengthMeasure}
                  onChange={(e) => setFormData(prev => ({ ...prev, lengthMeasure: e.target.value }))}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 text-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                  step={displayUnits === 'imperial' ? '0.1' : '0.001'}
                  placeholder={displayUnits === 'imperial' ? '0.0' : '0.000'}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Roll (°)
                </label>
                <input
                  type="number"
                  value={formData.rollDeg}
                  onChange={(e) => setFormData(prev => ({ ...prev, rollDeg: e.target.value }))}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 text-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                  step="0.1"
                  placeholder="0.0"
                  data-testid="input-roll-deg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Pitch (°)
                </label>
                <input
                  type="number"
                  value={formData.pitchDeg}
                  onChange={(e) => setFormData(prev => ({ ...prev, pitchDeg: e.target.value }))}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 text-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                  step="0.1"
                  placeholder="0.0"
                  data-testid="input-pitch-deg"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Additional Notes
              </label>
              <textarea
                value={formData.note}
                onChange={(e) => setFormData(prev => ({ ...prev, note: e.target.value }))}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 text-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 h-24"
                placeholder="Enter additional notes or observations..."
                data-testid="textarea-note"
              />
              
              {/* Drawing Controls */}
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => { setCapturedPhoto(null); setShowDrawingModal(true); }}
                  className="flex items-center gap-2 px-3 py-1.5 bg-purple-600 hover:bg-purple-700 rounded-lg text-sm"
                  data-testid="button-add-drawing"
                >
                  <PenTool className="w-4 h-4" />
                  Add Drawing
                </button>
                {drawingCanvas && (
                  <button
                    type="button"
                    onClick={() => setDrawingCanvas(null)}
                    className="flex items-center gap-2 px-3 py-1.5 bg-red-600 hover:bg-red-700 rounded-lg text-sm"
                    data-testid="button-clear-drawing"
                  >
                    <Trash2 className="w-4 h-4" />
                    Clear Drawing
                  </button>
                )}
              </div>
              
              {/* Drawing Preview */}
              {drawingCanvas && (
                <div className="mt-2">
                  <img 
                    src={drawingCanvas} 
                    alt="Drawing" 
                    className="w-full h-20 object-contain bg-white rounded border"
                  />
                </div>
              )}
            </div>

            {/* Media Capture Controls */}
            <div className="bg-gray-700 rounded-lg p-4">
              <h3 className="text-sm font-medium text-gray-300 mb-3">Capture Media</h3>
              <div className="flex gap-2">
                <button
                  onClick={handleCapturePhoto}
                  className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm"
                  data-testid="button-take-photo"
                >
                  <Camera className="w-4 h-4" />
                  Take Photo
                </button>
                
                {isRecording ? (
                  <button
                    onClick={handleStopVideoRecording}
                    className="flex items-center gap-2 px-3 py-1.5 bg-red-600 hover:bg-red-700 rounded-lg text-sm"
                    data-testid="button-stop-video"
                  >
                    <Video className="w-4 h-4" />
                    Stop Recording ({formatTime(recordingTime)})
                  </button>
                ) : (
                  <button
                    onClick={handleStartVideoRecording}
                    className="flex items-center gap-2 px-3 py-1.5 bg-green-600 hover:bg-green-700 rounded-lg text-sm"
                    data-testid="button-record-video"
                  >
                    <Video className="w-4 h-4" />
                    Record Video
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Right Column - Media Preview */}
          <div className="space-y-4">
            <div className="bg-gray-700 rounded-lg p-4">
              <h3 className="text-sm font-medium text-gray-300 mb-3">
                Captured Media ({capturedMedia.length})
              </h3>
              
              {capturedMedia.length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                  No media captured yet
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4 max-h-80 overflow-y-auto">
                  {capturedMedia.map((media) => (
                    <div key={media.id} className="relative bg-gray-800 rounded-lg overflow-hidden">
                      {media.type === 'image' ? (
                        <img 
                          src={media.url} 
                          alt="Captured" 
                          className="w-full h-24 object-cover"
                        />
                      ) : (
                        <div className="relative">
                          {media.thumbnail ? (
                            <img 
                              src={media.thumbnail} 
                              alt="Video thumbnail" 
                              className="w-full h-24 object-cover"
                            />
                          ) : (
                            <div className="w-full h-24 flex items-center justify-center bg-gray-900">
                              <Video className="w-8 h-8 text-gray-500" />
                            </div>
                          )}
                          <div className="absolute inset-0 flex items-center justify-center">
                            <Play className="w-6 h-6 text-white opacity-70" />
                          </div>
                        </div>
                      )}
                      
                      <div className="absolute top-1 right-1 flex gap-1">
                        <button
                          onClick={() => window.open(media.url, '_blank')}
                          className="p-1 bg-black/70 text-white rounded hover:bg-black/90"
                          title="View full size"
                        >
                          <Eye className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => handleDeleteMedia(media.id)}
                          className="p-1 bg-red-500/70 text-white rounded hover:bg-red-500/90"
                          title="Delete"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                      
                      <div className="absolute bottom-1 left-1 bg-black/70 text-white text-xs px-1 rounded">
                        {media.type === 'image' ? 'Photo' : 'Video'}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* GPS Information */}
            <div className="bg-gray-700 rounded-lg p-4">
              <h3 className="text-sm font-medium text-gray-300 mb-3">Current Location</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-400">Latitude:</span>
                  <span className="font-mono">{gpsData.latitude.toFixed(6)}°</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Longitude:</span>
                  <span className="font-mono">{gpsData.longitude.toFixed(6)}°</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Altitude:</span>
                  <span className="font-mono">{gpsData.altitude.toFixed(1)}m</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Speed:</span>
                  <span className="font-mono">{gpsData.speed.toFixed(1)} km/h</span>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        {/* Drawing Modal */}
        {showDrawingModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
            <div className="bg-gray-800 rounded-xl w-full max-w-7xl max-h-[95vh] overflow-hidden">
              <div className="p-4 border-b border-gray-700 flex items-center justify-between">
                <h3 className="text-xl font-semibold flex items-center gap-2">
                  <PenTool className="w-6 h-6 text-purple-400" />
                  Add Drawing
                </h3>
                <button
                  onClick={() => setShowDrawingModal(false)}
                  className="text-gray-400 hover:text-gray-300"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="p-6 overflow-y-auto max-h-[calc(95vh-120px)]">
                <input
                  ref={photoInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={handlePhotoCapture}
                  data-testid="input-photo-capture"
                />
                <div className="bg-white rounded-lg mb-6 w-full shadow-lg">
                  <canvas
                    ref={canvasRef}
                    width={1200}
                    height={800}
                    className="w-full h-[600px] border-2 border-gray-300 rounded-lg cursor-crosshair"
                    onMouseDown={startDrawing}
                    onMouseMove={draw}
                    onMouseUp={stopDrawing}
                    onMouseLeave={stopDrawing}
                    onTouchStart={startDrawing}
                    onTouchMove={draw}
                    onTouchEnd={stopDrawing}
                    style={{ touchAction: 'none' }}
                    data-testid="canvas-drawing"
                  />
                </div>
                
                <div className="flex gap-4 mb-4">
                  <button
                    type="button"
                    onClick={() => photoInputRef.current?.click()}
                    className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-purple-700 hover:bg-purple-600 rounded-lg text-base font-medium"
                    data-testid="button-take-photo-drawing"
                  >
                    <Camera className="w-5 h-5" />
                    {capturedPhoto ? 'Retake Photo' : 'Take Photo'}
                  </button>
                </div>

                <div className="flex gap-4">
                  <button
                    type="button"
                    onClick={clearDrawing}
                    className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-gray-700 hover:bg-gray-600 rounded-lg text-base font-medium"
                    data-testid="button-clear-drawing"
                  >
                    <Trash2 className="w-5 h-5" />
                    Clear Drawing
                  </button>
                  <button
                    type="button"
                    onClick={saveDrawing}
                    className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg text-base font-medium"
                    data-testid="button-save-drawing"
                  >
                    <Save className="w-5 h-5" />
                    Save Drawing
                  </button>
                </div>
                
                <div className="mt-4 bg-blue-900/20 border border-blue-800/30 rounded-lg p-4">
                  <h4 className="text-sm font-medium text-blue-400 mb-2">Drawing Instructions</h4>
                  <ul className="space-y-1 text-sm text-gray-300">
                    <li>• Draw with your finger on mobile or mouse on desktop</li>
                    <li>• High resolution canvas: 1200x800 pixels</li>
                    <li>• Drawing will be saved as PNG image with the measurement</li>
                    <li>• Use "Clear Drawing" to start over</li>
                    <li>• Drawing is included in all exports and reports</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex justify-end gap-4 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm font-medium transition-colors"
            data-testid="button-cancel"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 rounded-lg text-sm font-medium transition-colors"
            data-testid="button-save"
          >
            <Save className="w-4 h-4" />
            Save Manual Entry
          </button>
        </div>
      </div>
    </div>
  );
};

export default ManualLogEntryModal;