import { setOptions, importLibrary } from '@googlemaps/js-api-loader';
import { MarkerClusterer } from '@googlemaps/markerclusterer';
import { UnifiedMapSpot } from '../data/allUnifiedSpots';

const DEFAULT_MAPS_API_KEY =
  (import.meta as any).env?.VITE_GOOGLE_MAPS_API_KEY || 'AIzaSyC-8sz-WC5Bh4KEuFafiB15MIPr2rE-1Mk';

export function configureMapsLoader(apiKey: string = DEFAULT_MAPS_API_KEY) {
  try {
    setOptions({
      key: apiKey,
      v: 'weekly',
      libraries: ['places', 'geometry', 'marker'],
    });
  } catch {
    // Already set
  }
}

export const darkMapStyle = [
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

export async function initKaosMap(
  container: HTMLElement,
  center = { lat: 13.0674, lng: 80.2650 },
  zoom = 13
): Promise<{ google: any; map: any }> {
  configureMapsLoader();
  await importLibrary('maps');
  await importLibrary('marker');

  const google = window.google;
  if (!google?.maps?.Map) {
    throw new Error('Google Maps JavaScript API failed to load.');
  }

  const map = new google.maps.Map(container, {
    center,
    zoom,
    mapId: 'DEMO_MAP_ID',
    styles: darkMapStyle,
    disableDefaultUI: false,
    zoomControl: true,
    streetViewControl: true,
    mapTypeControl: false,
    fullscreenControl: true,
    backgroundColor: '#141418',
  });

  return { google, map };
}

export function renderKaosMarkers(
  google: any,
  map: any,
  spots: UnifiedMapSpot[],
  onSelectSpot: (spot: UnifiedMapSpot) => void
): { markers: any[]; clusterer: MarkerClusterer } {
  const markers: any[] = [];

  spots.forEach((spot) => {
    const isFood = spot.type === 'food';
    const isArch = spot.type === 'architecture';

    const pinEl = document.createElement('div');
    pinEl.className = 'kaos-map-pin flex items-center justify-center cursor-pointer transition-transform hover:scale-110';
    pinEl.innerHTML = `
      <div style="background: ${isFood ? '#10b981' : isArch ? '#3b82f6' : '#f97316'}; color: #fff; width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 12px rgba(0,0,0,0.5); border: 2px solid rgba(255,255,255,0.2); font-weight: bold; font-size: 11px;">
        ${isFood ? '🍲' : isArch ? '🏛️' : '📜'}
      </div>
    `;

    const marker = new google.maps.marker.AdvancedMarkerElement({
      map,
      position: { lat: spot.lat, lng: spot.lng },
      title: spot.name,
      content: pinEl,
    });

    marker.addListener('click', () => {
      onSelectSpot(spot);
    });

    markers.push(marker);
  });

  const clusterer = new MarkerClusterer({ map, markers });

  return { markers, clusterer };
}

export function getZoneCenter(zone: string): { lat: number; lng: number } {
  const centers: Record<string, { lat: number; lng: number }> = {
    'Mylapore': { lat: 13.0338, lng: 80.2677 },
    'George Town': { lat: 13.0900, lng: 80.2850 },
    'Triplicane': { lat: 13.0588, lng: 80.2760 },
    'Chepauk': { lat: 13.0620, lng: 80.2800 },
    'Santhome': { lat: 13.0330, lng: 80.2780 },
    'Royapuram': { lat: 13.1120, lng: 80.2950 },
    'Egmore': { lat: 13.0780, lng: 80.2600 },
    'Fort St. George': { lat: 13.0790, lng: 80.2870 },
    'Besant Nagar': { lat: 13.0002, lng: 80.2668 },
    'Nungambakkam': { lat: 13.0595, lng: 80.2435 },
  };
  return centers[zone] || { lat: 13.0674, lng: 80.2650 };
}

export function filterSpotsByZone(spots: UnifiedMapSpot[], zone: string): UnifiedMapSpot[] {
  if (!zone || zone === 'All Chennai') return spots;
  const target = zone.toLowerCase();
  return spots.filter(
    (s) =>
      s.neighborhood?.toLowerCase().includes(target) ||
      s.cluster?.toLowerCase().includes(target)
  );
}

export function calculateDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}
