import * as THREE from 'three';
import { GroundSurfacePlane } from '../types';

export class SurfaceEstimationEngine {
  private plane: GroundSurfacePlane = {
    detected: true,
    planeY: 0.0,
    normal: { x: 0, y: 1, z: 0 },
    pitchDeg: 0,
    rollDeg: 0,
    confidence: 0.96,
    distanceMeters: 1.45,
    trackingState: 'locked',
  };

  private devicePitch: number = -15; // default comfortable viewing angle
  private deviceRoll: number = 0;
  private isGyroAvailable: boolean = false;
  private listenersAttached: boolean = false;

  constructor() {
    this.initOrientationTracking();
  }

  private initOrientationTracking() {
    if (typeof window === 'undefined') return;

    if (window.DeviceOrientationEvent && !this.listenersAttached) {
      const handleOrientation = (e: DeviceOrientationEvent) => {
        if (e.beta !== null && e.gamma !== null) {
          this.isGyroAvailable = true;
          // Beta: pitch (-180 to 180), Gamma: roll (-90 to 90)
          this.devicePitch = e.beta;
          this.deviceRoll = e.gamma;
          this.updateEstimatedPlane();
        }
      };

      try {
        window.addEventListener('deviceorientation', handleOrientation, { passive: true });
        this.listenersAttached = true;
      } catch (err) {
        console.warn('Orientation listener setup warning:', err);
      }
    }
  }

  // Updates estimated ground plane based on device orientation and camera height
  public updateEstimatedPlane(cameraHeight: number = 1.45) {
    // Normal calculation from device pitch and roll
    const pitchRad = (this.devicePitch * Math.PI) / 180;
    const rollRad = (this.deviceRoll * Math.PI) / 180;

    // Normal vector tilted by pitch & roll
    const nx = Math.sin(rollRad) * 0.15;
    const ny = Math.cos(pitchRad);
    const nz = -Math.sin(pitchRad) * 0.2;
    const len = Math.hypot(nx, ny, nz) || 1;

    // Ground plane Y estimation
    const estimatedDistance = Math.max(0.6, cameraHeight / (Math.cos(pitchRad) || 0.85));

    this.plane = {
      detected: true,
      planeY: 0.0,
      normal: { x: nx / len, y: Math.abs(ny / len), z: nz / len },
      pitchDeg: Number(this.devicePitch.toFixed(1)),
      rollDeg: Number(this.deviceRoll.toFixed(1)),
      confidence: this.isGyroAvailable ? 0.98 : 0.92,
      distanceMeters: Number(estimatedDistance.toFixed(2)),
      trackingState: 'locked',
    };

    return this.plane;
  }

  public getGroundPlane(): GroundSurfacePlane {
    return this.plane;
  }

  // Calculates exact ground plane height at position (x, z)
  public getGroundHeightAt(x: number, z: number): number {
    const { normal, planeY } = this.plane;
    if (Math.abs(normal.y) < 0.0001) return planeY;
    // Equation: nx * x + ny * (y - planeY) + nz * z = 0
    // => y = planeY - (nx * x + nz * z) / ny
    const y = planeY - (normal.x * x + normal.z * z) / normal.y;
    return Math.max(-0.25, Math.min(0.25, y));
  }

  // Check collision for a 3D bounding box against the ground plane
  public checkGroundCollision(
    box: THREE.Box3,
    currentY: number,
    posX: number,
    posZ: number
  ): {
    collided: boolean;
    penetration: number;
    restingY: number;
    targetRotation: { pitch: number; roll: number };
  } {
    const groundHeight = this.getGroundHeightAt(posX, posZ);
    const boxHeight = box.max.y - box.min.y;
    const baseOffset = box.min.y; // distance from object origin to its lowest contact point

    const restingY = groundHeight - baseOffset;
    const isBelowOrAtGround = currentY <= restingY;
    const penetration = Math.max(0, restingY - currentY);

    return {
      collided: isBelowOrAtGround,
      penetration,
      restingY,
      targetRotation: {
        pitch: this.plane.pitchDeg * 0.08,
        roll: this.plane.rollDeg * 0.08,
      },
    };
  }

  // Simulates gravity drop & settling bounce physics for an artifact
  public simulateRestingPhysics(
    state: {
      currentY: number;
      velocityY: number;
      isResting: boolean;
      scale: number;
      posX: number;
      posZ: number;
    },
    deltaSec: number
  ): {
    newY: number;
    newVelocityY: number;
    hasSettled: boolean;
    justImpacted: boolean;
  } {
    if (state.isResting) {
      const targetRestY = this.getGroundHeightAt(state.posX, state.posZ);
      return {
        newY: targetRestY,
        newVelocityY: 0,
        hasSettled: true,
        justImpacted: false,
      };
    }

    const gravity = -9.8; // m/s^2
    const restitution = 0.24; // bounce dampening
    let newVelocity = state.velocityY + gravity * deltaSec;
    let newY = state.currentY + newVelocity * deltaSec;

    const groundHeight = this.getGroundHeightAt(state.posX, state.posZ);
    let justImpacted = false;
    let hasSettled = false;

    if (newY <= groundHeight) {
      newY = groundHeight;
      if (Math.abs(newVelocity) > 0.4) {
        newVelocity = -newVelocity * restitution;
        justImpacted = true;
      } else {
        newVelocity = 0;
        hasSettled = true;
      }
    }

    return {
      newY,
      newVelocityY: newVelocity,
      hasSettled,
      justImpacted,
    };
  }
}

export const surfaceEstimator = new SurfaceEstimationEngine();
