import { useState, useEffect, useRef } from 'react';
import { UnifiedMapSpot } from '../data/allUnifiedSpots';
import { SavedLocationPin } from '../types';
import { calculateDistanceKm } from './mapsService';

export interface GeofenceEvent {
  id: string;
  name: string;
  type: 'heritage' | 'custom';
  distanceMeters: number;
  lore?: string;
}

interface GeofencingOptions {
  curatedSpots: UnifiedMapSpot[];
  customPins: SavedLocationPin[];
  proximityThresholdMeters?: number;
  onEnter: (event: GeofenceEvent) => void;
  enabled?: boolean;
}

export function useGeofencing({
  curatedSpots,
  customPins,
  proximityThresholdMeters = 100,
  onEnter,
  enabled = true
}: GeofencingOptions) {
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const activeGeofencesRef = useRef<Set<string>>(new Set());
  const lastUpdateRef = useRef<number>(0);

  useEffect(() => {
    if (!enabled || !('geolocation' in navigator)) return;

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        setUserLocation({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude
        });
      },
      (err) => console.warn('Geofencing GPS error:', err),
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [enabled]);

  useEffect(() => {
    if (!userLocation) return;

    // Throttling checks to every 10 seconds to save battery/cycles
    const now = Date.now();
    if (now - lastUpdateRef.current < 10000) return;
    lastUpdateRef.current = now;

    const checkProximity = () => {
      const currentActive = new Set<string>();

      // Check curated heritage spots
      curatedSpots.forEach((spot) => {
        const distKm = calculateDistanceKm(
          userLocation.lat,
          userLocation.lng,
          spot.lat,
          spot.lng
        );
        const distMeters = distKm * 1000;

        if (distMeters <= proximityThresholdMeters) {
          currentActive.add(spot.id);
          if (!activeGeofencesRef.current.has(spot.id)) {
            onEnter({
              id: spot.id,
              name: spot.name,
              type: 'heritage',
              distanceMeters: Math.round(distMeters),
              lore: spot.lore
            });
          }
        }
      });

      // Check custom personal pins
      customPins.forEach((pin) => {
        const distKm = calculateDistanceKm(
          userLocation.lat,
          userLocation.lng,
          pin.lat,
          pin.lng
        );
        const distMeters = distKm * 1000;

        // Custom pins have a tighter threshold (50m)
        if (distMeters <= 50) {
          currentActive.add(pin.id);
          if (!activeGeofencesRef.current.has(pin.id)) {
            onEnter({
              id: pin.id,
              name: pin.note,
              type: 'custom',
              distanceMeters: Math.round(distMeters)
            });
          }
        }
      });

      activeGeofencesRef.current = currentActive;
    };

    checkProximity();
  }, [userLocation, curatedSpots, customPins, proximityThresholdMeters, onEnter]);
}
