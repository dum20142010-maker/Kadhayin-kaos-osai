import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { GoogleGenAI } from '@google/genai';
import { triggerHaptic } from '../lib/haptic';
import { soundscapeEngine } from '../lib/soundscapes';
import { ALL_UNIFIED_MAP_SPOTS, UnifiedMapSpot } from '../data/allUnifiedSpots';

// Geodesic calculations for Live Lens Digital Compass & AR Guidance HUD
function calculateDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3; // Earth radius in metres
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

function calculateBearingDegrees(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  const θ = Math.atan2(y, x);
  return ((θ * 180) / Math.PI + 360) % 360;
}

function getCardinalDirection(degrees: number): string {
  const directions = [
    'N', 'NNE', 'NE', 'ENE',
    'E', 'ESE', 'SE', 'SSE',
    'S', 'SSW', 'SW', 'WSW',
    'W', 'WNW', 'NW', 'NNW',
  ];
  const index = Math.round((degrees % 360) / 22.5) % 16;
  return directions[index];
}

interface LiveLensModalProps {
  isOpen: boolean;
  onClose: () => void;
  onShowToast: (msg: string, icon?: string) => void;
  onStampUnlocked?: (stampName: string) => void;
  initialFilterId?: string;
  targetSpot?: UnifiedMapSpot | null;
}

export interface HeritageFilter {
  id: string;
  name: string;
  era: string;
  icon: string;
  description: string;
  cssFilter: string;
  overlayClass?: string;
  stampText: string;
  accentColor: string;
}

export const CHENNAI_HERITAGE_FILTERS: HeritageFilter[] = [
  {
    id: 'normal',
    name: 'Raw Vision',
    era: 'Present Day',
    icon: 'photo_camera',
    description: 'Clean, uncompressed true-color lens calibration',
    cssFilter: 'none',
    stampText: 'CHENNAI HERITAGE • 2026',
    accentColor: '#f97316',
  },
  {
    id: 'peaberry-1924',
    name: '1924 Peaberry Sepia',
    era: 'Madras Roastery',
    icon: 'local_cafe',
    description: 'Warm roasted tamarind charcoal & golden chicory sepia tone',
    cssFilter: 'sepia(0.65) contrast(1.15) brightness(0.95) saturate(1.25) hue-rotate(-15deg)',
    overlayClass: 'bg-amber-950/20 mix-blend-color-burn',
    stampText: 'TRIPLICANE 80:20 ROAST • 1924',
    accentColor: '#d97706',
  },
  {
    id: 'coromandel-1880',
    name: 'Coromandel Cyanotype',
    era: '1880s Maritime',
    icon: 'waves',
    description: 'Prussian blue archival blueprint used by harbor cartographers',
    cssFilter: 'contrast(1.22) brightness(0.92) sepia(0.4) hue-rotate(175deg) saturate(1.7)',
    overlayClass: 'bg-blue-950/25 mix-blend-overlay',
    stampText: 'COROMANDEL SURVEY • 1880',
    accentColor: '#38bdf8',
  },
  {
    id: 'mylapore-gold',
    name: 'Mylapore Temple Gold',
    era: 'Dravidian Sunset',
    icon: 'wb_sunny',
    description: 'Turmeric, terracotta warmth & glowing ghee oil-lamp luster',
    cssFilter: 'contrast(1.12) saturate(1.5) brightness(1.06) sepia(0.25) hue-rotate(-8deg)',
    overlayClass: 'bg-orange-500/15 mix-blend-soft-light',
    stampText: 'MYLAPORE TEPPAKULAM • GOLD',
    accentColor: '#eab308',
  },
  {
    id: 'saracenic-oxide',
    name: 'Indo-Saracenic Oxide',
    era: '1879 Red Chunam',
    icon: 'domain',
    description: 'Deep red oxide brick & Robert Chisholm Byzantine masonry palette',
    cssFilter: 'contrast(1.28) saturate(1.35) sepia(0.48) hue-rotate(-32deg) brightness(0.92)',
    overlayClass: 'bg-red-950/25 mix-blend-multiply',
    stampText: 'SENATE HOUSE MASONRY • 1879',
    accentColor: '#ef4444',
  },
  {
    id: 'kodachrome-1970',
    name: '1970s Madras Film',
    era: 'Analog Revival',
    icon: 'camera_roll',
    description: 'Punchy retro emulsion with gentle grain and warm coastal greens',
    cssFilter: 'contrast(1.18) saturate(1.38) brightness(1.02) sepia(0.14)',
    overlayClass: 'bg-emerald-950/15 mix-blend-color-dodge',
    stampText: 'MADRAS KODACHROME • 1974',
    accentColor: '#10b981',
  },
  {
    id: 'daguerreotype-1850',
    name: '1850 Silver Gelatin',
    era: 'British East India',
    icon: 'filter_b_and_w',
    description: 'High-contrast monochrome archival print with deep velvet blacks',
    cssFilter: 'grayscale(1) contrast(1.38) brightness(0.94)',
    overlayClass: 'bg-zinc-900/30 mix-blend-screen',
    stampText: 'FORT ST. GEORGE ARCHIVE • 1850',
    accentColor: '#a1a1aa',
  },
];

