import React, { useState, useEffect, useRef, useCallback } from 'react';
import * as THREE from 'three';
import {
  AcousticLoreArtifact,
  Anchored3dArtifact,
  GroundSurfacePlane,
  SessionPlacedArtifact,
  VisualHapticEvent,
} from '../types';
import { ACOUSTIC_LORE_ARTIFACTS } from '../data/acousticLoreArtifacts';
import { soundscapeEngine } from '../lib/soundscapes';
import { triggerHaptic } from '../lib/haptic';
import { useAuth } from '../context/AuthContext';
import { surfaceEstimator } from '../lib/surfaceEstimation';
import {
  saveWorldArtifact,
  subscribeNearbyWorldArtifacts,
  resonateWithWorldArtifact,
  calculateDistanceKm,
} from '../lib/cloudArPersistence';
import { ArtifactInventoryModal } from './ArtifactInventoryModal';
import { UnifiedMapSpot } from '../data/allUnifiedSpots';

// Geodesic bearing calculation in degrees (0 = North, 90 = East, 180 = South, 270 = West)
function calculateGeodesicBearing(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const y = Math.sin(deltaLambda) * Math.cos(phi2);
  const x = Math.cos(phi1) * Math.sin(phi2) - Math.sin(phi1) * Math.cos(phi2) * Math.cos(deltaLambda);
  const theta = Math.atan2(y, x);
  return ((theta * 180) / Math.PI + 360) % 360;
}

function getCompassCardinal(deg: number): string {
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  const index = Math.round(deg / 45) % 8;
  return dirs[index];
}

interface ArAcousticArtifactViewportProps {
  userCoords: { lat: number; lng: number } | null;
  gpsAccuracy: number | null;
  nearestSpotName?: string;
  targetSpot?: UnifiedMapSpot | null;
  onShowToast: (msg: string, icon?: string) => void;
  onClose?: () => void;
  initialArtifactId?: string;
  onOpenInventory?: () => void;
  onSessionPlacedChange?: (count: number, lastArtifactName?: string, undoFn?: () => void, allPlaced?: SessionPlacedArtifact[]) => void;
  onRegisterUndo?: (undoFn: () => void) => void;
  sharedPlacedArtifacts?: SessionPlacedArtifact[];
  isSharedViewActive?: boolean;
  sharedSessionCode?: string;
  sharedHostName?: string;
  onOpenSharedView?: () => void;
}

