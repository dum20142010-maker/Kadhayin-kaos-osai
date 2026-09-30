import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { setOptions, importLibrary } from '@googlemaps/js-api-loader';
import { MarkerClusterer } from '@googlemaps/markerclusterer';
import { triggerHaptic } from '../lib/haptic';
import { soundscapeEngine } from '../lib/soundscapes';
import { initKaosMap } from '../services/mapsService';
import {
  UnifiedMapSpot,
  ALL_UNIFIED_MAP_SPOTS,
  CURATED_EXPEDITION_PRESETS,
  CuratedExpeditionPreset,
  mapSpotToDiscovery,
} from '../data/allUnifiedSpots';
import { Discovery, SavedLocationPin } from '../types';
import { evaluatePlaceOpenStatus, PlaceOpenStatus } from '../lib/openingHours';

declare global {
  interface Window {
    google: any;
    initGoogleMapsCallback?: () => void;
    gm_authFailure?: () => void;
  }
}

const GOOGLE_MAPS_API_KEY =
  (import.meta as any).env?.VITE_GOOGLE_MAPS_API_KEY || 'AIzaSyC-8sz-WC5Bh4KEuFafiB15MIPr2rE-1Mk';

interface GoogleMapViewProps {
  onOpenDossier: (discovery: Discovery) => void;
  onShowToast: (msg: string, icon?: string) => void;
  selectedZone?: string;
  onZoneChange?: (zone: string) => void;
  initialNavSpot?: UnifiedMapSpot | null;
  onClearInitialNavSpot?: () => void;
  customPins?: SavedLocationPin[];
  onDeleteCustomPin?: (id: string) => void;
}