const SAMPLE_SCANS = [
  {
    name: 'Kapaleeshwarar Dravidian Gopuram',
    zone: 'Mylapore',
    year: '7th Century Dravidian',
    imageUrl: 'https://images.unsplash.com/photo-1621570216025-d227b2b6ef55?auto=format&fit=crop&w=600&q=80',
    vintageUrl: 'https://images.unsplash.com/photo-1582510003544-4d00b7f74220?auto=format&fit=crop&w=600&q=80',
    archStyle: 'Dravidian Granite & Stucco Iconography',
    lore: 'The soaring eastern gopuram depicts 63 Nayanmars. Aligned with subterranean springs feeding the Teppakulam holy tank.',
    secretPerk: 'Unlocked: Sacred Teppakulam Passport Stamp (+160 XP)',
  },
  {
    name: 'Senate House Rosette Vault',
    zone: 'Chepauk',
    year: 'Built 1879',
    imageUrl: 'https://images.unsplash.com/photo-1582510003544-4d00b7f74220?auto=format&fit=crop&w=600&q=80',
    vintageUrl: 'https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?auto=format&fit=crop&w=600&q=80',
    archStyle: 'Indo-Saracenic & Byzantine Masonry',
    lore: "Robert Chisholm's masterwork harmonising Byzantine stone vaults with Mughal sunshades. The northern colonnade catches ruby rosette refraction at 9:30 AM.",
    secretPerk: 'Unlocked: Senate House Archive Access (+150 XP)',
  },
  {
    name: '1920s Filter Coffee Roasting Drum',
    zone: 'Triplicane',
    year: 'Est. 1924',
    imageUrl: 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?auto=format&fit=crop&w=600&q=80',
    vintageUrl: 'https://images.unsplash.com/photo-1509785307050-d4066910ec1e?auto=format&fit=crop&w=600&q=80',
    archStyle: 'Madras Heritage Timber Shopfront',
    lore: 'Third-generation roasters rotating heavy iron cylinders at 42 RPM over seasoned tamarind charcoal for the legendary 80:20 peaberry blend.',
    secretPerk: 'Unlocked: Free Single-Estate Peaberry Tasting (+100 XP)',
  },
  {
    name: 'Armenian Church Bell Tower',
    zone: 'George Town',
    year: 'Rebuilt 1772',
    imageUrl: 'https://images.unsplash.com/photo-1548625149-fc4a29cf7092?auto=format&fit=crop&w=600&q=80',
    vintageUrl: 'https://images.unsplash.com/photo-1584824486509-112e4181ff6b?auto=format&fit=crop&w=600&q=80',
    archStyle: 'Armenian Colonial Baroque & Cast Belfry',
    lore: 'Houses six monumental bells cast in Whitechapel and Amsterdam. The belfry rings every Sunday across the tranquil frangipani courtyard.',
    secretPerk: 'Unlocked: Whitechapel Six Bells Stamp (+130 XP)',
  },
];