export const ArAcousticArtifactViewport: React.FC<ArAcousticArtifactViewportProps> = ({
  userCoords,
  gpsAccuracy,
  nearestSpotName = 'Mylapore Heritage Zone',
  targetSpot,
  onShowToast,
  onClose,
  initialArtifactId,
  onSessionPlacedChange,
  onRegisterUndo,
  sharedPlacedArtifacts,
  isSharedViewActive = false,
  sharedSessionCode,
  sharedHostName,
  onOpenSharedView,
}) => {
  const { user } = useAuth();

  // Selected Acoustic Lore Artifact
  const [selectedArtifact, setSelectedArtifact] = useState<AcousticLoreArtifact>(() => {
    if (initialArtifactId) {
      const found = ACOUSTIC_LORE_ARTIFACTS.find((a) => a.id === initialArtifactId);
      if (found) return found;
    }
    return ACOUSTIC_LORE_ARTIFACTS[0];
  });

  // Inventory Browser Modal State
  const [inventoryModalOpen, setInventoryModalOpen] = useState(false);

  // Camera State
  const videoRef = useRef<HTMLVideoElement>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  // 3D Canvas & WebGL refs
  const mountRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const camera3dRef = useRef<THREE.PerspectiveCamera | null>(null);
  const artifactGroupRef = useRef<THREE.Group | null>(null);
  const reticleMeshRef = useRef<THREE.Mesh | null>(null);
  const groundGridRef = useRef<THREE.GridHelper | null>(null);
  const contactShadowRef = useRef<THREE.Mesh | null>(null);
  const worldMarkersGroupRef = useRef<THREE.Group | null>(null);
  const breadcrumbGroupRef = useRef<THREE.Group | null>(null);
  const sharedSessionGroupRef = useRef<THREE.Group | null>(null);
  const animFrameIdRef = useRef<number | null>(null);

  // Surface Estimation & Ground Collision State
  const [surfacePlane, setSurfacePlane] = useState<GroundSurfacePlane>(surfaceEstimator.getGroundPlane());
  const [showSurfaceGrid, setShowSurfaceGrid] = useState(true);
  const [isRestingOnGround, setIsRestingOnGround] = useState(true);
  const [collisionImpactFlash, setCollisionImpactFlash] = useState(false);

  // AR Pathfinding Visualizer State (Glowing Breadcrumbs)
  const [pathfindingActive, setPathfindingActive] = useState(true);
  const [deviceCompassHeading, setDeviceCompassHeading] = useState<number>(0);

  // Active Target Spot for Pathfinding (from prop or default nearest spot)
  const activeNavTarget = targetSpot || {
    id: 'spot-kapaleeshwarar',
    name: nearestSpotName || 'Kapaleeshwarar Temple Tank',
    lat: 13.0336,
    lng: 80.2694,
    neighborhood: 'Mylapore',
  };

  // Calculate real-world bearing & distance to target
  const { bearingDegrees, cardinalDirection, distanceMeters, distanceFormatted } = React.useMemo(() => {
    const uLat = userCoords?.lat || 13.0336;
    const uLng = userCoords?.lng || 80.2694;
    const tLat = activeNavTarget.lat;
    const tLng = activeNavTarget.lng;

    const bearing = calculateGeodesicBearing(uLat, uLng, tLat, tLng);
    const distKm = calculateDistanceKm(uLat, uLng, tLat, tLng);
    const distM = Math.round(distKm * 1000);
    const formatted = distM < 1000 ? `${distM} m` : `${distKm.toFixed(1)} km`;

    return {
      bearingDegrees: Math.round(bearing),
      cardinalDirection: getCompassCardinal(bearing),
      distanceMeters: distM,
      distanceFormatted: formatted,
    };
  }, [userCoords, activeNavTarget]);

  // Listen to device compass orientation (heading angle)
  useEffect(() => {
    const handleOrientation = (e: any) => {
      // webkitCompassHeading for iOS Safari, alpha for Android Chrome
      let heading = e.webkitCompassHeading;
      if (heading === undefined || heading === null) {
        heading = e.alpha ? (360 - e.alpha) % 360 : 0;
      }
      setDeviceCompassHeading(Math.round(heading));
    };

    if (typeof window !== 'undefined' && window.DeviceOrientationEvent) {
      window.addEventListener('deviceorientation', handleOrientation, true);
    }
    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('deviceorientation', handleOrientation, true);
      }
    };
  }, []);

  // Physics Simulation Refs for Ground Plane Resting
  const physicsStateRef = useRef<{
    currentY: number;
    velocityY: number;
    isResting: boolean;
    scale: number;
    posX: number;
    posZ: number;
  }>({
    currentY: 0.0,
    velocityY: 0.0,
    isResting: true,
    scale: selectedArtifact.defaultScale,
    posX: 0.0,
    posZ: 0.0,
  });

  // Artifact Transform & Interaction State
  const [artifactScale, setArtifactScale] = useState<number>(selectedArtifact.defaultScale);
  const [isAutoRotating, setIsAutoRotating] = useState(true);
  const [soundscapePlaying, setSoundscapePlaying] = useState(false);
  const [isPinching, setIsPinching] = useState(false);
  const [pinchScaleDisplay, setPinchScaleDisplay] = useState<number>(selectedArtifact.defaultScale);
  const [tapRipplePos, setTapRipplePos] = useState<{ x: number; y: number } | null>(null);
  const [shutterFlash, setShutterFlash] = useState(false);
  const [capturedScreenshot, setCapturedScreenshot] = useState<string | null>(null);

  // Session Placed Artifacts & Undo History Stack
  const [sessionPlacedArtifacts, setSessionPlacedArtifacts] = useState<SessionPlacedArtifact[]>([]);
  const sessionPlacedMeshesRef = useRef<Map<string, { mesh: THREE.Group; shadowMesh: THREE.Mesh }>>(new Map());
  const sessionPlacedGroupRef = useRef<THREE.Group | null>(null);

  // Visual Haptic Feedback State (Subtle pulse ripples for gestures & undo)
  const [visualHapticEvent, setVisualHapticEvent] = useState<VisualHapticEvent | null>(null);
  const lastScaleMilestoneRef = useRef<number>(selectedArtifact.defaultScale);

  // Helper: Trigger Visual Haptic Ripple on Screen
  const triggerVisualHaptic = useCallback(
    (
      type: VisualHapticEvent['type'],
      x: number,
      y: number,
      label?: string,
      color?: string,
      touch1?: { x: number; y: number },
      touch2?: { x: number; y: number }
    ) => {
      const event: VisualHapticEvent = {
        id: Date.now() + Math.random(),
        type,
        x,
        y,
        label,
        color: color || '#f05423',
        touch1,
        touch2,
      };
      setVisualHapticEvent(event);
      setTimeout(() => {
        setVisualHapticEvent((curr) => (curr?.id === event.id ? null : curr));
      }, 750);
    },
    []
  );

  // Cloud Coordinate Persistence Layer State (Multi-User Visibility)
  const [nearbyWorldArtifacts, setNearbyWorldArtifacts] = useState<
    (Anchored3dArtifact & { distanceKm: number; distanceFormatted: string })[]
  >([]);
  const [isSyncingCloud, setIsSyncingCloud] = useState(false);
  const [explorerInscription, setExplorerInscription] = useState<string>('');
  const [showInscriptionPrompt, setShowInscriptionPrompt] = useState(false);
  const [selectedWorldArtifactModal, setSelectedWorldArtifactModal] = useState<
    (Anchored3dArtifact & { distanceKm: number; distanceFormatted: string }) | null
  >(null);

  // Multi-touch gesture refs
  const touchStartDistRef = useRef<number | null>(null);
  const touchStartScaleRef = useRef<number>(1);
  const isDraggingRef = useRef(false);
  const lastPointerPosRef = useRef<{ x: number; y: number } | null>(null);

  // 1. Initialize Real-Time Camera Stream
  useEffect(() => {
    let stream: MediaStream | null = null;
    let isCancelled = false;

    async function startCamera() {
      try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          throw new Error('Camera API unavailable on this browser/environment');
        }
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        });

        if (isCancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch((e) => console.warn('Video play error:', e));
          setCameraActive(true);
          setCameraError(null);
        }
      } catch (err: any) {
        console.warn('Live AR camera failed to initialize:', err);
        setCameraActive(false);
        setCameraError(err.message || 'Camera permission denied or device not found');
      }
    }

    startCamera();

    return () => {
      isCancelled = true;
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  // 2. Real-Time Cloud Persistence Subscription (Listen to artifacts placed by other explorers)
  useEffect(() => {
    const unsubscribe = subscribeNearbyWorldArtifacts(userCoords, 30, (items) => {
      setNearbyWorldArtifacts(items);
    });
    return () => unsubscribe();
  }, [userCoords]);

  // 3. Build Procedural 3D Mesh for each Acoustic Lore Artifact
  const buildArtifactMesh = useCallback((artifact: AcousticLoreArtifact): THREE.Group => {
    const group = new THREE.Group();
    group.name = `artifact-${artifact.id}`;

    switch (artifact.modelType) {
      case 'bell': {
        const bronzeMat = new THREE.MeshStandardMaterial({
          color: 0xcd7f32,
          metalness: 0.9,
          roughness: 0.22,
        });
        const goldHighlightMat = new THREE.MeshStandardMaterial({
          color: 0xffd700,
          metalness: 0.95,
          roughness: 0.15,
        });

        const bellLower = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.45, 1.1, 32, 1, true), bronzeMat);
        bellLower.position.y = 0.55;
        group.add(bellLower);

        const bellCrown = new THREE.Mesh(new THREE.SphereGeometry(0.46, 32, 16, 0, Math.PI * 2, 0, Math.PI * 0.5), bronzeMat);
        bellCrown.position.y = 1.1;
        group.add(bellCrown);

        const lipTorus = new THREE.Mesh(new THREE.TorusGeometry(0.9, 0.09, 16, 32), goldHighlightMat);
        lipTorus.rotation.x = Math.PI / 2;
        lipTorus.position.y = 0.05;
        group.add(lipTorus);

        const ring1 = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.04, 16, 32), goldHighlightMat);
        ring1.rotation.x = Math.PI / 2;
        ring1.position.y = 0.85;
        group.add(ring1);

        const handleTorus = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.05, 16, 32, Math.PI), bronzeMat);
        handleTorus.position.y = 1.35;
        group.add(handleTorus);

        const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.8), bronzeMat);
        rod.position.y = 0.55;
        const clapper = new THREE.Mesh(new THREE.SphereGeometry(0.12, 16, 16), goldHighlightMat);
        clapper.position.y = 0.15;
        group.add(rod, clapper);
        break;
      }

      case 'conch': {
        const pearlMat = new THREE.MeshStandardMaterial({
          color: 0xfbfbfb,
          roughness: 0.28,
          metalness: 0.35,
        });
        const coralMat = new THREE.MeshStandardMaterial({
          color: 0xfbcfe8,
          roughness: 0.35,
          metalness: 0.15,
        });

        const mainWhorl = new THREE.Mesh(new THREE.SphereGeometry(0.65, 32, 24), pearlMat);
        mainWhorl.scale.set(0.9, 1.4, 0.75);
        mainWhorl.position.set(0, 0.75, 0);
        group.add(mainWhorl);

        for (let i = 0; i < 4; i++) {
          const step = new THREE.Mesh(
            new THREE.CylinderGeometry(0.28 - i * 0.06, 0.38 - i * 0.07, 0.25, 20),
            i % 2 === 0 ? pearlMat : coralMat
          );
          step.position.set(0, 1.35 + i * 0.22, 0);
          step.rotation.y = i * 0.5;
          group.add(step);
        }

        const lip = new THREE.Mesh(new THREE.TorusGeometry(0.38, 0.08, 16, 24, Math.PI * 1.3), coralMat);
        lip.rotation.z = 0.4;
        lip.position.set(0.3, 0.6, 0.2);
        group.add(lip);
        break;
      }

      case 'davarah': {
        const brassMat = new THREE.MeshStandardMaterial({
          color: 0xdfaa22,
          metalness: 0.92,
          roughness: 0.18,
        });
        const darkCoffeeMat = new THREE.MeshStandardMaterial({
          color: 0x3d1d0c,
          roughness: 0.3,
          metalness: 0.1,
        });
        const frothMat = new THREE.MeshStandardMaterial({
          color: 0xc49758,
          roughness: 0.8,
        });

        const saucer = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 0.55, 0.35, 32, 1, false), brassMat);
        saucer.position.y = 0.18;
        group.add(saucer);

        const saucerLip = new THREE.Mesh(new THREE.TorusGeometry(0.95, 0.04, 16, 32), brassMat);
        saucerLip.rotation.x = Math.PI / 2;
        saucerLip.position.y = 0.35;
        group.add(saucerLip);

        const tumbler = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.4, 0.85, 32, 1, false), brassMat);
        tumbler.position.y = 0.65;
        group.add(tumbler);

        const tumblerRim = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.035, 16, 32), brassMat);
        tumblerRim.rotation.x = Math.PI / 2;
        tumblerRim.position.y = 1.07;
        group.add(tumblerRim);

        const coffeeSurface = new THREE.Mesh(new THREE.CircleGeometry(0.46, 24), darkCoffeeMat);
        coffeeSurface.rotation.x = -Math.PI / 2;
        coffeeSurface.position.y = 1.02;
        group.add(coffeeSurface);

        const frothCrema = new THREE.Mesh(new THREE.RingGeometry(0.2, 0.44, 24), frothMat);
        frothCrema.rotation.x = -Math.PI / 2;
        frothCrema.position.y = 1.03;
        group.add(frothCrema);
        break;
      }

      case 'belfry_bell': {
        const weatheredBronzeMat = new THREE.MeshStandardMaterial({
          color: 0x3d4b42,
          roughness: 0.45,
          metalness: 0.8,
        });
        const verdigrisMat = new THREE.MeshStandardMaterial({
          color: 0x228b68,
          roughness: 0.6,
          metalness: 0.4,
        });

        const belfryBody = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 0.5, 1.25, 32, 1, true), weatheredBronzeMat);
        belfryBody.position.y = 0.65;
        group.add(belfryBody);

        const bellCap = new THREE.Mesh(new THREE.SphereGeometry(0.52, 32, 16, 0, Math.PI * 2, 0, Math.PI * 0.45), weatheredBronzeMat);
        bellCap.position.y = 1.28;
        group.add(bellCap);

        const ribbon = new THREE.Mesh(new THREE.CylinderGeometry(0.68, 0.72, 0.18, 32, 1, true), verdigrisMat);
        ribbon.position.y = 0.55;
        group.add(ribbon);

        const yoke = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.16, 0.22), weatheredBronzeMat);
        yoke.position.y = 1.62;
        group.add(yoke);
        break;
      }

      case 'urn': {
        const clayMat = new THREE.MeshStandardMaterial({
          color: 0xba4e28,
          roughness: 0.85,
          metalness: 0.08,
        });
        const glazeBandMat = new THREE.MeshStandardMaterial({
          color: 0xd97706,
          roughness: 0.35,
          metalness: 0.4,
        });

        const belly = new THREE.Mesh(new THREE.SphereGeometry(0.72, 32, 24), clayMat);
        belly.scale.set(1, 0.85, 1);
        belly.position.y = 0.65;
        group.add(belly);

        const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.28, 0.45, 24), clayMat);
        neck.position.y = 1.2;
        group.add(neck);

        const mouthRim = new THREE.Mesh(new THREE.TorusGeometry(0.38, 0.06, 16, 32), glazeBandMat);
        mouthRim.rotation.x = Math.PI / 2;
        mouthRim.position.y = 1.42;
        group.add(mouthRim);

        const band = new THREE.Mesh(new THREE.TorusGeometry(0.73, 0.04, 16, 32), glazeBandMat);
        band.rotation.x = Math.PI / 2;
        band.position.y = 0.65;
        group.add(band);
        break;
      }
    }

    return group;
  }, []);

  // 4. Initialize Three.js WebGL Scene with Breadcrumb Pathfinding Visualizer & Ground Collision
  useEffect(() => {
    if (!mountRef.current) return;
    const container = mountRef.current;
    const width = container.clientWidth || 360;
    const height = container.clientHeight || 540;

    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      preserveDrawingBuffer: true,
      powerPreference: 'high-performance',
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    container.innerHTML = '';
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const scene = new THREE.Scene();
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    camera.position.set(0, 1.4, 3.6);
    camera.lookAt(0, 0.6, 0);
    camera3dRef.current = camera;

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.85);
    const dirLight = new THREE.DirectionalLight(0xffeedd, 1.6);
    dirLight.position.set(3, 5, 4);
    dirLight.castShadow = true;
    scene.add(ambientLight, dirLight);

    const pointLight = new THREE.PointLight(selectedArtifact.color, 2.5, 6);
    pointLight.position.set(-2, 2, 2);
    scene.add(pointLight);

    // Dynamic Ground Surface Plane Grid
    const gridHelper = new THREE.GridHelper(12, 24, 0xf05423, 0x443328);
    gridHelper.position.set(0, 0, 0);
    scene.add(gridHelper);
    groundGridRef.current = gridHelper;

    // Contact Shadow
    const shadowGeo = new THREE.CircleGeometry(0.85, 32);
    const shadowMat = new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
    });
    const contactShadow = new THREE.Mesh(shadowGeo, shadowMat);
    contactShadow.rotation.x = -Math.PI / 2;
    contactShadow.position.set(0, 0.005, 0);
    scene.add(contactShadow);
    contactShadowRef.current = contactShadow;

    // Placement Reticle
    const reticleGeo = new THREE.RingGeometry(0.8, 0.9, 32);
    const reticleMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(selectedArtifact.color),
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.7,
    });
    const reticle = new THREE.Mesh(reticleGeo, reticleMat);
    reticle.rotation.x = -Math.PI / 2;
    reticle.position.set(0, 0.01, 0);
    scene.add(reticle);
    reticleMeshRef.current = reticle;

    // Active 3D Artifact Cursor Preview
    const artifactGroup = buildArtifactMesh(selectedArtifact);
    artifactGroup.scale.setScalar(selectedArtifact.defaultScale);
    scene.add(artifactGroup);
    artifactGroupRef.current = artifactGroup;

    // Group for User's Session Placed 3D Artifacts (Multi-placement with Undo stack)
    const sessionPlacedGroup = new THREE.Group();
    sessionPlacedGroup.name = 'session-placed-artifacts-group';
    scene.add(sessionPlacedGroup);
    sessionPlacedGroupRef.current = sessionPlacedGroup;

    // Group for Shared-View Peer Real-Time 3D Artifacts
    const sharedSessionGroup = new THREE.Group();
    sharedSessionGroup.name = 'shared-view-session-group';
    scene.add(sharedSessionGroup);
    sharedSessionGroupRef.current = sharedSessionGroup;

    // Group for Other Explorers' Cloud-Anchored World Artifacts
    const worldGroup = new THREE.Group();
    worldGroup.name = 'cloud-world-markers';
    scene.add(worldGroup);
    worldMarkersGroupRef.current = worldGroup;

    // Group for Glowing Breadcrumbs Pathfinding Line
    const breadcrumbGroup = new THREE.Group();
    breadcrumbGroup.name = 'ar-pathfinding-breadcrumbs';
    scene.add(breadcrumbGroup);
    breadcrumbGroupRef.current = breadcrumbGroup;

    // Build Initial Breadcrumbs Nodes (16 glowing segments)
    const breadcrumbNodes: THREE.Mesh[] = [];
    const breadcrumbNodeGeo = new THREE.SphereGeometry(0.065, 12, 12);
    const breadcrumbMat = new THREE.MeshBasicMaterial({
      color: 0x06b6d4, // Cyan/teal glowing breadcrumb
      transparent: true,
      opacity: 0.85,
    });

    for (let i = 0; i < 16; i++) {
      const node = new THREE.Mesh(breadcrumbNodeGeo, breadcrumbMat.clone());
      breadcrumbGroup.add(node);
      breadcrumbNodes.push(node);
    }

    // Glowing Waypoint Beacon at horizon
    const beaconPillarGeo = new THREE.CylinderGeometry(0.06, 0.06, 2.4, 16);
    const beaconPillarMat = new THREE.MeshBasicMaterial({ color: 0xf59e0b, transparent: true, opacity: 0.75 });
    const beaconPillar = new THREE.Mesh(beaconPillarGeo, beaconPillarMat);
    beaconPillar.position.y = 1.2;

    const beaconOrbGeo = new THREE.OctahedronGeometry(0.25, 0);
    const beaconOrbMat = new THREE.MeshStandardMaterial({ color: 0xffedd5, emissive: 0xf59e0b, emissiveIntensity: 0.9 });
    const beaconOrb = new THREE.Mesh(beaconOrbGeo, beaconOrbMat);
    beaconOrb.position.y = 2.4;

    const beaconGroup = new THREE.Group();
    beaconGroup.add(beaconPillar, beaconOrb);
    breadcrumbGroup.add(beaconGroup);

    // Animation & Collision Resting Loop
    let clock = new THREE.Clock();
    const animate = () => {
      animFrameIdRef.current = requestAnimationFrame(animate);
      const delta = clock.getDelta();
      const elapsedTime = clock.getElapsedTime();

      // 1. Surface plane estimation update
      const p = surfaceEstimator.updateEstimatedPlane();
      setSurfacePlane(p);

      if (groundGridRef.current) {
        groundGridRef.current.visible = showSurfaceGrid;
        groundGridRef.current.position.y = p.planeY;
      }

      // 2. Physics simulation: Drop until collision with ground plane
      const pState = physicsStateRef.current;
      const sim = surfaceEstimator.simulateRestingPhysics(pState, delta);
      pState.currentY = sim.newY;
      pState.velocityY = sim.newVelocityY;

      if (sim.justImpacted) {
        triggerHaptic('medium');
        setCollisionImpactFlash(true);
        setTimeout(() => setCollisionImpactFlash(false), 220);
      }

      if (sim.hasSettled && !pState.isResting) {
        pState.isResting = true;
        setIsRestingOnGround(true);
      }

      // Apply resting position and surface normal inclination
      if (artifactGroupRef.current) {
        artifactGroupRef.current.position.y = pState.currentY;
        artifactGroupRef.current.position.x = pState.posX;
        artifactGroupRef.current.position.z = pState.posZ;

        if (isAutoRotating) {
          artifactGroupRef.current.rotation.y += delta * 0.75;
        }

        artifactGroupRef.current.rotation.x = p.normal.z * 0.15;
        artifactGroupRef.current.rotation.z = -p.normal.x * 0.15;
      }

      // Contact Shadow
      if (contactShadowRef.current) {
        contactShadowRef.current.position.x = pState.posX;
        contactShadowRef.current.position.z = pState.posZ;
        contactShadowRef.current.position.y = surfaceEstimator.getGroundHeightAt(pState.posX, pState.posZ) + 0.005;
        const shadowScale = (1 + (pState.currentY - 0) * 0.4) * pState.scale;
        contactShadowRef.current.scale.set(shadowScale, shadowScale, shadowScale);
      }

      // Placement Reticle
      if (reticleMeshRef.current) {
        reticleMeshRef.current.position.x = pState.posX;
        reticleMeshRef.current.position.z = pState.posZ;
        reticleMeshRef.current.position.y = surfaceEstimator.getGroundHeightAt(pState.posX, pState.posZ) + 0.01;
        const pulse = 1 + Math.sin(elapsedTime * 3) * 0.08;
        reticleMeshRef.current.scale.set(pulse, pulse, pulse);
      }

      // 3. AR Pathfinding Glowing Breadcrumb Line Animation
      if (breadcrumbGroupRef.current) {
        breadcrumbGroupRef.current.visible = pathfindingActive;

        if (pathfindingActive) {
          // Relative heading between target bearing and device compass heading
          const relativeAngleDeg = bearingDegrees - deviceCompassHeading;
          const relativeRad = (relativeAngleDeg * Math.PI) / 180;

          // Direction vector along ground plane
          const dirX = Math.sin(relativeRad);
          const dirZ = -Math.cos(relativeRad);

          // Update breadcrumb nodes along ground path
          breadcrumbNodes.forEach((node, idx) => {
            const stepDist = 0.35 + idx * 0.42; // extends ~7 meters in AR space
            const nx = dirX * stepDist;
            const nz = dirZ * stepDist;
            const ny = surfaceEstimator.getGroundHeightAt(nx, nz) + 0.035;

            node.position.set(nx, ny, nz);

            // Pulsing light wave traveling forward along the path
            const wavePhase = (elapsedTime * 3.5 - idx * 0.25) % (Math.PI * 2);
            const intensity = Math.sin(wavePhase);
            const scale = intensity > 0.4 ? 1.4 : 1.0;
            node.scale.set(scale, scale, scale);

            if (node.material instanceof THREE.MeshBasicMaterial) {
              node.material.opacity = 0.4 + Math.max(0, intensity) * 0.55;
            }
          });

          // Beacon at horizon
          const beaconDist = 6.8;
          const bx = dirX * beaconDist;
          const bz = dirZ * beaconDist;
          const by = surfaceEstimator.getGroundHeightAt(bx, bz);
          beaconGroup.position.set(bx, by, bz);
          beaconOrb.rotation.y += delta * 1.5;
        }
      }

      renderer.render(scene, camera);
    };
    animate();

    const handleResize = () => {
      if (!container || !rendererRef.current || !camera3dRef.current) return;
      const newWidth = container.clientWidth;
      const newHeight = container.clientHeight;
      camera3dRef.current.aspect = newWidth / newHeight;
      camera3dRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(newWidth, newHeight);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (animFrameIdRef.current) cancelAnimationFrame(animFrameIdRef.current);
      renderer.dispose();
      container.innerHTML = '';
    };
  }, [
    buildArtifactMesh,
    isAutoRotating,
    selectedArtifact,
    showSurfaceGrid,
    pathfindingActive,
    bearingDegrees,
    deviceCompassHeading,
  ]);

  // Update 3D Mesh when Selected Artifact Changes
  useEffect(() => {
    if (!sceneRef.current) return;
    if (artifactGroupRef.current) {
      sceneRef.current.remove(artifactGroupRef.current);
    }
    const newMesh = buildArtifactMesh(selectedArtifact);
    newMesh.scale.setScalar(artifactScale);
    sceneRef.current.add(newMesh);
    artifactGroupRef.current = newMesh;

    physicsStateRef.current.currentY = 0.5;
    physicsStateRef.current.velocityY = 0;
    physicsStateRef.current.isResting = false;
    setIsRestingOnGround(false);

    if (reticleMeshRef.current) {
      (reticleMeshRef.current.material as THREE.MeshBasicMaterial).color.set(selectedArtifact.color);
    }

    setArtifactScale(selectedArtifact.defaultScale);
    setPinchScaleDisplay(selectedArtifact.defaultScale);
  }, [selectedArtifact, buildArtifactMesh, artifactScale]);

  // Render Cloud-Anchored World Artifacts into the 3D scene
  useEffect(() => {
    if (!worldMarkersGroupRef.current) return;
    const group = worldMarkersGroupRef.current;
    while (group.children.length > 0) {
      group.remove(group.children[0]);
    }

    nearbyWorldArtifacts.slice(0, 8).forEach((worldArt, idx) => {
      const angle = (idx * (Math.PI * 2)) / Math.min(8, nearbyWorldArtifacts.length);
      const radius = 2.4 + (idx % 3) * 0.7;
      const wx = Math.sin(angle) * radius;
      const wz = -Math.cos(angle) * radius;

      const marker = new THREE.Group();
      marker.position.set(wx, 0.05, wz);

      const pillarGeo = new THREE.CylinderGeometry(0.04, 0.04, 1.8, 16);
      const pillarMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.65 });
      const pillar = new THREE.Mesh(pillarGeo, pillarMat);
      pillar.position.y = 0.9;

      const orbGeo = new THREE.SphereGeometry(0.18, 16, 16);
      const orbMat = new THREE.MeshStandardMaterial({ color: 0x38bdf8, emissive: 0x0284c7, emissiveIntensity: 0.8, roughness: 0.2 });
      const orb = new THREE.Mesh(orbGeo, orbMat);
      orb.position.y = 1.9;

      marker.add(pillar, orb);
      group.add(marker);
    });
  }, [nearbyWorldArtifacts]);

  // Synchronize Shared-View Peer Real-Time 3D Artifacts into the 3D scene
  useEffect(() => {
    if (!sharedSessionGroupRef.current) return;
    const group = sharedSessionGroupRef.current;

    while (group.children.length > 0) {
      const child = group.children[0];
      group.remove(child);
      child.traverse((c) => {
        if (c instanceof THREE.Mesh) {
          c.geometry?.dispose();
          if (Array.isArray(c.material)) {
            c.material.forEach((m) => m.dispose());
          } else {
            c.material?.dispose();
          }
        }
      });
    }

    if (sharedPlacedArtifacts && sharedPlacedArtifacts.length > 0) {
      sharedPlacedArtifacts.forEach((item) => {
        const matchingLore =
          ACOUSTIC_LORE_ARTIFACTS.find((a) => a.id === item.artifactId) || selectedArtifact;
        const mesh = buildArtifactMesh(matchingLore);
        mesh.scale.setScalar(item.scale || 1.0);
        mesh.position.set(item.posX, item.posY, item.posZ);
        mesh.rotation.y = item.rotationY || 0;

        // Shared peer aura ring around artifact
        const ringGeo = new THREE.RingGeometry(0.7 * (item.scale || 1), 0.78 * (item.scale || 1), 32);
        const ringMat = new THREE.MeshBasicMaterial({
          color: 0x06b6d4,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.85,
        });
        const ringMesh = new THREE.Mesh(ringGeo, ringMat);
        ringMesh.rotation.x = -Math.PI / 2;
        ringMesh.position.y = 0.01;
        mesh.add(ringMesh);

        // Contact shadow
        const shadowGeo = new THREE.CircleGeometry(0.85 * (item.scale || 1), 24);
        const shadowMat = new THREE.MeshBasicMaterial({
          color: 0x000000,
          transparent: true,
          opacity: 0.5,
          depthWrite: false,
        });
        const shadowMesh = new THREE.Mesh(shadowGeo, shadowMat);
        shadowMesh.rotation.x = -Math.PI / 2;
        shadowMesh.position.set(item.posX, item.posY + 0.004, item.posZ);

        group.add(mesh);
        group.add(shadowMesh);
      });
    }
  }, [sharedPlacedArtifacts, buildArtifactMesh, selectedArtifact]);

  // 5. Tap-To-Place Raycasting with Surface Estimation Collision & Session Stacking
  const handleTapToPlace = useCallback(
    (clientX: number, clientY: number) => {
      if (!mountRef.current || !camera3dRef.current || !sceneRef.current) return;

      const rect = mountRef.current.getBoundingClientRect();
      const relX = clientX - rect.left;
      const relY = clientY - rect.top;
      const x = (relX / rect.width) * 2 - 1;
      const y = -(relY / rect.height) * 2 + 1;

      // Visual Haptic-like Pulse Ripple on Screen
      triggerVisualHaptic(
        'tap-to-place',
        relX,
        relY,
        `HAPTIC PULSE • ${selectedArtifact.name.toUpperCase()} ANCHORED`,
        selectedArtifact.color
      );
      triggerHaptic([40, 70]);

      setTapRipplePos({ x: relX, y: relY });
      setTimeout(() => setTapRipplePos(null), 700);

      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(new THREE.Vector2(x, y), camera3dRef.current);

      const p = surfaceEstimator.getGroundPlane();
      const plane = new THREE.Plane(new THREE.Vector3(p.normal.x, p.normal.y, p.normal.z), -p.planeY);
      const hitPoint = new THREE.Vector3();
      raycaster.ray.intersectPlane(plane, hitPoint);

      if (hitPoint) {
        const groundHeight = surfaceEstimator.getGroundHeightAt(hitPoint.x, hitPoint.z);

        // 1. Reposition floating cursor preview with physics drop
        physicsStateRef.current.posX = hitPoint.x;
        physicsStateRef.current.posZ = hitPoint.z;
        physicsStateRef.current.currentY = groundHeight + 0.45;
        physicsStateRef.current.velocityY = 0;
        physicsStateRef.current.isResting = false;
        setIsRestingOnGround(false);

        // 2. Build 3D mesh instance for the placed artifact in session
        const placedMesh = buildArtifactMesh(selectedArtifact);
        placedMesh.scale.setScalar(artifactScale);
        placedMesh.position.set(hitPoint.x, groundHeight, hitPoint.z);
        placedMesh.rotation.y = artifactGroupRef.current?.rotation.y || 0;
        placedMesh.rotation.x = p.normal.z * 0.15;
        placedMesh.rotation.z = -p.normal.x * 0.15;

        // Contact shadow for placed mesh
        const shadowGeo = new THREE.CircleGeometry(0.85 * artifactScale, 24);
        const shadowMat = new THREE.MeshBasicMaterial({
          color: 0x000000,
          transparent: true,
          opacity: 0.55,
          depthWrite: false,
        });
        const shadowMesh = new THREE.Mesh(shadowGeo, shadowMat);
        shadowMesh.rotation.x = -Math.PI / 2;
        shadowMesh.position.set(hitPoint.x, groundHeight + 0.005, hitPoint.z);

        if (sessionPlacedGroupRef.current) {
          sessionPlacedGroupRef.current.add(placedMesh);
          sessionPlacedGroupRef.current.add(shadowMesh);
        }

        const placedId = `session-${selectedArtifact.id}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
        sessionPlacedMeshesRef.current.set(placedId, { mesh: placedMesh, shadowMesh });

        const newPlacedItem: SessionPlacedArtifact = {
          id: placedId,
          artifactId: selectedArtifact.id,
          artifactName: selectedArtifact.name,
          category: selectedArtifact.category,
          color: selectedArtifact.color,
          posX: hitPoint.x,
          posY: groundHeight,
          posZ: hitPoint.z,
          scale: artifactScale,
          rotationY: placedMesh.rotation.y,
          timestamp: Date.now(),
          frequencyNote: selectedArtifact.frequencyNote,
          soundscapeId: selectedArtifact.soundscapeId,
        };

        setSessionPlacedArtifacts((prev) => {
          const next = [...prev, newPlacedItem];
          onSessionPlacedChange?.(next.length, selectedArtifact.name, handleUndoLastPlaced, next);
          return next;
        });

        soundscapeEngine.playSoundscape(selectedArtifact.soundscapeId, 0.45);
        setSoundscapePlaying(true);

        onShowToast(`✨ Placed "${selectedArtifact.name}" in AR (Tap Undo to remove)`, 'view_in_ar');
      }
    },
    [
      selectedArtifact,
      artifactScale,
      buildArtifactMesh,
      onShowToast,
      onSessionPlacedChange,
      triggerVisualHaptic,
    ]
  );

  // 6. Undo Most Recently Placed 3D AR Artifact from Current Session
  const handleUndoLastPlaced = useCallback(() => {
    if (sessionPlacedArtifacts.length === 0) {
      triggerHaptic('light');
      onShowToast('No placed artifacts in current session to undo.', 'info');
      return;
    }

    const lastItem = sessionPlacedArtifacts[sessionPlacedArtifacts.length - 1];

    // Trigger visual haptic ripple for undo at center of viewport
    if (mountRef.current) {
      const rect = mountRef.current.getBoundingClientRect();
      triggerVisualHaptic(
        'undo',
        rect.width / 2,
        rect.height / 2,
        `UNDO • REMOVED ${lastItem.artifactName.toUpperCase()}`,
        '#f59e0b'
      );
    }
    triggerHaptic([60, 40]);

    // Remove from Three.js scene
    const meshRecord = sessionPlacedMeshesRef.current.get(lastItem.id);
    if (meshRecord && sessionPlacedGroupRef.current) {
      sessionPlacedGroupRef.current.remove(meshRecord.mesh);
      sessionPlacedGroupRef.current.remove(meshRecord.shadowMesh);

      // Clean up geometries and materials
      meshRecord.mesh.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.geometry?.dispose();
          if (Array.isArray(child.material)) {
            child.material.forEach((m) => m.dispose());
          } else {
            child.material?.dispose();
          }
        }
      });
      meshRecord.shadowMesh.geometry?.dispose();
      (meshRecord.shadowMesh.material as THREE.Material)?.dispose();

      sessionPlacedMeshesRef.current.delete(lastItem.id);
    }

    const nextList = sessionPlacedArtifacts.slice(0, -1);
    setSessionPlacedArtifacts(nextList);
    const lastRemainingName = nextList.length > 0 ? nextList[nextList.length - 1].artifactName : undefined;
    onSessionPlacedChange?.(nextList.length, lastRemainingName, handleUndoLastPlaced, nextList);

    onShowToast(
      `↩ Removed "${lastItem.artifactName}" (Undo successful. ${nextList.length} placed)`,
      'undo'
    );
  }, [sessionPlacedArtifacts, onShowToast, onSessionPlacedChange, triggerVisualHaptic]);

  // Expose Undo via props
  useEffect(() => {
    onRegisterUndo?.(handleUndoLastPlaced);
  }, [handleUndoLastPlaced, onRegisterUndo]);

  // Global Keyboard shortcut for Undo (Ctrl+Z, Cmd+Z, or 'u')
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        handleUndoLastPlaced();
      } else if (e.key.toLowerCase() === 'u' && !['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) {
        handleUndoLastPlaced();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleUndoLastPlaced]);

  // 7. Multi-Touch Gestures with Visual Haptic-like Pulse Ripples
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && mountRef.current) {
      const rect = mountRef.current.getBoundingClientRect();
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      const dist = Math.hypot(touch1.clientX - touch2.clientX, touch1.clientY - touch2.clientY);
      touchStartDistRef.current = dist;
      touchStartScaleRef.current = artifactScale;
      setIsPinching(true);

      const midX = (touch1.clientX + touch2.clientX) / 2 - rect.left;
      const midY = (touch1.clientY + touch2.clientY) / 2 - rect.top;

      // Trigger Visual Haptic Pulse Ripple on Screen for Pinch Initiation
      triggerVisualHaptic(
        'pinch-scale-init',
        midX,
        midY,
        `HAPTIC PULSE • PINCH-TO-SCALE INITIATED`,
        '#06b6d4',
        { x: touch1.clientX - rect.left, y: touch1.clientY - rect.top },
        { x: touch2.clientX - rect.left, y: touch2.clientY - rect.top }
      );
      triggerHaptic('light');
    } else if (e.touches.length === 1) {
      isDraggingRef.current = true;
      lastPointerPosRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && touchStartDistRef.current !== null && mountRef.current) {
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      const currentDist = Math.hypot(touch1.clientX - touch2.clientX, touch1.clientY - touch2.clientY);
      const ratio = currentDist / touchStartDistRef.current;
      const newScale = Math.max(0.3, Math.min(3.5, touchStartScaleRef.current * ratio));

      setArtifactScale(Number(newScale.toFixed(2)));
      setPinchScaleDisplay(Number(newScale.toFixed(2)));
      physicsStateRef.current.scale = newScale;

      // Check scale milestone crossings (every 0.5x tick) for subtle visual haptic pulse tick
      const roundedHalf = Math.round(newScale * 2) / 2;
      if (Math.abs(roundedHalf - lastScaleMilestoneRef.current) >= 0.5) {
        lastScaleMilestoneRef.current = roundedHalf;
        const rect = mountRef.current.getBoundingClientRect();
        const midX = (touch1.clientX + touch2.clientX) / 2 - rect.left;
        const midY = (touch1.clientY + touch2.clientY) / 2 - rect.top;
        triggerVisualHaptic('pinch-tick', midX, midY, `${roundedHalf.toFixed(1)}x SCALE TICK`, '#f59e0b');
        triggerHaptic('light');
      }
    } else if (e.touches.length === 1 && isDraggingRef.current && lastPointerPosRef.current) {
      const dx = e.touches[0].clientX - lastPointerPosRef.current.x;
      if (artifactGroupRef.current) {
        artifactGroupRef.current.rotation.y += dx * 0.015;
      }
      lastPointerPosRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (e.touches.length < 2) {
      touchStartDistRef.current = null;
      setIsPinching(false);
    }
    if (e.touches.length === 0) {
      isDraggingRef.current = false;
      lastPointerPosRef.current = null;
    }
  };

  const handleCanvasClick = (e: React.MouseEvent) => {
    handleTapToPlace(e.clientX, e.clientY);
  };

  const handleWheelZoom = (e: React.WheelEvent) => {
    e.stopPropagation();
    const zoomDelta = e.deltaY * -0.0015;
    const newScale = Math.max(0.3, Math.min(3.5, artifactScale + zoomDelta));
    setArtifactScale(Number(newScale.toFixed(2)));
    setPinchScaleDisplay(Number(newScale.toFixed(2)));
    physicsStateRef.current.scale = newScale;
  };

  // 7. Cloud Anchor Action
  const handleConfirmAnchorAndShare = async () => {
    const lat = userCoords?.lat || 13.0336;
    const lng = userCoords?.lng || 80.2694;
    setIsSyncingCloud(true);
    triggerHaptic([50, 100, 200]);

    const groundHeight = surfaceEstimator.getGroundHeightAt(
      physicsStateRef.current.posX,
      physicsStateRef.current.posZ
    );

    const worldAnchor: Anchored3dArtifact = {
      id: `world-${selectedArtifact.id}-${Date.now()}`,
      artifactId: selectedArtifact.id,
      artifactName: selectedArtifact.name,
      lat,
      lng,
      altitude: 12,
      accuracy: gpsAccuracy || 3,
      placeName: nearestSpotName,
      zone: 'Chennai Chrono-Grid',
      scale: artifactScale,
      rotationY: artifactGroupRef.current?.rotation.y || 0,
      posX: physicsStateRef.current.posX,
      posY: groundHeight,
      posZ: physicsStateRef.current.posZ,
      surfaceY: groundHeight,
      surfacePitch: surfacePlane.pitchDeg,
      surfaceRoll: surfacePlane.rollDeg,
      isRestingOnGround: true,
      placedByUserId: user?.uid || 'anon-explorer',
      placedByUserName: user?.displayName || user?.email?.split('@')[0] || 'Madras Explorer',
      anchoredAt: new Date().toISOString(),
      notes: explorerInscription || selectedArtifact.lore,
      resonancesCount: 1,
      soundscapeId: selectedArtifact.soundscapeId,
      frequencyNote: selectedArtifact.frequencyNote,
    };

    try {
      await saveWorldArtifact(worldAnchor);
      setShowInscriptionPrompt(false);
      setExplorerInscription('');

      soundscapeEngine.playSoundscape(selectedArtifact.soundscapeId, 0.5);
      setSoundscapePlaying(true);

      onShowToast(
        `✨ Anchored & Published to Cloud GPS Grid! Visible to all nearby explorers at ${lat.toFixed(4)}°N, ${lng.toFixed(4)}°E.`,
        'public'
      );
    } catch (err: any) {
      console.warn('Failed to save to cloud coordinate persistence layer:', err);
      onShowToast('Saved locally. Cloud sync will retry on connection.', 'cloud_done');
    } finally {
      setIsSyncingCloud(false);
    }
  };

  // 8. Resonate Action
  const handleResonateWithWorldArtifact = async (art: Anchored3dArtifact) => {
    triggerHaptic([40, 80, 140]);
    if (art.soundscapeId) {
      soundscapeEngine.playSoundscape(art.soundscapeId as any, 0.5);
      setSoundscapePlaying(true);
    }
    await resonateWithWorldArtifact(art.id);
    onShowToast(`Resonated with "${art.artifactName}" placed by ${art.placedByUserName}! 💖`, 'favorite');
  };

  // 9. Audio Toggle
  const handleToggleSoundscape = () => {
    triggerHaptic('medium');
    if (soundscapePlaying) {
      soundscapeEngine.stop();
      setSoundscapePlaying(false);
      onShowToast('Ambient acoustic resonance paused', 'volume_off');
    } else {
      soundscapeEngine.playSoundscape(selectedArtifact.soundscapeId, 0.5);
      setSoundscapePlaying(true);
      onShowToast(`Playing ${selectedArtifact.soundscapeName} 🎵`, 'graphic_eq');
    }
  };

  // 10. Screenshot Capture with Pathfinding HUD
  const handleCaptureArScene = async () => {
    triggerHaptic([60, 120, 200]);
    setShutterFlash(true);
    setTimeout(() => setShutterFlash(false), 280);

    try {
      const video = videoRef.current;
      const threeRenderer = rendererRef.current;
      if (!threeRenderer) throw new Error('3D renderer not ready');

      const canvas = document.createElement('canvas');
      const width = mountRef.current?.clientWidth || 720;
      const height = mountRef.current?.clientHeight || 1280;
      canvas.width = width * 2;
      canvas.height = height * 2;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('2D context failed');

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';

      // 1. Video stream
      if (video && cameraActive && video.videoWidth > 0) {
        const videoRatio = video.videoWidth / video.videoHeight;
        const canvasRatio = canvas.width / canvas.height;
        let sx = 0, sy = 0, sw = video.videoWidth, sh = video.videoHeight;

        if (videoRatio > canvasRatio) {
          sw = video.videoHeight * canvasRatio;
          sx = (video.videoWidth - sw) / 2;
        } else {
          sh = video.videoWidth / canvasRatio;
          sy = (video.videoHeight - sh) / 2;
        }
        ctx.drawImage(video, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
      } else {
        const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
        grad.addColorStop(0, '#1a1618');
        grad.addColorStop(0.5, '#2b1c14');
        grad.addColorStop(1, '#0e0e11');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }

      // 2. Draw 3D WebGL Scene
      ctx.drawImage(threeRenderer.domElement, 0, 0, canvas.width, canvas.height);

      // 3. Render Cyber-Heritage Telemetry HUD Watermark
      const lat = userCoords?.lat || 13.0336;
      const lng = userCoords?.lng || 80.2694;
      const timestamp = new Date().toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });

      ctx.fillStyle = 'rgba(18, 17, 20, 0.82)';
      ctx.fillRect(24, 24, canvas.width - 48, 86);
      ctx.strokeStyle = 'rgba(240, 84, 35, 0.65)';
      ctx.lineWidth = 2;
      ctx.strokeRect(24, 24, canvas.width - 48, 86);

      ctx.fillStyle = '#F05423';
      ctx.font = 'bold 24px "Plus Jakarta Sans", sans-serif';
      ctx.fillText('KAOS // AR GROUND PATHFINDING & COLLISION HUD', 48, 58);

      ctx.fillStyle = '#06b6d4';
      ctx.font = 'bold 16px monospace';
      ctx.fillText(`TARGET: ${activeNavTarget.name} • ${distanceFormatted} • BEARING: ${bearingDegrees}° ${cardinalDirection}`, 48, 84);

      ctx.textAlign = 'right';
      ctx.fillStyle = '#a1a1aa';
      ctx.font = 'bold 16px monospace';
      ctx.fillText(`GPS: ${lat.toFixed(4)}°N, ${lng.toFixed(4)}°E`, canvas.width - 48, 58);
      ctx.fillText(timestamp, canvas.width - 48, 84);
      ctx.textAlign = 'left';

      ctx.fillStyle = 'rgba(18, 17, 20, 0.88)';
      ctx.fillRect(24, canvas.height - 180, canvas.width - 48, 150);
      ctx.strokeStyle = selectedArtifact.accentHex || '#F05423';
      ctx.lineWidth = 3;
      ctx.strokeRect(24, canvas.height - 180, canvas.width - 48, 150);

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 28px "Plus Jakarta Sans", sans-serif';
      ctx.fillText(selectedArtifact.name, 48, canvas.height - 134);

      ctx.fillStyle = selectedArtifact.color;
      ctx.font = 'bold 18px monospace';
      ctx.fillText(`FREQUENCY: ${selectedArtifact.frequencyNote} • GROUND RESTING`, 48, canvas.height - 100);

      ctx.fillStyle = '#d4d4d8';
      ctx.font = '16px "Plus Jakarta Sans", sans-serif';
      ctx.fillText(`${selectedArtifact.historicalEra} • Placed by ${user?.displayName || 'Explorer'}`, 48, canvas.height - 68);

      canvas.toBlob(async (blob) => {
        if (!blob) throw new Error('Blob export failed');

        const fileName = `KAOS_AR_${selectedArtifact.name.replace(/\s+/g, '_')}_${Date.now()}.png`;
        const dataUrl = canvas.toDataURL('image/png');
        setCapturedScreenshot(dataUrl);

        const link = document.createElement('a');
        link.download = fileName;
        link.href = dataUrl;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        const file = new File([blob], fileName, { type: 'image/png' });
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          try {
            await navigator.share({
              title: `KAOS AR: ${selectedArtifact.name}`,
              text: `Discovered and anchored ${selectedArtifact.name} on real-world ground in Chennai!`,
              files: [file],
            });
          } catch (shareErr) {}
        }

        onShowToast(`Saved AR scene screenshot directly to local device gallery! 📸`, 'download_done');
      }, 'image/png');
    } catch (err: any) {
      console.warn('AR screenshot failed:', err);
      onShowToast('Screenshot capture failed. Please check permissions.', 'error');
    }
  };

  return (
    <div className="relative w-full rounded-3xl overflow-hidden bg-[#121114] border-2 border-orange-500/50 shadow-2xl flex flex-col">
      {/* 1. TOP AR HUD BAR */}
      <div className="absolute top-0 left-0 right-0 z-30 p-3 sm:p-4 bg-gradient-to-b from-[#121114]/90 via-[#121114]/50 to-transparent flex items-center justify-between pointer-events-auto">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-orange-600/30 text-orange-400 border border-orange-500/40 flex items-center justify-center">
            <span className="material-symbols-outlined text-[18px]">view_in_ar</span>
          </div>
          <div>
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[10px] font-mono font-bold text-orange-400 uppercase tracking-widest">
                AR PATHFINDING & GROUND GRID
              </span>
              <span className="px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-400 text-[8px] font-mono font-bold">
                {surfacePlane.trackingState.toUpperCase()}
              </span>
            </div>
            <span className="text-[11px] text-zinc-200 font-bold block truncate max-w-[180px] sm:max-w-xs">
              {selectedArtifact.name}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Undo Last Placed 3D AR Artifact Button Overlay */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleUndoLastPlaced();
            }}
            disabled={sessionPlacedArtifacts.length === 0}
            className={`px-2.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer border shadow ${
              sessionPlacedArtifacts.length > 0
                ? 'bg-amber-600/30 text-amber-300 border-amber-500/80 hover:bg-amber-600/50 ring-1 ring-amber-400/40 active:scale-95'
                : 'bg-[#1a1a1e]/60 text-zinc-500 border-[#26262b] cursor-not-allowed opacity-40'
            }`}
            title={
              sessionPlacedArtifacts.length > 0
                ? `Undo last placed "${sessionPlacedArtifacts[sessionPlacedArtifacts.length - 1].artifactName}" (Ctrl+Z)`
                : 'No placed artifacts in current session to undo'
            }
          >
            <span className="material-symbols-outlined text-[15px]">undo</span>
            <span className="text-[10px]">Undo</span>
            {sessionPlacedArtifacts.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-amber-400 text-black text-[8px] font-mono font-bold">
                {sessionPlacedArtifacts.length}
              </span>
            )}
          </button>

          {/* Shared-View Local Session Mode Button */}
          <button
            onClick={() => {
              triggerHaptic('light');
              onOpenSharedView?.();
            }}
            className={`px-2.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer border shadow ${
              isSharedViewActive
                ? 'bg-cyan-600/30 text-cyan-300 border-cyan-500/80 ring-1 ring-cyan-400/40 animate-pulse'
                : 'bg-[#1a1a1e]/80 text-zinc-300 border-[#26262b] hover:text-white'
            }`}
            title={isSharedViewActive ? `Shared-View Live: ${sharedSessionCode}` : 'Open Shared-View AR Session'}
          >
            <span className="material-symbols-outlined text-[15px]">group_work</span>
            <span className="hidden sm:inline text-[10px]">
              {isSharedViewActive ? sharedSessionCode : 'Shared-View'}
            </span>
            {isSharedViewActive && (
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
            )}
          </button>

          {/* Artifact Inventory Button */}
          <button
            onClick={() => {
              triggerHaptic('light');
              setInventoryModalOpen(true);
            }}
            className="px-2.5 py-1.5 rounded-xl bg-gradient-to-r from-orange-600/30 to-amber-600/30 hover:from-orange-600/50 hover:to-amber-600/50 text-orange-300 border border-orange-500/50 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow"
            title="Open 3D Artifact Inventory Browser"
          >
            <span className="material-symbols-outlined text-[15px]">backpack</span>
            <span className="hidden sm:inline text-[10px]">Inventory</span>
          </button>

          {/* Glowing Breadcrumbs Pathfinding Toggle */}
          <button
            onClick={() => {
              setPathfindingActive(!pathfindingActive);
              triggerHaptic('light');
              onShowToast(
                !pathfindingActive ? `AR Pathfinding line active toward ${activeNavTarget.name}` : 'Breadcrumbs hidden',
                'near_me'
              );
            }}
            className={`px-2.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer border ${
              pathfindingActive
                ? 'bg-cyan-600/30 text-cyan-300 border-cyan-500/60 shadow-md ring-1 ring-cyan-500/40'
                : 'bg-[#1a1a1e]/80 text-zinc-400 border-[#26262b]'
            }`}
            title="Toggle Glowing Breadcrumb Trail on Ground"
          >
            <span className="material-symbols-outlined text-[15px]">near_me</span>
            <span className="hidden sm:inline text-[10px]">Trail</span>
          </button>

          {/* Surface Grid Toggle */}
          <button
            onClick={() => {
              setShowSurfaceGrid(!showSurfaceGrid);
              triggerHaptic('light');
            }}
            className={`px-2.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer border ${
              showSurfaceGrid
                ? 'bg-orange-600/30 text-orange-300 border-orange-500/50'
                : 'bg-[#1a1a1e]/80 text-zinc-400 border-[#26262b]'
            }`}
            title="Toggle Ground Surface Detection Grid"
          >
            <span className="material-symbols-outlined text-[15px]">grid_4x4</span>
          </button>

          {/* Soundscape Audio Toggle */}
          <button
            onClick={handleToggleSoundscape}
            className={`px-2.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer border ${
              soundscapePlaying
                ? 'bg-orange-600 text-white border-orange-500 shadow-md'
                : 'bg-[#1a1a1e]/80 text-zinc-300 border-[#26262b] hover:text-white'
            }`}
            title="Toggle Acoustic Lore Soundscape"
          >
            <span className="material-symbols-outlined text-[15px]">
              {soundscapePlaying ? 'graphic_eq' : 'volume_up'}
            </span>
          </button>

          {onClose && (
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-xl bg-[#1a1a1e]/80 text-zinc-400 hover:text-white flex items-center justify-center border border-[#26262b] cursor-pointer"
            >
              <span className="material-symbols-outlined text-[16px]">close</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. MAIN AR CAMERA & 3D VIEWPORT CONTAINER */}
      <div
        className="relative w-full h-[460px] sm:h-[540px] overflow-hidden select-none bg-black cursor-crosshair touch-none"
        onWheel={handleWheelZoom}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={handleCanvasClick}
      >
        <video
          ref={videoRef}
          playsInline
          autoPlay
          muted
          className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-500 ${
            cameraActive ? 'opacity-100' : 'opacity-0'
          }`}
        />

        {!cameraActive && (
          <div className="absolute inset-0 bg-gradient-to-b from-[#18161e] via-[#201512] to-[#0f0e13] flex flex-col items-center justify-center p-6 text-center">
            <div className="w-16 h-16 rounded-3xl bg-orange-600/10 border border-orange-500/30 flex items-center justify-center text-orange-400 mb-3 animate-pulse">
              <span className="material-symbols-outlined text-[32px]">photo_camera</span>
            </div>
            <h4 className="text-sm font-bold text-white mb-1">AR Ground Pathfinding & Surface Active</h4>
            <p className="text-xs text-zinc-400 max-w-sm">
              {cameraError || 'Camera view active with real-world ground collision & glowing pathfinding breadcrumbs.'}
            </p>
          </div>
        )}

        {/* Three.js 3D WebGL Canvas Layer */}
        <div ref={mountRef} className="absolute inset-0 pointer-events-none z-10" />

        {/* Shutter White Flash effect */}
        {shutterFlash && (
          <div className="absolute inset-0 bg-white pointer-events-none z-50 animate-fade-out" />
        )}

        {/* Ground Collision Impact Flash */}
        {collisionImpactFlash && (
          <div className="absolute inset-0 bg-emerald-500/15 pointer-events-none z-40 transition-opacity duration-200" />
        )}

        {/* VISUAL HAPTIC PULSE RIPPLE & TACTILE HUD FEEDBACK OVERLAY */}
        {visualHapticEvent && (
          <div
            key={visualHapticEvent.id}
            className="absolute pointer-events-none z-30 -translate-x-1/2 -translate-y-1/2"
            style={{ left: visualHapticEvent.x, top: visualHapticEvent.y }}
          >
            {/* Primary expanding high-contrast tactile ripple */}
            <div
              className="w-20 h-20 rounded-full border-2 animate-haptic-ripple shadow-lg"
              style={{
                borderColor: visualHapticEvent.color || '#f05423',
                boxShadow: `0 0 24px ${visualHapticEvent.color || '#f05423'}`,
              }}
            />

            {/* Secondary concentric shockwave */}
            <div
              className="w-14 h-14 rounded-full border border-dashed animate-haptic-wave-2 absolute top-3 left-3"
              style={{
                borderColor: visualHapticEvent.type === 'pinch-scale-init' ? '#38bdf8' : '#fbbf24',
              }}
            />

            {/* Core center micro-dot with pulse */}
            <div
              className="w-3.5 h-3.5 rounded-full absolute top-8.5 left-8.5 animate-ping"
              style={{ backgroundColor: visualHapticEvent.color || '#f05423' }}
            />

            {/* If pinch: show touch line and twin anchor rings */}
            {visualHapticEvent.touch1 && visualHapticEvent.touch2 && (
              <div className="absolute inset-0 pointer-events-none">
                <div
                  className="w-6 h-6 rounded-full border-2 border-cyan-400 absolute animate-ping -translate-x-1/2 -translate-y-1/2"
                  style={{
                    left: visualHapticEvent.touch1.x - visualHapticEvent.x,
                    top: visualHapticEvent.touch1.y - visualHapticEvent.y,
                  }}
                />
                <div
                  className="w-6 h-6 rounded-full border-2 border-cyan-400 absolute animate-ping -translate-x-1/2 -translate-y-1/2"
                  style={{
                    left: visualHapticEvent.touch2.x - visualHapticEvent.x,
                    top: visualHapticEvent.touch2.y - visualHapticEvent.y,
                  }}
                />
              </div>
            )}

            {/* Visual Haptic Micro-Badge HUD */}
            {visualHapticEvent.label && (
              <div className="absolute top-0 left-1/2 whitespace-nowrap animate-haptic-badge pointer-events-none">
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/90 border border-white/20 text-[10px] font-mono font-bold shadow-xl backdrop-blur-md text-white">
                  <span
                    className="w-2 h-2 rounded-full animate-pulse"
                    style={{ backgroundColor: visualHapticEvent.color || '#f05423' }}
                  />
                  <span>{visualHapticEvent.label}</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Dynamic Scale & Pinch HUD Indicator */}
        {isPinching && (
          <div className="absolute top-16 left-1/2 -translate-x-1/2 z-30 px-3 py-1 rounded-full bg-black/80 border border-orange-500 text-orange-400 text-xs font-mono font-bold shadow-lg">
            PINCH SCALE: {pinchScaleDisplay}x
          </div>
        )}

        {/* Floating Undo Button Overlay (Visible when artifacts are placed in this session) */}
        {sessionPlacedArtifacts.length > 0 && (
          <div className="absolute top-28 right-4 z-20 pointer-events-auto animate-in fade-in slide-in-from-right-3">
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleUndoLastPlaced();
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/85 backdrop-blur-md text-amber-400 border border-amber-500/70 hover:bg-amber-950/40 text-xs font-bold shadow-xl active:scale-95 transition-all cursor-pointer ring-1 ring-amber-500/40"
              title="Instantly remove most recently placed 3D artifact (Ctrl+Z)"
            >
              <span className="material-symbols-outlined text-[16px]">undo</span>
              <span>Undo Placement</span>
              <span className="w-4 h-4 rounded-full bg-amber-500 text-black text-[10px] font-bold flex items-center justify-center">
                {sessionPlacedArtifacts.length}
              </span>
            </button>
          </div>
        )}

        {/* Live Shared-View Peer Overlay Banner */}
        {isSharedViewActive && (
          <div className="absolute top-28 left-4 z-20 pointer-events-auto animate-in fade-in">
            <button
              onClick={onOpenSharedView}
              className="bg-black/85 backdrop-blur-md px-3 py-1.5 rounded-full border border-cyan-500/70 shadow-xl flex items-center gap-2 text-[11px] font-bold text-cyan-300 hover:bg-cyan-950/40 transition-all cursor-pointer ring-1 ring-cyan-400/40"
              title="Click to view Shared-View Session Details"
            >
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
              <span>SHARED-VIEW: {sharedSessionCode}</span>
              {sharedHostName && <span className="text-zinc-400 text-[10px]">(@{sharedHostName})</span>}
              <span className="text-cyan-400 font-mono text-[10px]">
                ({(sharedPlacedArtifacts?.length || 0) + sessionPlacedArtifacts.length} in AR)
              </span>
            </button>
          </div>
        )}

        {/* Glowing AR Pathfinding Breadcrumbs Banner Overlay */}
        {pathfindingActive && (
          <div className="absolute top-16 left-4 right-4 sm:right-auto z-20 pointer-events-auto">
            <div className="bg-black/80 backdrop-blur-md px-3 py-2 rounded-2xl border border-cyan-500/60 shadow-xl flex items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-cyan-500/20 text-cyan-300 flex items-center justify-center shrink-0 border border-cyan-500/40">
                  <span className="material-symbols-outlined text-[15px] animate-pulse">near_me</span>
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-white truncate max-w-[160px] sm:max-w-xs">
                      {activeNavTarget.name}
                    </span>
                    <span className="text-[10px] text-cyan-400 font-mono font-bold">
                      {distanceFormatted}
                    </span>
                  </div>
                  <span className="text-[9px] text-zinc-400 font-mono flex items-center gap-1">
                    <span>Bearing: {bearingDegrees}° ({cardinalDirection})</span>
                    <span>•</span>
                    <span className="text-cyan-400">Breadcrumbs on Ground</span>
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
              </div>
            </div>
          </div>
        )}

        {/* Interactive Gesture Help Overlay */}
        <div className="absolute bottom-4 left-4 z-20 pointer-events-none flex flex-col gap-1 text-[9px] text-zinc-400 bg-black/75 backdrop-blur-md p-2 rounded-xl border border-zinc-800">
          <span className="flex items-center gap-1">
            <span className="text-cyan-400 font-bold">✨ Glowing Trail:</span> Ground path leading to {activeNavTarget.name}
          </span>
          <span className="flex items-center gap-1">
            <span className="text-emerald-400 font-bold">🟢 Ground Collision:</span> 3D Artifact rests on surface
          </span>
          <span className="flex items-center gap-1">
            <span className="text-orange-400 font-bold">👆 Tap Ground:</span> Place artifact with visual haptic ripple
          </span>
          <span className="flex items-center gap-1">
            <span className="text-amber-400 font-bold">↩ Undo (Ctrl+Z):</span> Remove last placed AR artifact
          </span>
        </div>

        {/* Shutter Capture Button (Center-Bottom) */}
        <div className="absolute bottom-4 right-4 z-20 flex items-center gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsAutoRotating(!isAutoRotating);
              triggerHaptic('light');
            }}
            className={`p-2.5 rounded-2xl border backdrop-blur-md text-xs font-bold flex items-center justify-center transition-all cursor-pointer ${
              isAutoRotating
                ? 'bg-orange-600/30 border-orange-500 text-orange-300'
                : 'bg-black/70 border-zinc-800 text-zinc-400'
            }`}
            title="Toggle 360° Auto Rotation"
          >
            <span className="material-symbols-outlined text-[18px]">sync</span>
          </button>

          <button
            onClick={(e) => {
              e.stopPropagation();
              handleCaptureArScene();
            }}
            className="w-14 h-14 rounded-full bg-gradient-to-tr from-orange-600 to-amber-500 text-white flex items-center justify-center shadow-[0_0_20px_rgba(240,84,35,0.6)] hover:scale-105 active:scale-95 transition-all border-4 border-[#121114] cursor-pointer"
            title="Capture AR Scene to Local Device Gallery"
          >
            <span className="material-symbols-outlined text-[26px]">photo_camera</span>
          </button>
        </div>
      </div>

      {/* 3. ARTIFACT SELECTOR & INVENTORY LAUNCHER STRIP */}
      <div className="p-4 bg-[#18181c] border-t border-[#26262b] space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[16px] text-orange-400">library_music</span>
            <span className="text-xs font-bold text-white uppercase tracking-wider">
              Equipped 3D Heritage Artifact
            </span>
          </div>

          <button
            onClick={() => {
              triggerHaptic('light');
              setInventoryModalOpen(true);
            }}
            className="text-xs text-orange-400 hover:text-orange-300 font-bold flex items-center gap-1 cursor-pointer"
          >
            <span className="material-symbols-outlined text-[16px]">backpack</span>
            <span>Browse Full Artifact Inventory ({ACOUSTIC_LORE_ARTIFACTS.length})</span>
          </button>
        </div>

        {/* Carousel of 5 Acoustic Lore Artifacts */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          {ACOUSTIC_LORE_ARTIFACTS.map((artifact) => {
            const isSelected = selectedArtifact.id === artifact.id;
            return (
              <button
                key={artifact.id}
                onClick={() => {
                  setSelectedArtifact(artifact);
                  triggerHaptic('medium');
                  soundscapeEngine.playSoundscape(artifact.soundscapeId, 0.45);
                  setSoundscapePlaying(true);
                  onShowToast(`Selected ${artifact.name}`, 'view_in_ar');
                }}
                className={`p-2.5 rounded-2xl text-left transition-all border cursor-pointer flex flex-col justify-between ${
                  isSelected
                    ? 'bg-gradient-to-b from-orange-600/25 to-[#1a1618] border-orange-500 shadow-md ring-1 ring-orange-500/50'
                    : 'bg-[#121214] border-[#26262b] hover:border-zinc-700'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: artifact.color }}
                    />
                    <span className="text-[9px] font-mono text-zinc-400 truncate">
                      {artifact.category.toUpperCase()}
                    </span>
                  </div>
                  <h5 className="text-xs font-bold text-white truncate">{artifact.name}</h5>
                  <p className="text-[10px] text-zinc-400 line-clamp-1 mt-0.5">
                    {artifact.frequencyNote}
                  </p>
                </div>
                <div className="mt-2 pt-1 border-t border-zinc-800/80 flex items-center justify-between text-[9px]">
                  <span className="text-orange-400 font-semibold">{isSelected ? 'Active' : 'Select'}</span>
                  <span className="material-symbols-outlined text-[13px] text-zinc-500">
                    {isSelected ? 'check_circle' : 'chevron_right'}
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        {/* 4. REAL-WORLD GPS CLOUD ANCHORING & SCREENSHOT ACTION BAR */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 pt-1">
          <button
            onClick={() => setShowInscriptionPrompt(true)}
            disabled={isSyncingCloud}
            className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2 border border-emerald-400/40 cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">cloud_upload</span>
            <span>Anchor & Broadcast to Real-World GPS (Multi-User Cloud Grid)</span>
          </button>

          <button
            onClick={handleCaptureArScene}
            className="py-3 px-5 rounded-xl bg-orange-600 hover:bg-orange-500 text-white text-xs font-bold shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2 border border-orange-400/40 cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">download</span>
            <span>Save AR Scene to Gallery</span>
          </button>
        </div>

        {/* Inscription & Public Cloud Placement Dialog */}
        {showInscriptionPrompt && (
          <div className="bg-[#121214] p-3.5 rounded-2xl border border-emerald-500/50 space-y-2.5 animate-in fade-in">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[16px]">public</span>
                <span>Publish to Real-World GPS: {(userCoords?.lat || 13.0336).toFixed(4)}°N, {(userCoords?.lng || 80.2694).toFixed(4)}°E</span>
              </span>
              <button
                onClick={() => setShowInscriptionPrompt(false)}
                className="text-zinc-500 hover:text-white text-xs cursor-pointer"
              >
                ✕
              </button>
            </div>
            <p className="text-[11px] text-zinc-300">
              This 3D {selectedArtifact.name} will rest on the ground at this exact GPS location for all other explorers visiting {nearestSpotName}.
            </p>
            <input
              type="text"
              value={explorerInscription}
              onChange={(e) => setExplorerInscription(e.target.value)}
              placeholder="Leave an explorer inscription or acoustic field note (optional)..."
              className="w-full bg-[#18181c] text-white text-xs px-3.5 py-2.5 rounded-xl border border-zinc-700 focus:outline-none focus:border-emerald-500 transition-all placeholder:text-zinc-600"
            />
            <div className="flex items-center gap-2 pt-1">
              <button
                onClick={handleConfirmAnchorAndShare}
                disabled={isSyncingCloud}
                className="flex-1 py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer shadow"
              >
                <span className="material-symbols-outlined text-[16px]">check</span>
                <span>{isSyncingCloud ? 'Syncing to Cloud...' : 'Confirm Real-World Anchor'}</span>
              </button>
              <button
                onClick={() => setShowInscriptionPrompt(false)}
                className="py-2.5 px-3 rounded-xl bg-zinc-800 text-zinc-300 text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* 5. SHARED MULTI-USER WORLD AR ARTIFACTS IN THIS REGION */}
        {nearbyWorldArtifacts.length > 0 && (
          <div className="pt-2 border-t border-zinc-800 space-y-2">
            <div className="flex items-center justify-between text-xs text-zinc-400">
              <span className="font-bold flex items-center gap-1 text-cyan-400">
                <span className="material-symbols-outlined text-[15px]">sensors</span>
                <span>Real-World GPS Cloud Artifacts in Area ({nearbyWorldArtifacts.length})</span>
              </span>
              <span className="text-[10px] text-zinc-500 font-mono">Visible to All Explorers</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto no-scrollbar">
              {nearbyWorldArtifacts.map((art) => (
                <div
                  key={art.id}
                  onClick={() => setSelectedWorldArtifactModal(art)}
                  className="bg-[#121214] p-3 rounded-2xl border border-zinc-800 hover:border-cyan-500/50 transition-all cursor-pointer flex items-start justify-between gap-2 group"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className="material-symbols-outlined text-[15px] text-cyan-400">
                        place
                      </span>
                      <h6 className="font-headline text-xs font-bold text-white truncate">
                        {art.artifactName}
                      </h6>
                    </div>
                    <p className="text-[10px] text-zinc-400 truncate">
                      {art.placeName || nearestSpotName}
                    </p>
                    <div className="flex items-center gap-2 text-[9px] text-zinc-500 font-mono mt-1">
                      <span className="text-cyan-400 font-bold">{art.distanceFormatted} away</span>
                      <span>•</span>
                      <span>By @{art.placedByUserName}</span>
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleResonateWithWorldArtifact(art);
                      }}
                      className="px-2 py-1 rounded-lg bg-cyan-950/40 hover:bg-cyan-900/60 text-cyan-300 border border-cyan-500/40 text-[10px] font-bold flex items-center gap-1 cursor-pointer transition-all"
                    >
                      <span className="material-symbols-outlined text-[12px] text-red-400">favorite</span>
                      <span>{art.resonancesCount || 1}</span>
                    </button>
                    <span className="text-[8px] text-emerald-400 font-mono">GROUND RESTING</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 6. WORLD ARTIFACT DETAIL MODAL */}
      {selectedWorldArtifactModal && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in">
          <div className="max-w-md w-full bg-[#1A191E] rounded-3xl p-5 border border-cyan-500/50 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#26262b] pb-3">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[22px] text-cyan-400">public</span>
                <div>
                  <h4 className="font-headline text-base font-bold text-white">
                    {selectedWorldArtifactModal.artifactName}
                  </h4>
                  <span className="text-[10px] text-zinc-400 font-mono">
                    Cloud-Anchored at {selectedWorldArtifactModal.lat.toFixed(4)}°N, {selectedWorldArtifactModal.lng.toFixed(4)}°E
                  </span>
                </div>
              </div>
              <button
                onClick={() => setSelectedWorldArtifactModal(null)}
                className="text-zinc-400 hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="bg-[#121214] p-3.5 rounded-2xl border border-zinc-800 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-zinc-400">Placed by:</span>
                <span className="text-cyan-400 font-bold">@{selectedWorldArtifactModal.placedByUserName}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-zinc-400">Distance from you:</span>
                <span className="text-emerald-400 font-mono font-bold">{selectedWorldArtifactModal.distanceFormatted}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-zinc-400">Surface Physics:</span>
                <span className="text-zinc-200 font-mono text-[11px]">Resting on Ground Plane</span>
              </div>
              {selectedWorldArtifactModal.notes && (
                <div className="pt-2 border-t border-zinc-800">
                  <span className="text-[10px] text-zinc-500 uppercase tracking-wider block mb-1">Explorer Inscription</span>
                  <p className="text-xs text-zinc-200 italic bg-black/40 p-2.5 rounded-xl border border-zinc-800">
                    "{selectedWorldArtifactModal.notes}"
                  </p>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  handleResonateWithWorldArtifact(selectedWorldArtifactModal);
                  setSelectedWorldArtifactModal(null);
                }}
                className="flex-1 py-3 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow"
              >
                <span className="material-symbols-outlined text-[16px]">favorite</span>
                <span>Resonate & Ring Soundscape</span>
              </button>
              <button
                onClick={() => setSelectedWorldArtifactModal(null)}
                className="py-3 px-4 rounded-xl bg-[#26262b] hover:bg-[#32323a] text-zinc-300 text-xs font-semibold cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 7. ARTIFACT INVENTORY BROWSER MODAL */}
      <ArtifactInventoryModal
        isOpen={inventoryModalOpen}
        onClose={() => setInventoryModalOpen(false)}
        currentlyEquippedId={selectedArtifact.id}
        onSelectAndEquipArtifact={(art) => {
          setSelectedArtifact(art);
          soundscapeEngine.playSoundscape(art.soundscapeId, 0.45);
          setSoundscapePlaying(true);
        }}
        onShowToast={onShowToast}
      />

      {/* 8. SCREENSHOT SAVED PREVIEW MODAL */}
      {capturedScreenshot && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in">
          <div className="max-w-md w-full bg-[#1A191E] rounded-3xl p-5 border border-orange-500/50 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#26262b] pb-3">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[20px] text-emerald-400">check_circle</span>
                <h4 className="font-headline text-base font-bold text-white">AR Scene Captured</h4>
              </div>
              <button
                onClick={() => setCapturedScreenshot(null)}
                className="text-zinc-400 hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="rounded-2xl overflow-hidden border border-zinc-800 shadow-md">
              <img src={capturedScreenshot} alt="AR Scene Screenshot" className="w-full h-auto object-cover" />
            </div>

            <p className="text-xs text-zinc-300">
              ✅ The composite AR image with real-world camera stream, glowing ground pathfinding line to {activeNavTarget.name}, ground-resting 3D {selectedArtifact.name}, and telemetry HUD has been saved directly to your local device gallery.
            </p>

            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  const link = document.createElement('a');
                  link.download = `KAOS_AR_${selectedArtifact.name}_${Date.now()}.png`;
                  link.href = capturedScreenshot;
                  link.click();
                  triggerHaptic('light');
                }}
                className="flex-1 py-3 rounded-xl bg-orange-600 hover:bg-orange-500 text-white text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow"
              >
                <span className="material-symbols-outlined text-[16px]">file_download</span>
                <span>Download Again</span>
              </button>
              <button
                onClick={() => setCapturedScreenshot(null)}
                className="py-3 px-4 rounded-xl bg-[#26262b] hover:bg-[#32323a] text-zinc-300 text-xs font-semibold cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