// Dark Luxury Map Theme
const darkMapStyle = [
  { elementType: 'geometry', stylers: [{ color: '#141418' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#141418' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#a1a1aa' }] },
  {
    featureType: 'administrative.locality',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#fb923c' }],
  },
  {
    featureType: 'poi',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#d4d4d8' }],
  },
  {
    featureType: 'poi.park',
    elementType: 'geometry',
    stylers: [{ color: '#14291e' }],
  },
  {
    featureType: 'poi.park',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#34d399' }],
  },
  {
    featureType: 'road',
    elementType: 'geometry',
    stylers: [{ color: '#27272a' }],
  },
  {
    featureType: 'road',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#1f1f23' }],
  },
  {
    featureType: 'road',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#e4e4e7' }],
  },
  {
    featureType: 'road.highway',
    elementType: 'geometry',
    stylers: [{ color: '#ea580c' }, { weight: 1.5 }],
  },
  {
    featureType: 'road.highway',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#9a3412' }],
  },
  {
    featureType: 'transit',
    elementType: 'geometry',
    stylers: [{ color: '#27272a' }],
  },
  {
    featureType: 'transit.station',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#fdba74' }],
  },
  {
    featureType: 'water',
    elementType: 'geometry',
    stylers: [{ color: '#0c1e38' }],
  },
  {
    featureType: 'water',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#38bdf8' }],
  },
];

const ZONE_CENTERS: Record<string, { lat: number; lng: number; zoom: number }> = {
  'All Chennai': { lat: 13.0674, lng: 80.2650, zoom: 12 },
  'Fort, George Town & North Beach': { lat: 13.0888, lng: 80.2872, zoom: 15 },
  'Park Town, Central & Egmore': { lat: 13.0781, lng: 80.2612, zoom: 15 },
  'Marina, Chepauk & Triplicane': { lat: 13.0574, lng: 80.2815, zoom: 15 },
  'Mylapore & Santhome': { lat: 13.0335, lng: 80.2715, zoom: 15 },
  'Royapettah, Gopalapuram & Teynampet': { lat: 13.0512, lng: 80.2542, zoom: 15 },
  'Nungambakkam & T. Nagar': { lat: 13.0455, lng: 80.2378, zoom: 15 },
  'Guindy, Saidapet & Adyar': { lat: 13.0084, lng: 80.2325, zoom: 14 },
  'Besant Nagar & Thiruvanmiyur': { lat: 12.9924, lng: 80.2642, zoom: 14 },
  'Royapuram & North Coast': { lat: 13.1185, lng: 80.2942, zoom: 14 },
};

const GLOBAL_EXPLORER_PRESETS = [
  { label: '📍 Real Device GPS', city: 'Your Location', lat: 0, lng: 0 },
  { label: '🇬🇧 London, UK', city: 'London, UK', lat: 51.5074, lng: -0.1278 },
  { label: '🇺🇸 New York, USA', city: 'New York, USA', lat: 40.7128, lng: -74.0060 },
  { label: '🇺🇸 San Francisco, USA', city: 'San Francisco, USA', lat: 37.7749, lng: -122.4194 },
  { label: '🇸🇬 Singapore', city: 'Singapore', lat: 1.3521, lng: 103.8198 },
  { label: '🇦🇪 Dubai, UAE', city: 'Dubai, UAE', lat: 25.2048, lng: 55.2708 },
  { label: '🇯🇵 Tokyo, Japan', city: 'Tokyo, Japan', lat: 35.6762, lng: 139.6503 },
  { label: '🇦🇺 Sydney, Australia', city: 'Sydney, Australia', lat: -33.8688, lng: 151.2093 },
  { label: '🇮🇳 Bengaluru, India', city: 'Bengaluru, India', lat: 12.9716, lng: 77.5946 },
  { label: '🇮🇳 Mumbai, India', city: 'Mumbai, India', lat: 19.0760, lng: 72.8777 },
  { label: '🇮🇳 Delhi, India', city: 'Delhi, India', lat: 28.6139, lng: 77.2090 },
  { label: '🇮🇳 Chennai Center', city: 'Mylapore, Chennai', lat: 13.0335, lng: 80.2715 },
];

export const GoogleMapView: React.FC<GoogleMapViewProps> = ({
  onOpenDossier,
  onShowToast,
  selectedZone = 'All Chennai',
  onZoneChange,
  initialNavSpot,
  onClearInitialNavSpot,
  customPins,
  onDeleteCustomPin,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const clustererRef = useRef<MarkerClusterer | null>(null);
  const markersRef = useRef<any[]>([]);
  const routePolylineRef = useRef<any>(null);

  // Live User GPS & Navigation Refs
  const userMarkerRef = useRef<any>(null);
  const accuracyCircleRef = useRef<any>(null);
  const navPolylineRef = useRef<any>(null);
  const globalPolylineRef = useRef<any>(null);
  const globalAirportMarkerRef = useRef<any>(null);

  const [mapLoaded, setMapLoaded] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const [mapTypeId, setMapTypeId] = useState<'roadmap' | 'satellite' | 'terrain'>('roadmap');

  // Real-time GPS Location Tracking State
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [userAccuracy, setUserAccuracy] = useState<number | null>(null);
  const [userHeading, setUserHeading] = useState<number | null>(null);
  const [userSpeed, setUserSpeed] = useState<number | null>(null);
  const [followUser, setFollowUser] = useState<boolean>(true);

  // Turn-by-Turn GPS Navigation State
  const [isNavigating, setIsNavigating] = useState<boolean>(false);
  const [navTargetSpot, setNavTargetSpot] = useState<UnifiedMapSpot | null>(null);
  const [navRouteResult, setNavRouteResult] = useState<{
    distanceText: string;
    durationText: string;
    steps: { instruction: string; distance: string; duration: string }[];
    totalDistanceMeters: number;
    totalDurationSeconds: number;
  } | null>(null);
  const [activeNavStepIdx, setActiveNavStepIdx] = useState<number>(0);
  const [navDistanceRemaining, setNavDistanceRemaining] = useState<string>('');
  const [hasArrived, setHasArrived] = useState<boolean>(false);
  const [isVoiceNavActive, setIsVoiceNavActive] = useState<boolean>(true);
  const [isGlobalExpedition, setIsGlobalExpedition] = useState<boolean>(false);
  const [globalOriginCity, setGlobalOriginCity] = useState<string>('Your Location');

  // Filter states
  const [corpusFilter, setCorpusFilter] = useState<'all' | 'heritage' | 'food' | 'architecture'>('all');
  const [currentZone, setCurrentZone] = useState<string>(selectedZone);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSpot, setSelectedSpot] = useState<UnifiedMapSpot | null>(null);
  // NEW: Open Now filter state - allows showing only open places
  const [onlyOpenNow, setOnlyOpenNow] = useState<boolean>(false);

  // Expedition & Directions Routing State
  const [expeditionMode, setExpeditionMode] = useState(false);
  const [travelMode, setTravelMode] = useState<'WALKING' | 'TRANSIT' | 'DRIVING'>('WALKING');
  const [expeditionWaypoints, setExpeditionWaypoints] = useState<UnifiedMapSpot[]>([]);
  const [routeResult, setRouteResult] = useState<{
    distanceText: string;
    durationText: string;
    steps: { instruction: string; distance: string; duration: string }[];
    totalDistanceMeters: number;
    totalDurationSeconds: number;
    calories: number;
    xpEarned: number;
  } | null>(null);
  const [isRouting, setIsRouting] = useState(false);
  const [isAudioNavigating, setIsAudioNavigating] = useState(false);
  const [currentNavStepIndex, setCurrentNavStepIndex] = useState(0);

  // Filter spots according to active filters and open/closed status
  const filteredSpots = useMemo(() => {
    return ALL_UNIFIED_MAP_SPOTS.filter((spot) => {
      // Open Now Filter: if toggled, only show places currently open
      if (onlyOpenNow) {
        const openStatus = evaluatePlaceOpenStatus(spot.openHours, spot.category);
        if (!openStatus.isOpen) return false;
      }

      // Corpus type filter
      if (corpusFilter !== 'all' && spot.type !== corpusFilter) return false;

      // Zone filter
      if (currentZone !== 'All Chennai' && spot.cluster !== currentZone && spot.neighborhood !== currentZone) {
        return false;
      }

      // Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = spot.name.toLowerCase().includes(q);
        const matchesSpecialty = spot.specialty?.toLowerCase().includes(q) || false;
        const matchesLore = spot.lore.toLowerCase().includes(q);
        const matchesCategory = spot.category.toLowerCase().includes(q);
        const matchesStyle = spot.architecturalStyle?.toLowerCase().includes(q) || false;
        if (!matchesName && !matchesSpecialty && !matchesLore && !matchesCategory && !matchesStyle) {
          return false;
        }
      }

      return true;
    });
  }, [corpusFilter, currentZone, searchQuery, onlyOpenNow]);

  // Load Google Maps JavaScript API via modern @googlemaps/js-api-loader with resilient fallback
  useEffect(() => {
    if (typeof window === 'undefined') return;
    let isCancelled = false;

    async function loadAndInitMap() {
      if (isCancelled || !mapContainerRef.current) return;

      const initMapInstance = async () => {
        if (!mapContainerRef.current) return false;
        try {
          const center = ZONE_CENTERS[currentZone] || { lat: 13.0674, lng: 80.2650, zoom: 12 };
          const { map } = await initKaosMap(mapContainerRef.current, { lat: center.lat, lng: center.lng }, center.zoom);

          (map as any).internalUsageAttributionIds = ['gmp_mcp_codeassist_v1_aistudio'];

          mapInstanceRef.current = map;
          setMapLoaded(true);
          setMapError(null);
          return true;
        } catch (e: any) {
          console.error('Error instantiating Map:', e);
          return false;
        }
      };

      // Case 1: Already loaded on window
      if (window.google?.maps?.Map) {
        if (await initMapInstance()) return;
      }

      // Case 2: Load via @googlemaps/js-api-loader
      try {
        try {
          setOptions({
            key: GOOGLE_MAPS_API_KEY,
            v: 'weekly',
            libraries: ['places', 'geometry'],
          });
        } catch {
          // Ignore setOptions error if options were already set previously
        }

        await importLibrary('maps');
        await importLibrary('marker');
        await importLibrary('routes');
        await importLibrary('geometry');
        await importLibrary('core');

        if (isCancelled) return;
        if (await initMapInstance()) return;
      } catch (err: any) {
        console.warn('Loader error, trying direct script fallback:', err);
      }

      // Case 3: Script tag fallback
      if (typeof window !== 'undefined' && !window.google?.maps?.Map) {
        const existingScript = document.getElementById('google-maps-direct-script');
        if (!existingScript) {
          const script = document.createElement('script');
          script.id = 'google-maps-direct-script';
          script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&libraries=places,geometry,marker,routes&v=weekly`;
          script.async = true;
          script.onload = async () => {
            if (!isCancelled) {
              if (!(await initMapInstance())) {
                setMapError('Google Maps loaded but constructor failed.');
              }
            }
          };
          script.onerror = () => {
            if (!isCancelled) {
              setMapError('Unable to load Google Maps script. Please check connection.');
            }
          };
          document.head.appendChild(script);
        } else {
          // Wait briefly for script load
          setTimeout(() => {
            if (!isCancelled && !initMapInstance()) {
              setMapError('Error initializing Google Map.');
            }
          }, 1000);
        }
      }
    }

    loadAndInitMap();

    return () => {
      isCancelled = true;
    };
  }, [currentZone]);

  // 1. Real-time GPS Geolocation Watcher
  useEffect(() => {
    if (!('geolocation' in navigator)) {
      setUserLocation({ lat: 13.0674, lng: 80.2650 });
      return;
    }

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setUserLocation(coords);
        setUserAccuracy(Math.round(pos.coords.accuracy));
        if (pos.coords.heading !== null && !isNaN(pos.coords.heading)) {
          setUserHeading(Math.round(pos.coords.heading));
        }
        if (pos.coords.speed !== null && !isNaN(pos.coords.speed)) {
          setUserSpeed(Math.max(1, Math.round(pos.coords.speed * 3.6))); // km/h
        }
      },
      (err) => {
        console.warn('Geolocation watch error:', err);
        if (!userLocation) {
          setUserLocation({ lat: 13.0674, lng: 80.2650 });
        }
      },
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 10000 }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  // 2. Real-time User Marker & Accuracy Circle on Google Map
  useEffect(() => {
    if (!mapInstanceRef.current || !mapLoaded || !window.google?.maps || !userLocation) return;

    const latLng = new window.google.maps.LatLng(userLocation.lat, userLocation.lng);

    if (!userMarkerRef.current) {
      // Create distinctive glowing cyan explorer marker with directional heading arrow
      const userMarker = new window.google.maps.Marker({
        position: latLng,
        map: mapInstanceRef.current,
        title: 'You (Real-time GPS)',
        zIndex: 9999,
        icon: {
          path: window.google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
          scale: 6.5,
          fillColor: '#06b6d4', // Vibrant Cyan
          fillOpacity: 1,
          strokeColor: '#ffffff',
          strokeWeight: 2.5,
          rotation: userHeading || 0,
        },
      });
      userMarkerRef.current = userMarker;

      const circle = new window.google.maps.Circle({
        map: mapInstanceRef.current,
        center: latLng,
        radius: userAccuracy || 20,
        fillColor: '#06b6d4',
        fillOpacity: 0.12,
        strokeColor: '#06b6d4',
        strokeOpacity: 0.4,
        strokeWeight: 1.5,
        zIndex: 9998,
      });
      accuracyCircleRef.current = circle;
    } else {
      userMarkerRef.current.setPosition(latLng);
      if (userHeading !== null) {
        userMarkerRef.current.setIcon({
          path: window.google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
          scale: 6.5,
          fillColor: '#06b6d4',
          fillOpacity: 1,
          strokeColor: '#ffffff',
          strokeWeight: 2.5,
          rotation: userHeading,
        });
      }
      if (accuracyCircleRef.current) {
        accuracyCircleRef.current.setCenter(latLng);
        accuracyCircleRef.current.setRadius(userAccuracy || 20);
      }
    }

    if (followUser && mapInstanceRef.current) {
      mapInstanceRef.current.panTo(latLng);
    }
  }, [userLocation, userHeading, userAccuracy, followUser, mapLoaded]);

  // 3. Voice Navigation Speech Function
  const speakNavInstruction = useCallback((text: string) => {
    if (!isVoiceNavActive || typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      window.speechSynthesis.speak(utterance);
    } catch {}
  }, [isVoiceNavActive]);

  // Gateway Hub: Chennai International Airport (MAA)
  const CHENNAI_AIRPORT_MAA = { lat: 12.9941, lng: 80.1709, name: 'Chennai International Airport (MAA)' };

  // Great-circle Haversine formula
  const computeGreatCircleDistanceKm = useCallback((lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371; // Earth radius in km
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }, []);

  // 4. Compute Live Turn-by-Turn Navigation Route from userLocation ANYWHERE in the world to targetSpot in Chennai
  const computeNavRoute = useCallback((originLoc: { lat: number; lng: number }, destination: UnifiedMapSpot) => {
    if (!window.google?.maps || !mapInstanceRef.current) return;

    // Clean up previous renderers
    if (navPolylineRef.current) {
      navPolylineRef.current.setMap(null);
      navPolylineRef.current = null;
    }
    if (globalPolylineRef.current) {
      globalPolylineRef.current.setMap(null);
      globalPolylineRef.current = null;
    }
    if (globalAirportMarkerRef.current) {
      globalAirportMarkerRef.current.setMap(null);
      globalAirportMarkerRef.current = null;
    }

    const distKm = computeGreatCircleDistanceKm(originLoc.lat, originLoc.lng, destination.lat, destination.lng);
    const directionsService = new window.google.maps.DirectionsService();

    // Helper: Local Route renderer using modern Polyline (migration from deprecated DirectionsRenderer)
    const renderLocalRoute = (result: any, dest: UnifiedMapSpot) => {
      setIsGlobalExpedition(false);
      if (navPolylineRef.current) {
        navPolylineRef.current.setMap(null);
        navPolylineRef.current = null;
      }

      // Draw high-visibility cyan path along exact route steps
      const polyline = new window.google.maps.Polyline({
        path: result.routes[0].overview_path,
        geodesic: true,
        strokeColor: '#06b6d4',
        strokeOpacity: 0.95,
        strokeWeight: 6,
        map: mapInstanceRef.current,
      });
      navPolylineRef.current = polyline;

      if (result.routes[0]?.bounds && mapInstanceRef.current) {
        mapInstanceRef.current.fitBounds(result.routes[0].bounds, { top: 60, bottom: 60, left: 40, right: 40 });
      }

      const leg = result.routes[0].legs[0];
      const steps = leg.steps.map((st: any) => ({
        instruction: st.instructions.replace(/<[^>]*>?/gm, ' '),
        distance: st.distance.text,
        duration: st.duration.text,
      }));

      setNavRouteResult({
        distanceText: leg.distance.text,
        durationText: leg.duration.text,
        steps,
        totalDistanceMeters: leg.distance.value,
        totalDurationSeconds: leg.duration.value,
      });

      setActiveNavStepIdx(0);
      if (steps.length > 0) {
        speakNavInstruction(`Navigating to ${dest.name}. In ${steps[0].distance}, ${steps[0].instruction}`);
      }
    };

    // Helper: Regional Drive Route renderer (40 km - 650 km)
    const renderRegionalDrive = (result: any, dest: UnifiedMapSpot, totalKm: number, orig: { lat: number; lng: number }) => {
      setIsGlobalExpedition(true);
      if (navPolylineRef.current) {
        navPolylineRef.current.setMap(null);
        navPolylineRef.current = null;
      }

      const polyline = new window.google.maps.Polyline({
        path: result.routes[0].overview_path,
        geodesic: true,
        strokeColor: '#f97316',
        strokeOpacity: 0.95,
        strokeWeight: 6,
        map: mapInstanceRef.current,
      });
      navPolylineRef.current = polyline;

      const leg = result.routes[0].legs[0];
      const steps = leg.steps.map((st: any) => ({
        instruction: st.instructions.replace(/<[^>]*>?/gm, ' '),
        distance: st.distance.text,
        duration: st.duration.text,
      }));

      steps.unshift({
        instruction: `Regional Highway Corridor: Depart towards Chennai via Inter-State Highway Corridor`,
        distance: `${Math.round(totalKm)} km`,
        duration: leg.duration.text,
      });

      setNavRouteResult({
        distanceText: `${Math.round(totalKm)} km`,
        durationText: leg.duration.text,
        steps,
        totalDistanceMeters: leg.distance.value,
        totalDurationSeconds: leg.duration.value,
      });

      if (result.routes[0]?.bounds && mapInstanceRef.current) {
        mapInstanceRef.current.fitBounds(result.routes[0].bounds, { top: 70, bottom: 70, left: 50, right: 50 });
      } else {
        const bounds = new window.google.maps.LatLngBounds();
        bounds.extend({ lat: orig.lat, lng: orig.lng });
        bounds.extend({ lat: dest.lat, lng: dest.lng });
        mapInstanceRef.current?.fitBounds(bounds, { top: 70, bottom: 70, left: 50, right: 50 });
      }

      setActiveNavStepIdx(0);
      speakNavInstruction(`Regional drive route mapped to ${dest.name} in Chennai. Total distance: ${Math.round(totalKm)} kilometers.`);
    };

    // Helper: Trans-Global Flight Corridor renderer (> 650 km or overseas)
    const renderGlobalFlight = (orig: { lat: number; lng: number }, dest: UnifiedMapSpot, totalKm: number) => {
      setIsGlobalExpedition(true);
      if (navPolylineRef.current) {
        navPolylineRef.current.setMap(null);
        navPolylineRef.current = null;
      }

      // 1. Draw glowing trans-global geodesic flight polyline connecting anywhere on Earth to Chennai Airport (MAA)
      const flightArc = new window.google.maps.Polyline({
        path: [
          { lat: orig.lat, lng: orig.lng },
          { lat: CHENNAI_AIRPORT_MAA.lat, lng: CHENNAI_AIRPORT_MAA.lng },
        ],
        geodesic: true,
        strokeColor: '#38bdf8', // Vibrant Sky Cyan
        strokeOpacity: 0.9,
        strokeWeight: 4,
        map: mapInstanceRef.current,
      });
      globalPolylineRef.current = flightArc;

      // 2. Gateway Airport Marker at Chennai International Airport (MAA)
      const airportMarker = new window.google.maps.Marker({
        position: { lat: CHENNAI_AIRPORT_MAA.lat, lng: CHENNAI_AIRPORT_MAA.lng },
        map: mapInstanceRef.current,
        title: 'Chennai International Airport (MAA Gateway)',
        icon: {
          path: window.google.maps.SymbolPath.CIRCLE,
          scale: 9,
          fillColor: '#f59e0b',
          fillOpacity: 1,
          strokeColor: '#ffffff',
          strokeWeight: 2.5,
        },
      });
      globalAirportMarkerRef.current = airportMarker;

      // 3. Calculate local route from MAA Airport to destination spot in Chennai
      directionsService.route(
        {
          origin: { lat: CHENNAI_AIRPORT_MAA.lat, lng: CHENNAI_AIRPORT_MAA.lng },
          destination: { lat: dest.lat, lng: dest.lng },
          travelMode: window.google.maps.TravelMode.DRIVING,
        },
        (maaRes: any, maaStatus: any) => {
          let localSteps: { instruction: string; distance: string; duration: string }[] = [];
          let localDistMeters = 15000;
          let localSecs = 1800;

          if (maaStatus === window.google.maps.DirectionsStatus.OK && maaRes) {
            const localPolyline = new window.google.maps.Polyline({
              path: maaRes.routes[0].overview_path,
              geodesic: true,
              strokeColor: '#06b6d4',
              strokeOpacity: 0.95,
              strokeWeight: 5,
              map: mapInstanceRef.current,
            });
            navPolylineRef.current = localPolyline;

            const leg = maaRes.routes[0].legs[0];
            localDistMeters = leg.distance.value;
            localSecs = leg.duration.value;
            localSteps = leg.steps.map((st: any) => ({
              instruction: st.instructions.replace(/<[^>]*>?/gm, ' '),
              distance: st.distance.text,
              duration: st.duration.text,
            }));
          }

          const estFlightHours = Math.round(totalKm / 800) + 1;
          const globalCombinedSteps = [
            {
              instruction: `🛫 Global Transit Leg 1: Flight corridor from your current world coordinates to Chennai International Airport (MAA)`,
              distance: `${Math.round(totalKm).toLocaleString()} km`,
              duration: `~${estFlightHours} hrs`,
            },
            {
              instruction: `🛬 Touch down at Chennai (MAA) • Connect via Chennai Metro Airport Blue Line / Taxi into ${dest.neighborhood}`,
              distance: 'Airport Gateway',
              duration: '30 mins',
            },
            ...localSteps,
            {
              instruction: `🏁 Arrive at ${dest.name} (${dest.category}) • Digital Passport Discovery Stamped!`,
              distance: 'Destination',
              duration: 'Final Stop',
            },
          ];

          setNavRouteResult({
            distanceText: `${Math.round(totalKm).toLocaleString()} km`,
            durationText: `${estFlightHours}h flight + ${Math.round(localSecs / 60)}m local`,
            steps: globalCombinedSteps,
            totalDistanceMeters: Math.round(totalKm * 1000) + localDistMeters,
            totalDurationSeconds: estFlightHours * 3600 + localSecs,
          });

          setActiveNavStepIdx(0);
          speakNavInstruction(`Global expedition initiated to ${dest.name} in Chennai. Total distance: ${Math.round(totalKm).toLocaleString()} kilometers.`);
        }
      );

      // Fit world map bounds to show origin anywhere on Earth and Chennai
      const worldBounds = new window.google.maps.LatLngBounds();
      worldBounds.extend({ lat: orig.lat, lng: orig.lng });
      worldBounds.extend({ lat: CHENNAI_AIRPORT_MAA.lat, lng: CHENNAI_AIRPORT_MAA.lng });
      worldBounds.extend({ lat: dest.lat, lng: dest.lng });
      mapInstanceRef.current?.fitBounds(worldBounds, { top: 60, bottom: 60, left: 40, right: 40 });
    };

    // ROUTING DISPATCH:
    // Case 1: Local Chennai (< 40 km)
    if (distKm <= 40) {
      directionsService.route(
        {
          origin: { lat: originLoc.lat, lng: originLoc.lng },
          destination: { lat: destination.lat, lng: destination.lng },
          travelMode: window.google.maps.TravelMode.WALKING,
        },
        (result: any, status: any) => {
          if (status === window.google.maps.DirectionsStatus.OK && result) {
            renderLocalRoute(result, destination);
          } else {
            directionsService.route(
              {
                origin: { lat: originLoc.lat, lng: originLoc.lng },
                destination: { lat: destination.lat, lng: destination.lng },
                travelMode: window.google.maps.TravelMode.DRIVING,
              },
              (driveRes: any, driveStatus: any) => {
                if (driveStatus === window.google.maps.DirectionsStatus.OK && driveRes) {
                  renderLocalRoute(driveRes, destination);
                } else {
                  renderGlobalFlight(originLoc, destination, distKm);
                }
              }
            );
          }
        }
      );
      return;
    }

    // Case 2: Regional Drive (40 km - 650 km)
    if (distKm > 40 && distKm <= 650) {
      directionsService.route(
        {
          origin: { lat: originLoc.lat, lng: originLoc.lng },
          destination: { lat: destination.lat, lng: destination.lng },
          travelMode: window.google.maps.TravelMode.DRIVING,
        },
        (result: any, status: any) => {
          if (status === window.google.maps.DirectionsStatus.OK && result) {
            renderRegionalDrive(result, destination, distKm, originLoc);
          } else {
            renderGlobalFlight(originLoc, destination, distKm);
          }
        }
      );
      return;
    }

    // Case 3: Trans-Global Expedition (> 650 km or international)
    renderGlobalFlight(originLoc, destination, distKm);
  }, [computeGreatCircleDistanceKm, speakNavInstruction]);

  // 5. Start Live Navigation to a Spot
  const handleStartLiveNavigation = useCallback((spot: UnifiedMapSpot) => {
    triggerHaptic('medium');
    setNavTargetSpot(spot);
    setIsNavigating(true);
    setFollowUser(true);
    setHasArrived(false);
    setSelectedSpot(spot);

    const origin = userLocation || { lat: 13.0674, lng: 80.2650 };
    computeNavRoute(origin, spot);

    onShowToast(`Live GPS Navigation started to ${spot.name}`, 'near_me');
  }, [userLocation, computeNavRoute, onShowToast]);

  // 6. Distance to Destination Monitoring & Arrival Detection
  useEffect(() => {
    if (!isNavigating || !navTargetSpot || !userLocation) return;

    const distKm = computeGreatCircleDistanceKm(
      userLocation.lat,
      userLocation.lng,
      navTargetSpot.lat,
      navTargetSpot.lng
    );

    const distFormatted = distKm < 1 ? `${Math.round(distKm * 1000)} m` : `${Math.round(distKm).toLocaleString()} km`;
    setNavDistanceRemaining(distFormatted);

    // Arrival within 25 meters (0.025 km)
    if (distKm <= 0.025 && !hasArrived) {
      setHasArrived(true);
      triggerHaptic([60, 100, 140, 200, 300]);
      onShowToast(`🎉 You have arrived at ${navTargetSpot.name}! Discovery Recorded (+${navTargetSpot.xp} XP)`, 'celebration');

      if (isVoiceNavActive && typeof window !== 'undefined' && 'speechSynthesis' in window) {
        try {
          window.speechSynthesis.cancel();
          const arrivalSpeech = new SpeechSynthesisUtterance(`You have arrived at your destination: ${navTargetSpot.name}. Fantastic exploration!`);
          window.speechSynthesis.speak(arrivalSpeech);
        } catch {}
      }
    }
  }, [userLocation, isNavigating, navTargetSpot, hasArrived, onShowToast, isVoiceNavActive, computeGreatCircleDistanceKm]);

  // 7. Stop Navigation
  const handleStopNavigation = () => {
    triggerHaptic('light');
    setIsNavigating(false);
    setNavTargetSpot(null);
    setNavRouteResult(null);
    setIsGlobalExpedition(false);

    if (navPolylineRef.current) {
      navPolylineRef.current.setMap(null);
      navPolylineRef.current = null;
    }
    if (globalPolylineRef.current) {
      globalPolylineRef.current.setMap(null);
      globalPolylineRef.current = null;
    }
    if (globalAirportMarkerRef.current) {
      globalAirportMarkerRef.current.setMap(null);
      globalAirportMarkerRef.current = null;
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    if (onClearInitialNavSpot) {
      onClearInitialNavSpot();
    }
    onShowToast('Navigation ended', 'navigation');
  };

  // 8. Auto-start navigation and play a cinematic map radar ripple if initialNavSpot prop is provided
  useEffect(() => {
    if (initialNavSpot && mapLoaded && window.google?.maps && mapInstanceRef.current) {
      // smooth pan and zoom
      mapInstanceRef.current.panTo({ lat: initialNavSpot.lat, lng: initialNavSpot.lng });
      mapInstanceRef.current.setZoom(14);
      
      // Draw a custom glowing radar ripple centered on the quest cluster spot
      const pulseCircle = new window.google.maps.Circle({
        map: mapInstanceRef.current,
        center: { lat: initialNavSpot.lat, lng: initialNavSpot.lng },
        radius: 100,
        fillColor: '#f97316', // Orange
        fillOpacity: 0.35,
        strokeColor: '#ea580c',
        strokeOpacity: 0.8,
        strokeWeight: 2.5,
        zIndex: 9999,
      });

      let radius = 100;
      let opacity = 0.35;
      const animationInterval = setInterval(() => {
        radius += 50;
        opacity -= 0.02;
        if (radius > 1000) {
          radius = 100;
          opacity = 0.35;
        }
        pulseCircle.setRadius(radius);
        pulseCircle.setOptions({
          fillOpacity: Math.max(0, opacity),
          strokeOpacity: Math.max(0, opacity * 2),
        });
      }, 50);

      // Clean up pulse after 3 seconds
      const timeout = setTimeout(() => {
        clearInterval(animationInterval);
        pulseCircle.setMap(null);
      }, 3000);

      handleStartLiveNavigation(initialNavSpot);

      return () => {
        clearInterval(animationInterval);
        clearTimeout(timeout);
        pulseCircle.setMap(null);
      };
    }
  }, [initialNavSpot, mapLoaded, handleStartLiveNavigation]);

  // 9. Teleport Location Globally (to test and navigate from anywhere in the world)
  const handleTeleportLocation = (preset: { label: string; city: string; lat: number; lng: number }) => {
    triggerHaptic('medium');
    setGlobalOriginCity(preset.city);

    if (preset.lat === 0 && preset.lng === 0) {
      // Revert to real device GPS
      if ('geolocation' in navigator) {
        navigator.geolocation.getCurrentPosition((pos) => {
          const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          setUserLocation(loc);
          if (isNavigating && navTargetSpot) {
            computeNavRoute(loc, navTargetSpot);
          }
          onShowToast('Locked back to Real Device GPS', 'gps_fixed');
        });
      }
      return;
    }

    const newLoc = { lat: preset.lat, lng: preset.lng };
    setUserLocation(newLoc);
    setUserSpeed(850); // Flight cruise speed in km/h

    if (isNavigating && navTargetSpot) {
      computeNavRoute(newLoc, navTargetSpot);
    } else {
      mapInstanceRef.current?.panTo(newLoc);
      mapInstanceRef.current?.setZoom(5);
    }

    onShowToast(`Location set to ${preset.city} 🌍`, 'public');
  };

  // 10. Simulate User Step along the route (for browser testing without physical walking)
  const handleSimulateStep = () => {
    if (!userLocation || !navTargetSpot) return;
    triggerHaptic('light');
    const stepLat = userLocation.lat + (navTargetSpot.lat - userLocation.lat) * 0.15;
    const stepLng = userLocation.lng + (navTargetSpot.lng - userLocation.lng) * 0.15;
    const newPos = { lat: stepLat, lng: stepLng };
    setUserLocation(newPos);
    setUserSpeed(4.8);
    onShowToast('Simulated moving closer along route 🚶‍♂️', 'directions_walk');
  };

  // Update Markers with Marker Clustering
  const renderMarkers = useCallback(() => {
    if (!mapInstanceRef.current || !mapLoaded || !window.google?.maps) return;

    // Clear previous clusterer and markers
    if (clustererRef.current) {
      clustererRef.current.clearMarkers();
    }
    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current = [];

    const bounds = new window.google.maps.LatLngBounds();
    let hasValidPoints = false;

    const pinMarkers = filteredSpots.map((spot) => {
      const isSelected = selectedSpot?.id === spot.id;
      const isWaypoint = expeditionWaypoints.some((w) => w.id === spot.id);
      const waypointIndex = expeditionWaypoints.findIndex((w) => w.id === spot.id);

      // Distinct pin colors per category
      let pinColor = '#3b82f6';
      if (spot.type === 'heritage') {
        pinColor = '#f97316'; // Orange
      } else if (spot.type === 'food') {
        pinColor = '#eab308'; // Amber gold
      } else if (spot.type === 'architecture') {
        pinColor = '#ec4899'; // Rose crimson
      }

      if (isWaypoint) {
        pinColor = '#10b981'; // Emerald green
      } else if (isSelected) {
        pinColor = '#ff4500';
      }

      // High-resolution SVG pin marker
      const svgMarker = {
        path: 'M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z',
        fillColor: pinColor,
        fillOpacity: 1,
        strokeWeight: 1.5,
        strokeColor: '#ffffff',
        scale: isSelected || isWaypoint ? 1.8 : 1.3,
        anchor: new window.google.maps.Point(12, 22),
      };

      const marker = new window.google.maps.Marker({
        position: { lat: spot.lat, lng: spot.lng },
        title: `${spot.name} (${spot.category})`,
        icon: svgMarker,
        animation: isSelected ? window.google.maps.Animation.BOUNCE : undefined,
      });

      marker.addListener('click', () => {
        triggerHaptic('medium');
        setSelectedSpot(spot);
        mapInstanceRef.current?.panTo({ lat: spot.lat, lng: spot.lng });
        onShowToast(`Selected: ${spot.name}`, 'location_on');
      });

      bounds.extend({ lat: spot.lat, lng: spot.lng });
      hasValidPoints = true;
      return marker;
    });

    const customPinMarkers = (customPins || []).map((pin: SavedLocationPin) => {
      const svgMarker = {
        path: 'M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z',
        fillColor: '#8b5cf6', // Violet for custom pins
        fillOpacity: 1,
        strokeWeight: 2,
        strokeColor: '#ffffff',
        scale: 1.5,
        anchor: new window.google.maps.Point(12, 22),
      };

      const marker = new window.google.maps.Marker({
        position: { lat: pin.lat, lng: pin.lng },
        title: `Custom Pin: ${pin.note}`,
        icon: svgMarker,
      });

      marker.addListener('click', () => {
        triggerHaptic('medium');
        onShowToast(`Custom Pin: ${pin.note}`, 'push_pin');
        mapInstanceRef.current?.panTo({ lat: pin.lat, lng: pin.lng });
      });

      bounds.extend({ lat: pin.lat, lng: pin.lng });
      hasValidPoints = true;
      return marker;
    });

    const newMarkers = [...pinMarkers, ...customPinMarkers];
    markersRef.current = newMarkers;

    // Custom MarkerClusterer styling
    clustererRef.current = new MarkerClusterer({
      map: mapInstanceRef.current,
      markers: newMarkers,
    });

    if (hasValidPoints && filteredSpots.length > 0 && !selectedSpot && expeditionWaypoints.length === 0 && (customPins || []).length === 0) {
      if (currentZone === 'All Chennai') {
        mapInstanceRef.current.setCenter({ lat: 13.0674, lng: 80.2650 });
        mapInstanceRef.current.setZoom(12);
      } else {
        mapInstanceRef.current.fitBounds(bounds, { top: 50, bottom: 50, left: 50, right: 50 });
      }
    }
  }, [filteredSpots, selectedSpot, expeditionWaypoints, currentZone, mapLoaded, onShowToast, customPins]);

  useEffect(() => {
    renderMarkers();
  }, [renderMarkers]);

  // Compute Google Maps Directions between active Expedition Waypoints
  const computeExpeditionRoute = useCallback(() => {
    if (!window.google?.maps || !mapInstanceRef.current) return;
    if (expeditionWaypoints.length < 2) {
      // Clear route polyline if less than 2 waypoints
      if (routePolylineRef.current) {
        routePolylineRef.current.setMap(null);
        routePolylineRef.current = null;
      }
      setRouteResult(null);
      return;
    }

    setIsRouting(true);
    const origin = expeditionWaypoints[0];
    const destination = expeditionWaypoints[expeditionWaypoints.length - 1];
    const intermediates = expeditionWaypoints.slice(1, -1).map((wp) => ({
      location: { lat: wp.lat, lng: wp.lng },
      stopover: true,
    }));

    try {
      if (!window.google?.maps?.DirectionsService) {
        throw new Error('DirectionsService not available');
      }

      const directionsService = new window.google.maps.DirectionsService();

      let gTravelMode = window.google.maps.TravelMode.WALKING;
      if (travelMode === 'TRANSIT') gTravelMode = window.google.maps.TravelMode.TRANSIT;
      if (travelMode === 'DRIVING') gTravelMode = window.google.maps.TravelMode.DRIVING;

      directionsService.route(
        {
          origin: { lat: origin.lat, lng: origin.lng },
          destination: { lat: destination.lat, lng: destination.lng },
          waypoints: intermediates,
          travelMode: gTravelMode,
          optimizeWaypoints: false,
        },
        (result: any, status: any) => {
          setIsRouting(false);

          if (status === window.google.maps.DirectionsStatus.OK && result) {
            // Modern Polyline rendering without deprecated DirectionsRenderer
            if (routePolylineRef.current) {
              routePolylineRef.current.setMap(null);
              routePolylineRef.current = null;
            }

            const polyline = new window.google.maps.Polyline({
              path: result.routes[0].overview_path,
              geodesic: true,
              strokeColor: '#f97316',
              strokeOpacity: 0.95,
              strokeWeight: 6,
              map: mapInstanceRef.current,
            });
            routePolylineRef.current = polyline;

            if (result.routes[0]?.bounds && mapInstanceRef.current) {
              mapInstanceRef.current.fitBounds(result.routes[0].bounds, { top: 60, bottom: 60, left: 50, right: 50 });
            }

            // Parse route steps, total distance, duration
            const legs = result.routes[0].legs;
            let totalDistMeters = 0;
            let totalSecs = 0;
            const allSteps: { instruction: string; distance: string; duration: string }[] = [];

            legs.forEach((leg: any) => {
              totalDistMeters += leg.distance.value;
              totalSecs += leg.duration.value;
              leg.steps.forEach((step: any) => {
                const cleanText = step.instructions.replace(/<[^>]*>?/gm, ' ');
                allSteps.push({
                  instruction: cleanText,
                  distance: step.distance.text,
                  duration: step.duration.text,
                });
              });
            });

            const distKm = (totalDistMeters / 1000).toFixed(1);
            const durMins = Math.round(totalSecs / 60);
            const caloriesBurned = Math.round((totalDistMeters / 1000) * 58);
            const xp = Math.round(totalDistMeters / 10) + expeditionWaypoints.length * 80;

            setRouteResult({
              distanceText: `${distKm} km`,
              durationText: durMins >= 60 ? `${Math.floor(durMins / 60)}h ${durMins % 60}m` : `${durMins} mins`,
              steps: allSteps,
              totalDistanceMeters: totalDistMeters,
              totalDurationSeconds: totalSecs,
              calories: caloriesBurned,
              xpEarned: xp,
            });

            triggerHaptic('medium');
            onShowToast(`Expedition Route: ${distKm} km (${durMins}m)`, 'directions_walk');
          } else {
            drawFallbackPolyline();
          }
        }
      );
    } catch (err) {
      setIsRouting(false);
      drawFallbackPolyline();
    }

    function drawFallbackPolyline() {
      if (routePolylineRef.current) {
        routePolylineRef.current.setMap(null);
        routePolylineRef.current = null;
      }
      const polyline = new window.google.maps.Polyline({
        path: expeditionWaypoints.map((w) => ({ lat: w.lat, lng: w.lng })),
        geodesic: true,
        strokeColor: '#f97316',
        strokeOpacity: 0.9,
        strokeWeight: 5,
        map: mapInstanceRef.current,
      });
      routePolylineRef.current = polyline;

      let approxDist = 0;
      for (let i = 0; i < expeditionWaypoints.length - 1; i++) {
        const p1 = expeditionWaypoints[i];
        const p2 = expeditionWaypoints[i + 1];
        const d = Math.hypot((p2.lat - p1.lat) * 111000, (p2.lng - p1.lng) * 111000 * Math.cos((p1.lat * Math.PI) / 180));
        approxDist += d;
      }
      const distKm = (approxDist / 1000).toFixed(1);
      const durMins = Math.max(8, Math.round((approxDist / 1000) * 14));
      setRouteResult({
        distanceText: `${distKm} km`,
        durationText: durMins >= 60 ? `${Math.floor(durMins / 60)}h ${durMins % 60}m` : `${durMins} mins`,
        steps: expeditionWaypoints.map((w, idx) => ({
          instruction: idx === 0 ? `Depart from ${w.name}` : `Proceed to Stop #${idx + 1}: ${w.name}`,
          distance: idx === 0 ? 'Origin' : `${(approxDist / Math.max(1, expeditionWaypoints.length - 1) / 1000).toFixed(1)} km`,
          duration: `${Math.round(durMins / Math.max(1, expeditionWaypoints.length - 1))} mins`,
        })),
        totalDistanceMeters: Math.round(approxDist),
        totalDurationSeconds: durMins * 60,
        calories: Math.round((approxDist / 1000) * 58),
        xpEarned: Math.round(approxDist / 10) + expeditionWaypoints.length * 80,
      });

      triggerHaptic('light');
      onShowToast(`Expedition Pathway mapped: ${distKm} km`, 'timeline');
    }
  }, [expeditionWaypoints, travelMode, onShowToast]);

  // Re-calculate route when waypoints or travel mode change
  useEffect(() => {
    if (expeditionWaypoints.length >= 2) {
      computeExpeditionRoute();
    } else {
      if (routePolylineRef.current) {
        routePolylineRef.current.setMap(null);
        routePolylineRef.current = null;
      }
      setRouteResult(null);
    }
  }, [expeditionWaypoints, travelMode, computeExpeditionRoute]);

  // Load a curated expedition preset
  const handleLoadPreset = (preset: CuratedExpeditionPreset) => {
    triggerHaptic('medium');
    const matchedSpots: UnifiedMapSpot[] = [];
    preset.spotIds.forEach((id) => {
      const found = ALL_UNIFIED_MAP_SPOTS.find((s) => s.id === id);
      if (found) matchedSpots.push(found);
    });

    if (matchedSpots.length >= 2) {
      setTravelMode(preset.travelMode);
      setExpeditionWaypoints(matchedSpots);
      setExpeditionMode(true);
      setSelectedSpot(matchedSpots[0]);
      onShowToast(`Loaded preset: ${preset.title}`, 'explore');
    }
  };

  // Add a spot to Expedition Waypoints
  const handleAddWaypoint = (spot: UnifiedMapSpot) => {
    triggerHaptic('light');
    if (expeditionWaypoints.some((w) => w.id === spot.id)) {
      onShowToast(`${spot.name} is already in the expedition`, 'info');
      return;
    }
    setExpeditionWaypoints((prev) => [...prev, spot]);
    setExpeditionMode(true);
    onShowToast(`Added Stop #${expeditionWaypoints.length + 1}: ${spot.name}`, 'add_location');
  };

  // Remove a waypoint
  const handleRemoveWaypoint = (spotId: string) => {
    triggerHaptic('light');
    setExpeditionWaypoints((prev) => prev.filter((w) => w.id !== spotId));
    onShowToast('Waypoint removed', 'delete');
  };

  // Web Speech API Voice Guidance for turn-by-turn navigation
  const speakCurrentNavStep = (stepText: string) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      onShowToast('Voice guidance not supported in this browser', 'volume_off');
      return;
    }

    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(stepText);
      utterance.rate = 1.0;
      utterance.pitch = 1.0;

      utterance.onstart = () => {
        setIsAudioNavigating(true);
        soundscapeEngine.playSoundscape(selectedSpot?.soundscapeType || 'temple-chimes', 0.25);
        triggerHaptic('light');
      };

      utterance.onend = () => {
        setIsAudioNavigating(false);
        soundscapeEngine.stop();
      };

      utterance.onerror = () => {
        setIsAudioNavigating(false);
        soundscapeEngine.stop();
      };

      window.speechSynthesis.speak(utterance);
    } catch {
      setIsAudioNavigating(false);
    }
  };

  const handleNextStep = () => {
    if (!routeResult || routeResult.steps.length === 0) return;
    const nextIdx = (currentNavStepIndex + 1) % routeResult.steps.length;
    setCurrentNavStepIndex(nextIdx);
    const step = routeResult.steps[nextIdx];
    speakCurrentNavStep(`Step ${nextIdx + 1}: ${step.instruction} for ${step.distance}`);
    triggerHaptic('light');
  };

  const handleToggleMapType = (type: 'roadmap' | 'satellite' | 'terrain') => {
    setMapTypeId(type);
    if (mapInstanceRef.current) {
      mapInstanceRef.current.setMapTypeId(type);
      if (type === 'roadmap') {
        mapInstanceRef.current.setOptions({ styles: darkMapStyle });
      } else {
        mapInstanceRef.current.setOptions({ styles: [] });
      }
    }
    triggerHaptic('light');
  };

  const handleRecenter = () => {
    if (!mapInstanceRef.current) return;
    const target = ZONE_CENTERS[currentZone] || { lat: 13.0674, lng: 80.2650, zoom: 12 };
    mapInstanceRef.current.panTo({ lat: target.lat, lng: target.lng });
    mapInstanceRef.current.setZoom(target.zoom);
    triggerHaptic('light');
    onShowToast(`Recentered on ${currentZone}`, 'my_location');
  };

  return (
    <div className="flex flex-col w-full space-y-4">
      {/* Corpus & Category Selector Ribbon */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
        {/* Layer Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
          <button
            onClick={() => {
              setCorpusFilter('all');
              triggerHaptic('light');
            }}
            className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all shrink-0 cursor-pointer flex items-center gap-1 ${
              corpusFilter === 'all'
                ? 'bg-orange-600 text-white shadow-md'
                : 'bg-[#1a1a1e] text-[#9898a0] hover:bg-[#26262b] border border-[#26262b]'
            }`}
          >
            <span className="material-symbols-outlined text-[15px]">scatter_plot</span>
            <span>All 600+ Spots</span>
          </button>

          <button
            onClick={() => {
              setCorpusFilter('heritage');
              triggerHaptic('light');
            }}
            className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all shrink-0 cursor-pointer flex items-center gap-1 ${
              corpusFilter === 'heritage'
                ? 'bg-amber-600 text-white shadow-md'
                : 'bg-[#1a1a1e] text-[#9898a0] hover:bg-[#26262b] border border-[#26262b]'
            }`}
          >
            <span className="material-symbols-outlined text-[15px]">fort</span>
            <span>Heritage (300)</span>
          </button>

          <button
            onClick={() => {
              setCorpusFilter('food');
              triggerHaptic('light');
            }}
            className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all shrink-0 cursor-pointer flex items-center gap-1 ${
              corpusFilter === 'food'
                ? 'bg-yellow-600 text-white shadow-md'
                : 'bg-[#1a1a1e] text-[#9898a0] hover:bg-[#26262b] border border-[#26262b]'
            }`}
          >
            <span className="material-symbols-outlined text-[15px]">restaurant</span>
            <span>Food Gems (300)</span>
          </button>

          <button
            onClick={() => {
              setCorpusFilter('architecture');
              triggerHaptic('light');
            }}
            className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all shrink-0 cursor-pointer flex items-center gap-1 ${
              corpusFilter === 'architecture'
                ? 'bg-pink-600 text-white shadow-md'
                : 'bg-[#1a1a1e] text-[#9898a0] hover:bg-[#26262b] border border-[#26262b]'
            }`}
          >
            <span className="material-symbols-outlined text-[15px]">domain</span>
            <span>Architecture</span>
          </button>

          {/* NEW: Open Now Filter Toggle Button */}
          <button
            onClick={() => {
              setOnlyOpenNow(!onlyOpenNow);
              triggerHaptic('light');
              onShowToast(!onlyOpenNow ? 'Showing ONLY currently Open spots 🟢' : 'Showing all spots', 'schedule');
            }}
            className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all shrink-0 cursor-pointer flex items-center gap-1.5 border ${
              onlyOpenNow
                ? 'bg-emerald-600/30 border-emerald-500 text-emerald-300 shadow-md ring-1 ring-emerald-500/50'
                : 'bg-[#1a1a1e] text-[#9898a0] hover:text-white border-[#26262b]'
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${onlyOpenNow ? 'bg-emerald-400 animate-ping' : 'bg-emerald-500/60'}`}></span>
            <span>{onlyOpenNow ? 'Open Now (Active)' : 'Filter: Open Now'}</span>
          </button>
        </div>

        {/* Zone Selector Dropdown */}
        <div className="relative shrink-0">
          <select
            value={currentZone}
            onChange={(e) => {
              const val = e.target.value;
              setCurrentZone(val);
              if (onZoneChange) onZoneChange(val);
              const center = ZONE_CENTERS[val];
              if (center && mapInstanceRef.current) {
                mapInstanceRef.current.panTo({ lat: center.lat, lng: center.lng });
                mapInstanceRef.current.setZoom(center.zoom);
              }
              triggerHaptic('light');
            }}
            className="w-full sm:w-auto bg-[#1a1a1e] text-white border border-[#32323a] text-xs font-semibold px-3 py-1.5 rounded-xl appearance-none pr-8 cursor-pointer focus:outline-none focus:border-orange-500"
          >
            {Object.keys(ZONE_CENTERS).map((zone) => (
              <option key={zone} value={zone} className="bg-[#1a1a1e]">
                {zone}
              </option>
            ))}
          </select>
          <span className="material-symbols-outlined text-[#9898a0] text-[16px] absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none">
            expand_more
          </span>
        </div>
      </div>

      {/* Search Input Bar */}
      <div className="relative w-full">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search 600+ Chennai places, dishes, temples, street names..."
          className="w-full bg-[#18181c] border border-[#2c2c34] focus:border-orange-500 rounded-2xl px-4 py-2.5 pl-10 text-xs text-white placeholder:text-[#71717a] outline-none shadow-inner transition-all"
        />
        <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#71717a] text-[18px]">
          search
        </span>
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-[#71717a] hover:text-white text-xs"
          >
            ✕
          </button>
        )}
      </div>

      {/* MAIN INTERACTIVE GOOGLE MAP CANVAS */}
      <div className="relative w-full h-[400px] sm:h-[480px] rounded-3xl overflow-hidden border border-orange-500/40 shadow-2xl bg-[#141418]">
        <div ref={mapContainerRef} className="w-full h-full" />

        {/* Loading Spinner */}
        {!mapLoaded && !mapError && (
          <div className="absolute inset-0 bg-[#141418] flex flex-col items-center justify-center gap-3 z-10">
            <div className="w-10 h-10 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
            <span className="text-xs text-orange-400 font-bold uppercase tracking-widest font-mono">
              Initializing Google Maps Expedition Radar...
            </span>
          </div>
        )}

        {/* Error overlay with Retry Button */}
        {mapError && (
          <div className="absolute inset-0 bg-[#141418] flex flex-col items-center justify-center p-6 text-center z-10 gap-3">
            <span className="material-symbols-outlined text-red-400 text-3xl">map_off</span>
            <p className="text-xs text-red-300 font-medium max-w-xs">{mapError}</p>
            <button
              onClick={() => {
                setMapError(null);
                setMapLoaded(false);
                // Trigger re-mount initialization
                window.location.reload();
              }}
              className="px-4 py-2 rounded-xl bg-orange-600 hover:bg-orange-500 text-white text-xs font-bold shadow-lg transition-all active:scale-95 cursor-pointer flex items-center gap-1.5"
            >
              <span className="material-symbols-outlined text-[16px]">refresh</span>
              <span>Reload Map Engine</span>
            </button>
          </div>
        )}

        {/* Top-Right Floating Controls (Dark/Satellite, Follow Me GPS, Recenter, Expedition Mode) */}
        <div className="absolute top-3 right-3 z-20 flex flex-col gap-1.5 bg-[#18181c]/90 backdrop-blur-md p-1.5 rounded-2xl border border-zinc-700/60 shadow-xl">
          <button
            onClick={() => handleToggleMapType('roadmap')}
            title="Dark Theme Vector"
            className={`p-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center ${
              mapTypeId === 'roadmap' ? 'bg-orange-600 text-white shadow' : 'text-zinc-400 hover:text-white'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">map</span>
          </button>

          <button
            onClick={() => handleToggleMapType('satellite')}
            title="Satellite Aerial"
            className={`p-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center ${
              mapTypeId === 'satellite' ? 'bg-orange-600 text-white shadow' : 'text-zinc-400 hover:text-white'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">satellite_alt</span>
          </button>

          {/* Follow Me GPS Toggle */}
          <button
            onClick={() => {
              const nextState = !followUser;
              setFollowUser(nextState);
              if (nextState && userLocation && mapInstanceRef.current) {
                mapInstanceRef.current.panTo(userLocation);
                mapInstanceRef.current.setZoom(16);
              }
              triggerHaptic('light');
              onShowToast(nextState ? 'GPS Centered on You' : 'Free Camera View', 'my_location');
            }}
            title="Follow My Location (GPS)"
            className={`p-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center ${
              followUser ? 'bg-cyan-600 text-white shadow ring-2 ring-cyan-400/50' : 'text-zinc-400 hover:text-cyan-400'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">near_me</span>
          </button>

          <button
            onClick={handleRecenter}
            title="Recenter Map"
            className="p-2 rounded-xl text-xs font-bold text-zinc-400 hover:text-orange-400 transition-all flex items-center justify-center"
          >
            <span className="material-symbols-outlined text-[18px]">my_location</span>
          </button>

          <button
            onClick={() => {
              setExpeditionMode(!expeditionMode);
              triggerHaptic('medium');
            }}
            title="Toggle Expedition Mode"
            className={`p-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center ${
              expeditionMode ? 'bg-emerald-600 text-white shadow' : 'text-zinc-400 hover:text-emerald-400'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">route</span>
          </button>
        </div>

        {/* Top-Left Spots Counter & GPS Triangulation Badges */}
        <div className="absolute top-3 left-3 z-20 flex flex-col items-start gap-1.5 pointer-events-none">
          <div className="bg-[#18181c]/90 backdrop-blur-md px-3 py-1.5 rounded-full border border-orange-500/30 text-[11px] font-bold text-orange-400 flex items-center gap-1.5 shadow-lg">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>{filteredSpots.length} Points {onlyOpenNow ? '(Open)' : 'Active'}</span>
          </div>

          {userLocation && (
            <div className="bg-[#18181c]/90 backdrop-blur-md px-2.5 py-1 rounded-full border border-cyan-500/40 text-[10px] font-bold text-cyan-300 flex items-center gap-1.5 shadow-lg">
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping"></span>
              <span>Live GPS {userAccuracy ? `±${userAccuracy}m` : 'Active'}</span>
            </div>
          )}
        </div>

        {/* Real-Time Turn-by-Turn Navigation HUD Overlay */}
        {isNavigating && navTargetSpot && (
          <div className="absolute top-3 left-3 right-16 z-30 bg-[#121214]/95 backdrop-blur-xl rounded-2xl p-3 border-2 border-cyan-500/60 shadow-2xl flex flex-col gap-2 animate-in fade-in slide-in-from-top-3 duration-200">
            {/* Global Expedition Header Banner */}
            {isGlobalExpedition && (
              <div className="flex items-center justify-between pb-1.5 border-b border-zinc-800/80 flex-wrap gap-1">
                <span className="text-[10px] text-cyan-300 font-bold flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[14px] text-amber-400 animate-pulse">flight_takeoff</span>
                  <span>Global Corridor: {globalOriginCity} ➔ Chennai, India</span>
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => {
                      if (!mapInstanceRef.current || !userLocation) return;
                      const worldBounds = new window.google.maps.LatLngBounds();
                      worldBounds.extend(userLocation);
                      worldBounds.extend(CHENNAI_AIRPORT_MAA);
                      worldBounds.extend(navTargetSpot);
                      mapInstanceRef.current.fitBounds(worldBounds, { top: 60, bottom: 60, left: 40, right: 40 });
                      triggerHaptic('light');
                    }}
                    className="px-2 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-[9px] text-cyan-300 font-semibold cursor-pointer"
                    title="View Entire Global Flight Corridor"
                  >
                    🌍 World View
                  </button>
                  <button
                    onClick={() => {
                      if (!mapInstanceRef.current) return;
                      mapInstanceRef.current.panTo({ lat: navTargetSpot.lat, lng: navTargetSpot.lng });
                      mapInstanceRef.current.setZoom(16);
                      triggerHaptic('light');
                    }}
                    className="px-2 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-[9px] text-amber-300 font-semibold cursor-pointer"
                    title="Zoom to Destination in Chennai"
                  >
                    🏛️ Chennai
                  </button>
                </div>
              </div>
            )}

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center border border-cyan-500/40 shrink-0">
                  <span className="material-symbols-outlined text-[24px]">
                    {isGlobalExpedition ? 'flight' : 'turn_sharp_right'}
                  </span>
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-cyan-400 font-bold uppercase tracking-wider truncate">
                      To {navTargetSpot.name}
                    </span>
                    <span className="text-zinc-600">•</span>
                    <span className="text-[10px] text-emerald-400 font-mono font-bold shrink-0">
                      {navDistanceRemaining || navRouteResult?.distanceText || 'Tracking...'}
                    </span>
                  </div>
                  <p className="text-xs text-white font-semibold line-clamp-1">
                    {navRouteResult?.steps[activeNavStepIdx]?.instruction || 'Follow highlighted trail'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                {/* Step forward/back controls */}
                {navRouteResult && navRouteResult.steps.length > 1 && (
                  <div className="flex items-center bg-zinc-800 rounded-lg p-0.5 border border-zinc-700">
                    <button
                      onClick={() => {
                        const prev = Math.max(0, activeNavStepIdx - 1);
                        setActiveNavStepIdx(prev);
                        speakNavInstruction(navRouteResult.steps[prev].instruction);
                        triggerHaptic('light');
                      }}
                      disabled={activeNavStepIdx === 0}
                      className="p-1 rounded text-zinc-400 hover:text-white disabled:opacity-30 cursor-pointer"
                      title="Previous Step"
                    >
                      <span className="material-symbols-outlined text-[16px]">chevron_left</span>
                    </button>
                    <span className="text-[9px] font-mono px-1 text-zinc-300">
                      {activeNavStepIdx + 1}/{navRouteResult.steps.length}
                    </span>
                    <button
                      onClick={() => {
                        const next = Math.min(navRouteResult.steps.length - 1, activeNavStepIdx + 1);
                        setActiveNavStepIdx(next);
                        speakNavInstruction(navRouteResult.steps[next].instruction);
                        triggerHaptic('light');
                      }}
                      disabled={activeNavStepIdx === navRouteResult.steps.length - 1}
                      className="p-1 rounded text-zinc-400 hover:text-white disabled:opacity-30 cursor-pointer"
                      title="Next Step"
                    >
                      <span className="material-symbols-outlined text-[16px]">chevron_right</span>
                    </button>
                  </div>
                )}

                <button
                  onClick={() => setIsVoiceNavActive(!isVoiceNavActive)}
                  className={`p-1.5 rounded-lg text-xs transition-all ${
                    isVoiceNavActive ? 'text-cyan-400 bg-cyan-500/10' : 'text-zinc-500'
                  }`}
                  title="Toggle Voice Guidance"
                >
                  <span className="material-symbols-outlined text-[18px]">
                    {isVoiceNavActive ? 'volume_up' : 'volume_off'}
                  </span>
                </button>

                <button
                  onClick={handleStopNavigation}
                  className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white transition-all cursor-pointer"
                  title="End Navigation"
                >
                  <span className="material-symbols-outlined text-[18px]">close</span>
                </button>
              </div>
            </div>

            {/* Sub-bar with global origin selector & simulation button */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-1.5 pt-1 border-t border-zinc-800 text-[10px] text-zinc-400">
              <div className="flex items-center gap-2">
                <span className="text-cyan-300 font-mono">Speed: {userSpeed || 4} km/h</span>
                {hasArrived && (
                  <span className="px-2 py-0.5 rounded-full bg-emerald-500 text-black font-bold animate-bounce">
                    🎯 Destination Reached!
                  </span>
                )}
              </div>

              <div className="flex items-center gap-1.5">
                {/* Global GPS Location Teleporter */}
                <select
                  onChange={(e) => {
                    const preset = GLOBAL_EXPLORER_PRESETS.find((p) => p.city === e.target.value);
                    if (preset) handleTeleportLocation(preset);
                  }}
                  value={globalOriginCity}
                  className="bg-zinc-800 text-cyan-300 border border-zinc-700 rounded-lg px-2 py-1 text-[10px] font-semibold cursor-pointer outline-none focus:border-cyan-500"
                  title="Track GPS from Anywhere in the World"
                >
                  {GLOBAL_EXPLORER_PRESETS.map((p) => (
                    <option key={p.city} value={p.city}>
                      {p.label}
                    </option>
                  ))}
                </select>

                <button
                  onClick={handleSimulateStep}
                  className="px-2 py-1 rounded-lg bg-cyan-600/20 hover:bg-cyan-600/40 text-cyan-300 font-bold border border-cyan-500/30 transition-all flex items-center gap-1 active:scale-95 cursor-pointer shrink-0"
                >
                  <span className="material-symbols-outlined text-[13px]">directions_walk</span>
                  <span>Step (+35m)</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Selected Place Card Floating on Bottom of Map */}
        {selectedSpot && !expeditionMode && (
          <div className="absolute bottom-3 left-3 right-3 z-20 bg-[#1a1a1e]/95 backdrop-blur-md rounded-2xl p-3.5 border border-orange-500/50 shadow-2xl flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 animate-in fade-in slide-in-from-bottom-2 duration-200">
            {(() => {
              const openStatus = evaluatePlaceOpenStatus(selectedSpot.openHours, selectedSpot.category);
              return (
                <div className="flex items-center gap-3 min-w-0">
                  <img
                    src={selectedSpot.imageUrl}
                    alt={selectedSpot.name}
                    className="w-14 h-14 rounded-xl object-cover border border-orange-500/30 shrink-0"
                  />
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[10px] text-orange-400 font-bold uppercase tracking-wider">
                        {selectedSpot.category}
                      </span>
                      <span className="text-zinc-600">•</span>
                      <span className="text-[10px] text-zinc-400 truncate">{selectedSpot.neighborhood}</span>
                      <span className="text-zinc-600">•</span>
                      {/* Open or Closed Status Badge */}
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold flex items-center gap-1 border ${openStatus.badgeClass}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${openStatus.dotColorClass}`}></span>
                        <span>{openStatus.statusLabel}</span>
                        <span className="text-zinc-500">•</span>
                        <span>{openStatus.displayNote}</span>
                      </span>
                    </div>
                    <h4 className="font-headline text-sm font-bold text-white truncate">
                      {selectedSpot.name}
                    </h4>
                    <p className="text-[11px] text-zinc-400 line-clamp-1">
                      {selectedSpot.subtitle || selectedSpot.lore}
                    </p>
                  </div>
                </div>
              );
            })()}

            <div className="flex items-center gap-2 shrink-0 justify-end">
              {/* Live Real-Time Navigation Button */}
              <button
                onClick={() => handleStartLiveNavigation(selectedSpot)}
                className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-xs font-bold shadow-md active:scale-95 transition-all flex items-center gap-1.5 border border-cyan-400/40 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[16px] animate-pulse">near_me</span>
                <span>Live Navigate</span>
              </button>

              <button
                onClick={() => handleAddWaypoint(selectedSpot)}
                className="px-3 py-2 rounded-xl bg-[#26262b] hover:bg-[#32323a] text-orange-400 text-xs font-bold transition-all flex items-center gap-1 active:scale-95 border border-orange-500/30"
              >
                <span className="material-symbols-outlined text-[15px]">add_location_alt</span>
                <span>Add Stop</span>
              </button>

              <button
                onClick={() => onOpenDossier(mapSpotToDiscovery(selectedSpot))}
                className="px-3 py-2 rounded-xl bg-orange-600 hover:bg-orange-500 text-white text-xs font-bold shadow-md active:scale-95 transition-all flex items-center gap-1"
              >
                <span>Dossier</span>
                <span className="material-symbols-outlined text-[15px]">arrow_forward</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* EXPEDITION ROUTE BUILDER & DIRECTIONS CONTROL DRAWER */}
      <section className="bg-gradient-to-br from-[#18181c] to-[#201815] rounded-3xl p-5 border border-orange-500/40 shadow-xl space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-orange-600/20 text-orange-400 flex items-center justify-center border border-orange-500/30">
              <span className="material-symbols-outlined text-[22px]">directions</span>
            </div>
            <div>
              <h3 className="font-headline text-lg text-white font-bold">
                Expedition Directions Router
              </h3>
              <p className="text-xs text-[#9898a0]">
                Google Maps walking & transit paths across heritage & food trails
              </p>
            </div>
          </div>

          {/* Travel Mode Toggle: Walking vs Transit vs Driving */}
          <div className="flex items-center bg-[#121214] p-1 rounded-2xl border border-[#26262b]">
            <button
              onClick={() => {
                setTravelMode('WALKING');
                triggerHaptic('light');
              }}
              title="Walking Path"
              className={`p-2 rounded-xl transition-all ${
                travelMode === 'WALKING' ? 'bg-orange-600 text-white shadow' : 'text-[#71717a] hover:text-white'
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">directions_walk</span>
            </button>

            <button
              onClick={() => {
                setTravelMode('TRANSIT');
                triggerHaptic('light');
              }}
              title="Public Transit"
              className={`p-2 rounded-xl transition-all ${
                travelMode === 'TRANSIT' ? 'bg-orange-600 text-white shadow' : 'text-[#71717a] hover:text-white'
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">directions_bus</span>
            </button>

            <button
              onClick={() => {
                setTravelMode('DRIVING');
                triggerHaptic('light');
              }}
              title="Driving"
              className={`p-2 rounded-xl transition-all ${
                travelMode === 'DRIVING' ? 'bg-orange-600 text-white shadow' : 'text-[#71717a] hover:text-white'
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">directions_car</span>
            </button>
          </div>
        </div>

        {/* Curated 1-Tap Expedition Preset Chips */}
        <div>
          <span className="text-[11px] font-bold text-orange-400 uppercase tracking-widest block mb-2">
            Curated Expedition Trails (1-Tap Route)
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {CURATED_EXPEDITION_PRESETS.map((preset) => (
              <button
                key={preset.id}
                onClick={() => handleLoadPreset(preset)}
                className="p-3 rounded-2xl bg-[#141418] hover:bg-[#1f1f26] border border-[#2a2a32] hover:border-orange-500/50 text-left transition-all group flex items-center justify-between gap-2 active:scale-98 cursor-pointer"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-orange-400 font-bold uppercase">
                      {preset.highlightCategory}
                    </span>
                    <span className="text-zinc-600">•</span>
                    <span className="text-[10px] text-emerald-400 font-mono">+{preset.xpReward} XP</span>
                  </div>
                  <h5 className="font-bold text-xs text-white group-hover:text-orange-400 truncate">
                    {preset.title}
                  </h5>
                  <p className="text-[10px] text-[#9898a0] truncate">{preset.tagline}</p>
                </div>
                <span className="material-symbols-outlined text-[#9898a0] group-hover:text-orange-400 text-[18px] shrink-0">
                  arrow_forward
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Active Waypoints Sequence List */}
        <div className="space-y-2 pt-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-orange-400 uppercase tracking-widest">
              Active Waypoints ({expeditionWaypoints.length} Stops)
            </span>
            {expeditionWaypoints.length > 0 && (
              <button
                onClick={() => {
                  setExpeditionWaypoints([]);
                  triggerHaptic('light');
                }}
                className="text-[10px] text-red-400 hover:text-red-300 font-bold"
              >
                Clear All Stops
              </button>
            )}
          </div>

          {expeditionWaypoints.length === 0 ? (
            <div className="p-4 rounded-2xl bg-[#121214] border border-dashed border-[#2c2c34] text-center text-xs text-[#71717a]">
              Select any place from the map or curated presets to build your walking expedition route.
            </div>
          ) : (
            <div className="space-y-2">
              {expeditionWaypoints.map((wp, idx) => (
                <div
                  key={wp.id}
                  className="flex items-center justify-between p-2.5 rounded-xl bg-[#121214] border border-[#26262b]"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-6 h-6 rounded-full bg-orange-600 text-white font-bold text-xs flex items-center justify-center shrink-0">
                      {idx + 1}
                    </div>
                    <div className="min-w-0">
                      <span className="text-xs font-bold text-white truncate block">{wp.name}</span>
                      <span className="text-[10px] text-zinc-400 truncate block">
                        {wp.neighborhood} • {wp.category}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => handleRemoveWaypoint(wp.id)}
                    className="text-zinc-500 hover:text-red-400 p-1"
                    title="Remove stop"
                  >
                    <span className="material-symbols-outlined text-[16px]">close</span>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Calculated Route Metrics & Live Turn-by-Turn Guidance */}
        {routeResult && (
          <div className="space-y-3 pt-2">
            {/* Route Stats Grid */}
            <div className="grid grid-cols-4 gap-2">
              <div className="p-2.5 rounded-xl bg-[#121214] border border-[#26262b] text-center">
                <span className="text-[10px] text-zinc-400 uppercase font-bold block">Distance</span>
                <span className="text-sm font-bold text-orange-400 font-mono">
                  {routeResult.distanceText}
                </span>
              </div>

              <div className="p-2.5 rounded-xl bg-[#121214] border border-[#26262b] text-center">
                <span className="text-[10px] text-zinc-400 uppercase font-bold block">Est. Time</span>
                <span className="text-sm font-bold text-amber-400 font-mono">
                  {routeResult.durationText}
                </span>
              </div>

              <div className="p-2.5 rounded-xl bg-[#121214] border border-[#26262b] text-center">
                <span className="text-[10px] text-zinc-400 uppercase font-bold block">Calories</span>
                <span className="text-sm font-bold text-emerald-400 font-mono">
                  ~{routeResult.calories} kcal
                </span>
              </div>

              <div className="p-2.5 rounded-xl bg-[#121214] border border-[#26262b] text-center">
                <span className="text-[10px] text-zinc-400 uppercase font-bold block">XP Bounty</span>
                <span className="text-sm font-bold text-purple-400 font-mono">
                  +{routeResult.xpEarned} XP
                </span>
              </div>
            </div>

            {/* Turn-by-Turn Audio Navigation Banner */}
            <div className="p-3.5 rounded-2xl bg-[#141418] border border-orange-500/30 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="material-symbols-outlined text-orange-400 text-[24px] shrink-0">
                  navigation
                </span>
                <div className="min-w-0">
                  <span className="text-[10px] text-orange-400 font-bold uppercase block">
                    Step {currentNavStepIndex + 1} of {routeResult.steps.length}
                  </span>
                  <p className="text-xs text-white font-semibold line-clamp-1">
                    {routeResult.steps[currentNavStepIndex]?.instruction || 'Proceed along path'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  onClick={() => {
                    const currentStep = routeResult.steps[currentNavStepIndex];
                    if (currentStep) {
                      speakCurrentNavStep(
                        `Step ${currentNavStepIndex + 1}: ${currentStep.instruction} for ${currentStep.distance}`
                      );
                    }
                  }}
                  className="p-2 rounded-xl bg-orange-600 text-white text-xs font-bold flex items-center gap-1 shadow active:scale-95"
                  title="Speak instruction"
                >
                  <span className="material-symbols-outlined text-[16px]">volume_up</span>
                </button>

                <button
                  onClick={handleNextStep}
                  className="p-2 rounded-xl bg-[#26262b] hover:bg-[#32323a] text-white text-xs font-bold flex items-center gap-1 active:scale-95"
                  title="Next navigation step"
                >
                  <span className="material-symbols-outlined text-[16px]">skip_next</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </section>
    </div>
  );
};