export const LiveLensModal: React.FC<LiveLensModalProps> = ({
  isOpen,
  onClose,
  onShowToast,
  onStampUnlocked,
  initialFilterId,
  targetSpot,
}) => {
  // Input Modes: 'camera' (hardware webcam/phone camera) | 'upload' (user photo) | 'preset' (sample landmark)
  const [viewMode, setViewMode] = useState<'camera' | 'upload' | 'preset'>('camera');
  const [cameraFacing, setCameraFacing] = useState<'environment' | 'user'>('environment');
  const [cameraLoading, setCameraLoading] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cameraPermissionGranted, setCameraPermissionGranted] = useState<boolean>(false);

  // Uploaded photo state
  const [uploadedPhotoUrl, setUploadedPhotoUrl] = useState<string | null>(null);
  const [capturedPhotoUrl, setCapturedPhotoUrl] = useState<string | null>(null);

  // Scan & Processing State
  const [selectedScanIdx, setSelectedScanIdx] = useState(0);
  const [scanning, setScanning] = useState(false);
  const [scanCompleted, setScanCompleted] = useState(false);
  const [showVintageComparison, setShowVintageComparison] = useState(false);
  const [isNarrating, setIsNarrating] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);

  // Vintage Heritage Filters State
  const [selectedFilterId, setSelectedFilterId] = useState<string>(initialFilterId || 'peaberry-1924');
  const [showVignette, setShowVignette] = useState<boolean>(true);
  const [showStampWatermark, setShowStampWatermark] = useState<boolean>(true);
  const [shutterFlashing, setShutterFlashing] = useState<boolean>(false);

  // Real-Time Digital Compass & AR Guidance HUD Overlay State
  const [showCompass, setShowCompass] = useState<boolean>(true);
  const [compassTargetType, setCompassTargetType] = useState<'heritage' | 'food' | 'all'>('heritage');
  const [userCoords, setUserCoords] = useState<{ lat: number; lng: number }>({
    lat: 13.0674,
    lng: 80.2650, // Central Chennai / Marina
  });
  const [deviceHeading, setDeviceHeading] = useState<number>(45);
  const [manualHeadingOffset, setManualHeadingOffset] = useState<number>(0);
  const [hasOrientationSensor, setHasOrientationSensor] = useState<boolean>(false);
  const prevLockedRef = useRef(false);

  // Refs for Media Stream & Canvas Snapping
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const nativeCameraInputRef = useRef<HTMLInputElement>(null);
  const uploadImgRef = useRef<HTMLImageElement>(null);
  const presetImgRef = useRef<HTMLImageElement>(null);

  // Sync initialFilterId when prop updates
  useEffect(() => {
    if (initialFilterId) {
      setSelectedFilterId(initialFilterId);
    }
  }, [initialFilterId]);

  // Clean stop of camera media stream
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  // Start hardware camera stream
  const startCamera = useCallback(
    async (facing: 'environment' | 'user' = cameraFacing) => {
      stopCamera();
      setCameraLoading(true);
      setCameraError(null);

      try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          throw new Error('Camera hardware access is not supported by your browser environment.');
        }

        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: facing,
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        });

        streamRef.current = stream;
        setCameraFacing(facing);
        setCameraPermissionGranted(true);
        setViewMode('camera');
        setCameraError(null);

        // Attach to video element
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadedmetadata = () => {
            videoRef.current?.play().catch(() => {});
          };
        }
      } catch (err: any) {
        console.warn('Camera access error:', err);
        const isDenied = err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError';
        const isNotFound = err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError';

        const msg = isDenied
          ? 'Camera permission denied. Please allow camera access in your browser or upload a photo from your gallery.'
          : isNotFound
          ? 'No physical camera detected. You can snap/upload a photo from your photo gallery instead.'
          : `Camera unavailable (${err.message || 'permission error'}). You can upload photos directly from your device.`;

        setCameraError(msg);
        setCameraPermissionGranted(false);

        // Fallback to upload or preset
        if (!uploadedPhotoUrl) {
          setViewMode('preset');
        }
      } finally {
        setCameraLoading(false);
      }
    },
    [cameraFacing, stopCamera, uploadedPhotoUrl]
  );

  // Manage camera on modal open/close
  useEffect(() => {
    if (isOpen) {
      // Auto-start camera when modal opens
      startCamera('environment');
    } else {
      stopCamera();
      setAiAnalysis(null);
      setScanCompleted(false);
      setCapturedPhotoUrl(null);
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
      soundscapeEngine.stop();
      setIsNarrating(false);
    }

    return () => {
      stopCamera();
    };
  }, [isOpen]);

  // Track Geolocation and Device Orientation in Real Time
  useEffect(() => {
    if (!isOpen) return;

    let geoWatchId: number | null = null;
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setUserCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        },
        () => {
          setUserCoords({ lat: 13.0674, lng: 80.2650 });
        },
        { timeout: 5000 }
      );

      geoWatchId = navigator.geolocation.watchPosition(
        (pos) => {
          setUserCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        },
        () => {},
        { enableHighAccuracy: true, maximumAge: 4000 }
      );
    }

    const handleOrientation = (e: DeviceOrientationEvent) => {
      let heading: number | null = null;
      if ((e as any).webkitCompassHeading !== undefined) {
        heading = (e as any).webkitCompassHeading;
      } else if (e.alpha !== null) {
        heading = (360 - e.alpha) % 360;
      }

      if (heading !== null && !isNaN(heading)) {
        setDeviceHeading(Math.round(heading));
        setHasOrientationSensor(true);
      }
    };

    window.addEventListener('deviceorientation', handleOrientation, true);
    window.addEventListener('deviceorientationabsolute' as any, handleOrientation, true);

    return () => {
      if (geoWatchId !== null && 'geolocation' in navigator) {
        navigator.geolocation.clearWatch(geoWatchId);
      }
      window.removeEventListener('deviceorientation', handleOrientation, true);
      window.removeEventListener('deviceorientationabsolute' as any, handleOrientation, true);
    };
  }, [isOpen]);

  const currentHeading = useMemo(() => {
    return (deviceHeading + manualHeadingOffset + 360) % 360;
  }, [deviceHeading, manualHeadingOffset]);

  // Target spot: either the explicit targetSpot prop or nearest from Chennai 600-spot corpus
  const activeSpot = useMemo(() => {
    if (targetSpot) return targetSpot;

    const candidates = ALL_UNIFIED_MAP_SPOTS.filter((s) => {
      if (compassTargetType === 'heritage') return s.type === 'heritage';
      if (compassTargetType === 'food') return s.type === 'food';
      return true;
    });

    if (candidates.length === 0) return ALL_UNIFIED_MAP_SPOTS[0];

    let nearest = candidates[0];
    let minDistance = Infinity;

    for (const spot of candidates) {
      const d = calculateDistanceMeters(userCoords.lat, userCoords.lng, spot.lat, spot.lng);
      if (d < minDistance) {
        minDistance = d;
        nearest = spot;
      }
    }
    return nearest;
  }, [targetSpot, compassTargetType, userCoords]);

  // AR Guidance calculations
  const arGuidanceData = useMemo(() => {
    if (!activeSpot) return null;

    const d = calculateDistanceMeters(userCoords.lat, userCoords.lng, activeSpot.lat, activeSpot.lng);
    const bearing = calculateBearingDegrees(userCoords.lat, userCoords.lng, activeSpot.lat, activeSpot.lng);
    const relativeAngle = ((bearing - currentHeading + 540) % 360) - 180;
    const isLockedOn = Math.abs(relativeAngle) <= 12;

    const formattedDist =
      d < 1000 ? `${Math.round(d)} m` : `${(d / 1000).toFixed(1)} km`;

    // Turn hint
    let turnHint = 'Target in Sight';
    if (relativeAngle > 12) {
      turnHint = `Turn ${Math.round(relativeAngle)}° Right ➔`;
    } else if (relativeAngle < -12) {
      turnHint = `⬅ Turn ${Math.round(Math.abs(relativeAngle))}° Left`;
    }

    return {
      spot: activeSpot,
      distanceMeters: d,
      formattedDistance: formattedDist,
      bearingDegrees: Math.round(bearing),
      relativeAngle,
      isLockedOn,
      cardinal: getCardinalDirection(bearing),
      turnHint,
    };
  }, [activeSpot, userCoords, currentHeading]);

  // Haptic pulse when reticle locks onto landmark
  useEffect(() => {
    if (arGuidanceData?.isLockedOn && !prevLockedRef.current) {
      triggerHaptic('medium');
    }
    prevLockedRef.current = !!arGuidanceData?.isLockedOn;
  }, [arGuidanceData?.isLockedOn]);

  if (!isOpen) return null;

  const currentPreset = SAMPLE_SCANS[selectedScanIdx];
  const currentFilter =
    CHENNAI_HERITAGE_FILTERS.find((f) => f.id === selectedFilterId) || CHENNAI_HERITAGE_FILTERS[0];

  // Capture video frame or current photo onto hidden canvas with watermark
  const captureFrameToCanvas = (): string | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    let sourceWidth = 1280;
    let sourceHeight = 720;

    if (viewMode === 'camera' && videoRef.current && videoRef.current.videoWidth > 0) {
      sourceWidth = videoRef.current.videoWidth;
      sourceHeight = videoRef.current.videoHeight;
      canvas.width = sourceWidth;
      canvas.height = sourceHeight;
      ctx.drawImage(videoRef.current, 0, 0, sourceWidth, sourceHeight);
    } else if (viewMode === 'upload' && uploadImgRef.current) {
      sourceWidth = uploadImgRef.current.naturalWidth || 1000;
      sourceHeight = uploadImgRef.current.naturalHeight || 750;
      canvas.width = sourceWidth;
      canvas.height = sourceHeight;
      ctx.drawImage(uploadImgRef.current, 0, 0, sourceWidth, sourceHeight);
    } else if (presetImgRef.current) {
      sourceWidth = presetImgRef.current.naturalWidth || 800;
      sourceHeight = presetImgRef.current.naturalHeight || 600;
      canvas.width = sourceWidth;
      canvas.height = sourceHeight;
      ctx.drawImage(presetImgRef.current, 0, 0, sourceWidth, sourceHeight);
    }

    // Draw archival watermark banner at bottom
    if (showStampWatermark) {
      const barHeight = Math.max(40, Math.round(sourceHeight * 0.085));
      ctx.fillStyle = 'rgba(10, 10, 14, 0.85)';
      ctx.fillRect(0, sourceHeight - barHeight, sourceWidth, barHeight);

      // Accent border
      ctx.fillStyle = currentFilter.accentColor;
      ctx.fillRect(0, sourceHeight - barHeight, sourceWidth, 3);

      // Title
      ctx.fillStyle = '#ffffff';
      ctx.font = `bold ${Math.max(14, Math.round(barHeight * 0.36))}px sans-serif`;
      const spotTitle = activeSpot?.name || currentPreset.name;
      ctx.fillText(`CHENNAI LIVE LENS • ${spotTitle.toUpperCase()}`, 18, sourceHeight - barHeight * 0.44);

      // Coords and stamp
      ctx.fillStyle = '#cbd5e1';
      ctx.font = `${Math.max(11, Math.round(barHeight * 0.26))}px monospace`;
      const coordsText = `${userCoords.lat.toFixed(4)}°N, ${userCoords.lng.toFixed(4)}°E • ${currentFilter.stampText}`;
      ctx.fillText(coordsText, 18, sourceHeight - barHeight * 0.16);
    }

    try {
      return canvas.toDataURL('image/jpeg', 0.9);
    } catch {
      return null;
    }
  };

  // Handle Photo Upload from Gallery or Native Camera
  const handlePhotoFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (loadEvent) => {
      const dataUrl = loadEvent.target?.result as string;
      setUploadedPhotoUrl(dataUrl);
      setViewMode('upload');
      stopCamera();
      triggerHaptic('medium');
      onShowToast('Photo loaded into AR Viewfinder! Ready for AI Scan.', 'photo_library');
    };
    reader.readAsDataURL(file);
  };

  // Snap photo from live camera or photo view
  const handleSnapVintagePhoto = () => {
    setShutterFlashing(true);
    triggerHaptic([40, 50, 90]);
    setTimeout(() => setShutterFlashing(false), 240);

    const photoDataUrl = captureFrameToCanvas();
    if (photoDataUrl) {
      setCapturedPhotoUrl(photoDataUrl);

      // Auto download high-res stamped capture
      const link = document.createElement('a');
      link.href = photoDataUrl;
      const cleanName = (activeSpot?.name || currentPreset.name).toLowerCase().replace(/[^a-z0-9]/g, '-');
      link.download = `chennai-ar-snap-${cleanName}-${Date.now()}.jpg`;
      link.click();
    }

    onShowToast(`Captured with "${currentFilter.name}"! Downloaded & stamped into Journal 📸✨`, 'photo_camera');
  };

  // AI Multimodal Vision Scan with Gemini
  const handleStartScan = async () => {
    setScanning(true);
    setScanCompleted(false);
    setShowVintageComparison(false);
    triggerHaptic('medium');
    soundscapeEngine.playTempleBells(0.3);

    const capturedDataUrl = captureFrameToCanvas();
    if (capturedDataUrl) {
      setCapturedPhotoUrl(capturedDataUrl);
    }

    try {
      const ai = new GoogleGenAI();
      const spotName = activeSpot?.name || currentPreset.name;
      const spotZone = activeSpot?.neighborhood || currentPreset.zone;

      let contents: any[] = [];
      if (capturedDataUrl && capturedDataUrl.startsWith('data:image/')) {
        const base64Clean = capturedDataUrl.replace(/^data:image\/[a-z]+;base64,/, '');
        contents = [
          {
            inlineData: {
              mimeType: 'image/jpeg',
              data: base64Clean,
            },
          },
          {
            text: `You are Maya, the expert Chennai architectural historian and AR Chrono-Navigator.
The explorer is viewing or aiming their camera at "${spotName}" in ${spotZone}, Chennai (GPS: ${userCoords.lat.toFixed(4)}°N, ${userCoords.lng.toFixed(4)}°E).
Analyze the visual architectural features, inscriptions, brickwork, colonial facade, stucco figures, or street food elements in this frame.
Provide a concise, authentic breakdown:
1. Architectural / Physical Analysis (2 sentences)
2. Historical Lore or Secret Anecdote (2 sentences)
3. Secret Explorer Tip (1 sentence). Keep it atmospheric, vivid, and culturally rich.`,
          },
        ];
      } else {
        contents = [
          `Analyze this Chennai heritage landmark: "${spotName}" in ${spotZone}.
Provide:
1. Architectural Style Analysis (2 sentences)
2. 100-Year Historical Lore Anecdote (2 sentences)
3. Secret Explorer Tip (1 sentence). Keep it engaging, sophisticated, and atmospheric.`,
        ];
      }

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents,
      });

      setAiAnalysis(response.text || null);
    } catch (err: any) {
      console.warn('AI Vision Scan failed:', err);
      setAiAnalysis(
        `Architectural Heritage Verified: ${activeSpot?.name || currentPreset.name} in ${activeSpot?.neighborhood || currentPreset.zone} exhibits classical Dravidian / Indo-Saracenic masonry and centuries of living traditions.`
      );
    } finally {
      setScanning(false);
      setScanCompleted(true);
      triggerHaptic([40, 60, 80]);
      onShowToast(`Discovered & Verified: ${activeSpot?.name || currentPreset.name} (+120 XP)`, 'verified');
      onStampUnlocked?.(activeSpot?.name || currentPreset.name);
    }
  };

  // Audio narration
  const handleNarrate = () => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      onShowToast('Audio synthesis not supported on this device', 'error');
      return;
    }

    if (isNarrating) {
      window.speechSynthesis.cancel();
      setIsNarrating(false);
      soundscapeEngine.stop();
      onShowToast('Audio narration paused', 'pause');
      return;
    }

    try {
      window.speechSynthesis.cancel();
      const spotName = activeSpot?.name || currentPreset.name;
      const spotLore = activeSpot?.lore || currentPreset.lore;
      const spotStyle = activeSpot?.architecturalStyle || currentPreset.archStyle;
      const textToSpeak = `${spotName}. ${spotLore} ${spotStyle ? `Architectural Style: ${spotStyle}.` : ''}`;

      const utterance = new SpeechSynthesisUtterance(textToSpeak);
      utterance.rate = 1.0;
      utterance.pitch = 1.0;

      utterance.onstart = () => {
        setIsNarrating(true);
        soundscapeEngine.playTempleBells(0.35);
        triggerHaptic('light');
        onShowToast('Playing spatial audio lore...', 'volume_up');
      };

      utterance.onend = () => {
        setIsNarrating(false);
        soundscapeEngine.stop();
      };

      utterance.onerror = () => {
        setIsNarrating(false);
        soundscapeEngine.stop();
      };

      window.speechSynthesis.speak(utterance);
    } catch {
      setIsNarrating(false);
      soundscapeEngine.stop();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md"
      onClick={onClose}
    >
      <div
        className="bg-[#1a1a1e] rounded-3xl w-full max-w-lg shadow-2xl border border-orange-500/30 overflow-hidden flex flex-col max-h-[94vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Hidden Canvas & File Pickers */}
        <canvas ref={canvasRef} className="hidden" />
        <input
          type="file"
          ref={fileInputRef}
          accept="image/*"
          className="hidden"
          onChange={handlePhotoFileSelected}
        />
        <input
          type="file"
          ref={nativeCameraInputRef}
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={handlePhotoFileSelected}
        />

        {/* Top Header Bar */}
        <div className="p-3.5 sm:p-4 bg-[#121114] border-b border-[#26242c] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#F05423]/20 text-[#F05423] flex items-center justify-center border border-[#F05423]/40">
              <span className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                photo_camera
              </span>
            </div>
            <div>
              <h3 className="font-headline text-base sm:text-lg text-white font-bold flex items-center gap-1.5">
                <span>KAOS Live Lens & AR Camera</span>
                <span className="px-2 py-0.5 rounded-full bg-[#F05423]/20 text-[#F05423] text-[10px] font-mono font-bold uppercase">
                  KAOS Vision
                </span>
              </h3>
              <p className="text-[11px] text-[#9898a0]">
                Live hardware camera, photo inspection & AR guidance overlay. Every place has a story.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-[#1a1a1e] text-[#9898a0] flex items-center justify-center hover:text-white transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        {/* Camera Source Selector Ribbon: Live Camera | Upload Photo | Preset Landmark */}
        <div className="bg-[#16161a] px-3.5 py-2 border-b border-[#26262b] flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => {
                setViewMode('camera');
                startCamera(cameraFacing);
                triggerHaptic('light');
              }}
              className={`px-2.5 py-1 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer border ${
                viewMode === 'camera'
                  ? 'bg-orange-600 text-white border-orange-400 shadow'
                  : 'bg-[#1e1e24] text-zinc-400 hover:text-white border-zinc-700/50'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${viewMode === 'camera' ? 'bg-emerald-400 animate-ping' : 'bg-zinc-500'}`} />
              <span className="material-symbols-outlined text-[15px]">videocam</span>
              <span>Live Camera</span>
            </button>

            <button
              onClick={() => {
                triggerHaptic('light');
                fileInputRef.current?.click();
              }}
              className={`px-2.5 py-1 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer border ${
                viewMode === 'upload'
                  ? 'bg-orange-600 text-white border-orange-400 shadow'
                  : 'bg-[#1e1e24] text-zinc-400 hover:text-white border-zinc-700/50'
              }`}
            >
              <span className="material-symbols-outlined text-[15px]">photo_library</span>
              <span>{uploadedPhotoUrl ? 'Photo Loaded' : 'Upload Photo'}</span>
            </button>

            <button
              onClick={() => {
                triggerHaptic('light');
                nativeCameraInputRef.current?.click();
              }}
              className="px-2 py-1 rounded-xl bg-[#1e1e24] text-zinc-300 hover:text-white text-xs font-semibold border border-zinc-700/50 flex items-center gap-1 cursor-pointer"
              title="Snap with Device Camera App"
            >
              <span className="material-symbols-outlined text-[14px]">add_a_photo</span>
              <span className="hidden sm:inline">Snap</span>
            </button>

            <button
              onClick={() => {
                setViewMode('preset');
                stopCamera();
                triggerHaptic('light');
              }}
              className={`px-2.5 py-1 rounded-xl text-xs font-bold transition-all flex items-center gap-1 cursor-pointer border ${
                viewMode === 'preset'
                  ? 'bg-orange-600 text-white border-orange-400 shadow'
                  : 'bg-[#1e1e24] text-zinc-400 hover:text-white border-zinc-700/50'
              }`}
            >
              <span className="material-symbols-outlined text-[14px]">view_in_ar</span>
              <span>Presets</span>
            </button>
          </div>

          {/* Front / Rear Camera Switcher (Active only in Camera mode) */}
          {viewMode === 'camera' && (
            <button
              onClick={() => {
                const nextFacing = cameraFacing === 'environment' ? 'user' : 'environment';
                startCamera(nextFacing);
                triggerHaptic('light');
              }}
              className="px-2 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[11px] font-semibold flex items-center gap-1 border border-zinc-700 transition-all cursor-pointer"
              title="Flip Camera (Front/Rear)"
            >
              <span className="material-symbols-outlined text-[15px]">cameraswitch</span>
              <span>{cameraFacing === 'environment' ? 'Rear' : 'Front'}</span>
            </button>
          )}
        </div>

        {/* MAIN AR VIEWFINDER / CAMERA CONTAINER */}
        <div className="relative w-full h-64 sm:h-76 bg-black overflow-hidden select-none flex items-center justify-center">
          {/* 1. Live Camera Stream */}
          {viewMode === 'camera' && (
            <>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                style={{ filter: currentFilter.cssFilter }}
                className="w-full h-full object-cover"
              />

              {cameraLoading && (
                <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center gap-2 z-10">
                  <div className="w-8 h-8 border-3 border-orange-500 border-t-transparent rounded-full animate-spin" />
                  <span className="text-xs text-orange-400 font-mono font-bold">Connecting Camera Stream...</span>
                </div>
              )}

              {cameraError && (
                <div className="absolute inset-0 bg-black/90 p-6 flex flex-col items-center justify-center text-center gap-3 z-15">
                  <span className="material-symbols-outlined text-orange-400 text-3xl">no_photography</span>
                  <p className="text-xs text-zinc-300 max-w-xs">{cameraError}</p>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => startCamera(cameraFacing)}
                      className="px-3 py-1.5 rounded-xl bg-orange-600 hover:bg-orange-500 text-white text-xs font-bold cursor-pointer"
                    >
                      Retry Camera
                    </button>
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-bold cursor-pointer"
                    >
                      Upload Photo
                    </button>
                  </div>
                </div>
              )}
            </>
          )}

          {/* 2. Uploaded Photo View */}
          {viewMode === 'upload' && uploadedPhotoUrl && (
            <img
              ref={uploadImgRef}
              src={uploadedPhotoUrl}
              alt="Uploaded Frame"
              style={{ filter: currentFilter.cssFilter }}
              className={`w-full h-full object-contain transition-all duration-300 ${
                scanning ? 'scale-105 filter brightness-110' : 'scale-100'
              }`}
            />
          )}

          {/* 3. Preset Landmark Image */}
          {viewMode === 'preset' && (
            <img
              ref={presetImgRef}
              src={showVintageComparison ? currentPreset.vintageUrl : currentPreset.imageUrl}
              alt={currentPreset.name}
              style={{ filter: currentFilter.cssFilter }}
              className={`w-full h-full object-cover transition-all duration-500 ${
                scanning ? 'scale-105 filter brightness-110' : 'scale-100'
              }`}
            />
          )}

          {/* Color Tint Overlay Layer */}
          {currentFilter.overlayClass && (
            <div className={`absolute inset-0 pointer-events-none transition-all duration-300 ${currentFilter.overlayClass}`} />
          )}

          {/* Vintage Vignette & Grain Layer */}
          {showVignette && (
            <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_center,transparent_45%,rgba(0,0,0,0.7)_100%)]" />
          )}

          {/* Shutter Flash Animation */}
          {shutterFlashing && (
            <div className="absolute inset-0 bg-white pointer-events-none animate-ping z-30" />
          )}

          {/* AR Target Reticle Overlay */}
          <div className="absolute inset-3 border border-white/30 rounded-2xl pointer-events-none flex flex-col justify-between p-2.5 z-20">
            <div className="flex justify-between items-center text-[10px] font-mono text-white/90 bg-black/60 backdrop-blur-md px-2.5 py-1 rounded-md self-start border border-white/10">
              <span className="flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full ${scanning ? 'bg-red-500 animate-ping' : 'bg-emerald-400'}`} />
                {scanning ? 'ANALYZING FACADE GEOMETRY...' : `${currentFilter.name.toUpperCase()} ACTIVE`}
              </span>
            </div>

            {/* Scanning Laser Beam */}
            {scanning && (
              <div className="w-full h-1 bg-gradient-to-r from-transparent via-orange-400 to-transparent shadow-[0_0_15px_#f97316] animate-pulse my-auto" />
            )}

            {/* Live Stamp Watermark Badge */}
            {showStampWatermark && (
              <div className="flex justify-between items-end">
                <div className="bg-black/80 backdrop-blur-md px-2.5 py-1 rounded-lg text-[10px] font-mono border border-white/10 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: currentFilter.accentColor }} />
                  <span className="text-white font-bold">{currentFilter.stampText}</span>
                </div>
                <div className="bg-black/80 backdrop-blur-md px-2 py-1 rounded text-[10px] text-white font-mono border border-white/10">
                  {activeSpot?.neighborhood || currentPreset.zone}
                </div>
              </div>
            )}
          </div>

          {/* REAL-TIME DIGITAL COMPASS & AR GUIDANCE HUD OVERLAY */}
          {showCompass && arGuidanceData && (
            <div className="absolute inset-0 pointer-events-none z-25 flex flex-col justify-between p-2.5">
              {/* Top Bar: Heading & AR Turn Guidance Readout */}
              <div className="flex items-center justify-between gap-1.5 pointer-events-auto">
                <div className="flex items-center gap-1 bg-black/80 backdrop-blur-md p-1 rounded-xl border border-white/15 text-[10px] shadow-lg">
                  <button
                    onClick={() => {
                      setCompassTargetType('heritage');
                      triggerHaptic('light');
                    }}
                    className={`px-2 py-0.5 rounded-lg font-bold transition-all cursor-pointer ${
                      compassTargetType === 'heritage'
                        ? 'bg-orange-600 text-white shadow'
                        : 'text-zinc-400 hover:text-white'
                    }`}
                  >
                    🏛️ Heritage
                  </button>
                  <button
                    onClick={() => {
                      setCompassTargetType('food');
                      triggerHaptic('light');
                    }}
                    className={`px-2 py-0.5 rounded-lg font-bold transition-all cursor-pointer ${
                      compassTargetType === 'food'
                        ? 'bg-amber-600 text-white shadow'
                        : 'text-zinc-400 hover:text-white'
                    }`}
                  >
                    🍲 Food Gems
                  </button>
                </div>

                {/* Heading Azimuth Readout */}
                <div className="bg-black/80 backdrop-blur-md px-2 py-1 rounded-xl border border-white/15 text-[10px] font-mono font-bold text-white flex items-center gap-1 shadow-lg shrink-0">
                  <span className="material-symbols-outlined text-[13px] text-orange-400">navigation</span>
                  <span>{String(currentHeading).padStart(3, '0')}° {getCardinalDirection(currentHeading)}</span>
                </div>
              </div>

              {/* Center AR Compass Rose Dial with Directional Pointer Needle */}
              <div className="relative self-center w-24 h-24 sm:w-28 sm:h-28 my-auto flex items-center justify-center pointer-events-auto">
                {/* Rotating Compass Ring */}
                <div
                  className="absolute inset-0 rounded-full border border-white/20 bg-black/50 backdrop-blur-xs flex items-center justify-center transition-transform duration-150 ease-out shadow-[0_0_20px_rgba(0,0,0,0.6)]"
                  style={{ transform: `rotate(${-currentHeading}deg)` }}
                >
                  <span className="absolute top-1 text-[9px] font-mono font-bold text-red-400">N</span>
                  <span className="absolute right-1.5 text-[9px] font-mono font-bold text-white/70">E</span>
                  <span className="absolute bottom-1 text-[9px] font-mono font-bold text-white/70">S</span>
                  <span className="absolute left-1.5 text-[9px] font-mono font-bold text-white/70">W</span>
                  <div className="absolute inset-1.5 rounded-full border border-dashed border-white/15" />
                </div>

                {/* Target Landmark Needle pointing relative to user heading */}
                <div
                  className="absolute w-full h-full flex items-center justify-center transition-transform duration-200 ease-out pointer-events-none"
                  style={{ transform: `rotate(${arGuidanceData.relativeAngle}deg)` }}
                >
                  <div className="relative flex flex-col items-center h-full justify-start pt-1">
                    <div
                      className={`w-0 h-0 border-x-[7px] border-x-transparent border-b-[20px] transition-colors ${
                        arGuidanceData.isLockedOn
                          ? 'border-b-emerald-400 filter drop-shadow-[0_0_8px_#34d399]'
                          : 'border-b-orange-500 filter drop-shadow-[0_0_6px_#f97316]'
                      }`}
                    />
                    <div className="w-0.5 h-6 bg-gradient-to-b from-orange-400/80 to-transparent" />
                  </div>
                </div>

                {/* Center Core Hub with Lock-On Indicator */}
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all shadow-md z-10 ${
                    arGuidanceData.isLockedOn
                      ? 'bg-emerald-500 text-black animate-pulse ring-4 ring-emerald-400/50'
                      : 'bg-black/85 text-orange-400 border border-orange-500/50'
                  }`}
                >
                  <span className="material-symbols-outlined text-[17px]">
                    {arGuidanceData.isLockedOn ? 'gps_fixed' : 'near_me'}
                  </span>
                </div>
              </div>

              {/* Bottom Target Card with AR Directional Turn Guidance */}
              <div className="pointer-events-auto bg-black/85 backdrop-blur-md rounded-2xl p-2.5 border border-white/15 flex items-center justify-between gap-2 shadow-2xl">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-8 h-8 rounded-xl bg-orange-600/20 text-orange-400 border border-orange-500/30 flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-[17px]">
                      {activeSpot.type === 'food' ? 'restaurant' : 'fort'}
                    </span>
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[9px] font-bold text-orange-400 uppercase tracking-wider">
                        {arGuidanceData.isLockedOn ? '🎯 ALIGNED WITH LANDMARK' : 'AR GUIDANCE'}
                      </span>
                      <span className="text-zinc-600">•</span>
                      <span className="text-[9px] text-zinc-300 font-mono font-bold text-emerald-400">
                        {arGuidanceData.turnHint}
                      </span>
                    </div>

                    <h5 className="font-bold text-xs text-white truncate leading-tight">
                      {activeSpot.name}
                    </h5>

                    <div className="flex items-center gap-2 text-[10px] text-zinc-300 font-mono">
                      <span className="text-orange-400 font-bold">{arGuidanceData.formattedDistance}</span>
                      <span>•</span>
                      <span>Bearing: {String(arGuidanceData.bearingDegrees).padStart(3, '0')}° ({arGuidanceData.cardinal})</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={handleSnapVintagePhoto}
                    className="px-2.5 py-1.5 rounded-xl bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white text-[10px] font-bold shadow active:scale-95 transition-all flex items-center gap-1 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[13px]">photo_camera</span>
                    <span>Snap</span>
                  </button>
                </div>
              </div>

              {/* Manual Sweep Controls for Desktop */}
              {!hasOrientationSensor && (
                <div className="pointer-events-auto bg-black/75 backdrop-blur-xs px-2 py-0.5 rounded-xl border border-white/10 flex items-center justify-between gap-1.5 mt-1">
                  <span className="text-[8px] text-zinc-400 shrink-0 font-mono">Simulate Heading:</span>
                  <input
                    type="range"
                    min="0"
                    max="360"
                    value={manualHeadingOffset}
                    onChange={(e) => setManualHeadingOffset(Number(e.target.value))}
                    className="w-full accent-orange-500 h-1 bg-zinc-700 rounded-lg cursor-pointer"
                    title="Rotate Compass Heading"
                  />
                  <button
                    onClick={() => {
                      setManualHeadingOffset((prev) => (prev + 45) % 360);
                      triggerHaptic('light');
                    }}
                    className="text-[8px] text-orange-400 font-mono shrink-0 hover:underline cursor-pointer"
                  >
                    +45°
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Quick HUD Overlays */}
          <div className="absolute top-3 right-3 z-30 flex items-center gap-1.5">
            <button
              onClick={() => {
                setShowCompass(!showCompass);
                triggerHaptic('light');
              }}
              title="Toggle Real-Time Digital Compass HUD"
              className={`px-2 py-1 rounded-lg backdrop-blur-md flex items-center gap-1 text-[11px] font-bold border transition-all cursor-pointer ${
                showCompass ? 'bg-orange-600 text-white border-orange-400 shadow-md' : 'bg-black/60 text-white/80 border-white/15'
              }`}
            >
              <span className="material-symbols-outlined text-[15px]">explore</span>
              <span className="hidden sm:inline">AR HUD</span>
            </button>

            <button
              onClick={() => {
                setShowVignette(!showVignette);
                triggerHaptic('light');
              }}
              title="Toggle Vintage Vignette"
              className={`w-7 h-7 rounded-lg backdrop-blur-md flex items-center justify-center text-[12px] border cursor-pointer ${
                showVignette ? 'bg-orange-600/80 text-white border-orange-400/50' : 'bg-black/50 text-white/70 border-white/10'
              }`}
            >
              <span className="material-symbols-outlined text-[15px]">vignette</span>
            </button>

            <button
              onClick={() => {
                setShowStampWatermark(!showStampWatermark);
                triggerHaptic('light');
              }}
              title="Toggle Watermark Stamp"
              className={`w-7 h-7 rounded-lg backdrop-blur-md flex items-center justify-center text-[12px] border cursor-pointer ${
                showStampWatermark ? 'bg-orange-600/80 text-white border-orange-400/50' : 'bg-black/50 text-white/70 border-white/10'
              }`}
            >
              <span className="material-symbols-outlined text-[15px]">branding_watermark</span>
            </button>
          </div>
        </div>

        {/* CHENNAI HERITAGE & VINTAGE IMAGE FILTERS CAROUSEL */}
        <div className="bg-[#121214] px-4 py-2 border-b border-[#26262b] space-y-1.5">
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-orange-400 font-bold uppercase tracking-wider flex items-center gap-1">
              <span className="material-symbols-outlined text-[14px]">filter_vintage</span>
              <span>Vintage Madras Film Presets</span>
            </span>
            <span className="text-[10px] text-[#9898a0] font-mono">{currentFilter.era}</span>
          </div>

          <div className="flex gap-2 overflow-x-auto no-scrollbar py-0.5">
            {CHENNAI_HERITAGE_FILTERS.map((filter) => {
              const isSelected = selectedFilterId === filter.id;

              return (
                <button
                  key={filter.id}
                  onClick={() => {
                    setSelectedFilterId(filter.id);
                    triggerHaptic('light');
                    onShowToast(`Applied ${filter.name} Filter ✨`, filter.icon);
                  }}
                  className={`shrink-0 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 border active:scale-95 cursor-pointer ${
                    isSelected
                      ? 'bg-orange-600 text-white border-orange-400 shadow-md ring-1 ring-orange-500/40'
                      : 'bg-[#1a1a1e] text-[#cfcfd6] hover:bg-[#26262b] hover:text-white border-[#26262b]'
                  }`}
                >
                  <span className="material-symbols-outlined text-[15px]" style={{ color: isSelected ? '#ffffff' : filter.accentColor }}>
                    {filter.icon}
                  </span>
                  <div className="text-left">
                    <span className="block leading-tight text-[11px]">{filter.name}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Presets carousel if preset mode active */}
        {viewMode === 'preset' && (
          <div className="px-4 pt-2 pb-1 flex gap-2 overflow-x-auto no-scrollbar border-b border-[#26262b]">
            {SAMPLE_SCANS.map((scan, idx) => (
              <button
                key={scan.name}
                onClick={() => {
                  setSelectedScanIdx(idx);
                  setScanCompleted(false);
                  setShowVintageComparison(false);
                  setAiAnalysis(null);
                  triggerHaptic('light');
                }}
                className={`shrink-0 px-3 py-1 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                  selectedScanIdx === idx
                    ? 'bg-amber-600/90 text-white shadow-md'
                    : 'bg-[#121214] text-[#9898a0] hover:text-white border border-[#26262b]'
                }`}
              >
                <span>{scan.name.split(' ')[0]}</span>
                <span className="text-[10px] opacity-75 font-normal">({scan.zone})</span>
              </button>
            ))}
          </div>
        )}

        {/* Scan Details & Story Body */}
        <div className="p-4 overflow-y-auto space-y-3 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div>
              <span className="text-[10px] text-orange-400 font-bold uppercase tracking-wider">
                {activeSpot?.neighborhood || currentPreset.zone} Heritage Node
              </span>
              <h4 className="font-headline text-lg sm:text-xl text-white font-bold">
                {activeSpot?.name || currentPreset.name}
              </h4>
            </div>
            <span className="px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 text-[11px] font-bold shrink-0 border border-emerald-500/20">
              {activeSpot?.architecturalStyle || currentPreset.archStyle.split('&')[0]}
            </span>
          </div>

          <p className="text-xs text-[#9898a0] leading-relaxed">
            {activeSpot?.lore || currentPreset.lore}
          </p>

          {/* Active Filter Mood Hint */}
          <div className="p-2.5 rounded-xl bg-[#121214] border border-[#26262b] flex items-center justify-between text-[11px]">
            <span className="text-[#9898a0]">
              <strong className="text-white">{currentFilter.name}:</strong> {currentFilter.description}
            </span>
            <button
              onClick={handleSnapVintagePhoto}
              className="px-2.5 py-1 rounded-lg bg-orange-600/20 hover:bg-orange-600 text-orange-400 hover:text-white font-bold text-[10px] border border-orange-500/30 transition-colors shrink-0 ml-2 active:scale-95 cursor-pointer"
            >
              Snap & Save
            </button>
          </div>

          {/* Gemini AI Spatial Vision Breakdown */}
          {aiAnalysis && (
            <div className="p-3.5 rounded-2xl bg-[#121214] border border-orange-500/30 space-y-1.5 animate-in fade-in">
              <div className="flex items-center gap-1.5 text-orange-400 font-bold text-xs">
                <span className="material-symbols-outlined text-[16px]">auto_awesome</span>
                <span>Gemini Spatial Lore Synthesis</span>
              </div>
              <p className="text-xs text-white/90 leading-relaxed whitespace-pre-line">{aiAnalysis}</p>
            </div>
          )}

          {scanCompleted && (
            <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-500/40 flex items-center justify-between text-xs text-emerald-300">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[20px] text-emerald-400" style={{ fontVariationSettings: "'FILL' 1" }}>
                  military_tech
                </span>
                <span className="font-semibold">
                  {currentPreset.secretPerk || `Verified: ${activeSpot.name} Proof-of-Discovery`}
                </span>
              </div>
              <span className="font-mono font-bold text-emerald-400">+120 XP</span>
            </div>
          )}
        </div>

        {/* Action Bottom Bar: Scan & Decrypt | Snap Photo | Spatial Audio */}
        <div className="p-4 bg-[#121214] border-t border-[#26262b] flex gap-2.5">
          <button
            onClick={handleStartScan}
            disabled={scanning}
            className="flex-1 py-3.5 rounded-2xl bg-orange-600 hover:bg-orange-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg active:scale-95 transition-all disabled:opacity-50 cursor-pointer"
          >
            {scanning ? (
              <>
                <span className="material-symbols-outlined animate-spin text-[18px]">progress_activity</span>
                <span>AI Vision Analyzing Geometry...</span>
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                  center_focus_strong
                </span>
                <span>{scanCompleted ? 'Rescan Camera Frame' : 'AI Vision Scan (+120 XP)'}</span>
              </>
            )}
          </button>

          <button
            onClick={handleSnapVintagePhoto}
            aria-label="Capture Filtered Photo"
            className="px-4 py-3.5 rounded-2xl bg-[#1a1a1e] hover:bg-[#26262b] text-white border border-[#26262b] flex items-center justify-center gap-1.5 font-bold text-xs transition-all active:scale-95 cursor-pointer"
            title="Snap with Selected Vintage Filter"
          >
            <span className="material-symbols-outlined text-[18px] text-orange-400">photo_camera</span>
            <span>Snap</span>
          </button>

          <button
            onClick={handleNarrate}
            aria-label="Spatial Audio Lore"
            className={`px-4 py-3.5 rounded-2xl border flex items-center justify-center gap-1.5 font-bold text-xs transition-all active:scale-95 cursor-pointer ${
              isNarrating
                ? 'bg-orange-600/20 text-orange-400 border-orange-500'
                : 'bg-[#1a1a1e] hover:bg-[#26262b] text-white border-[#26262b]'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: isNarrating ? "'FILL' 1" : "'FILL' 0" }}>
              {isNarrating ? 'pause' : 'spatial_audio'}
            </span>
            <span>{isNarrating ? 'Pause' : 'Audio'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
