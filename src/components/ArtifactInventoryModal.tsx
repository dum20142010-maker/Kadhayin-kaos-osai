import React, { useState, useEffect, useRef } from 'react';
import * as THREE from 'three';
import { AcousticLoreArtifact } from '../types';
import { ACOUSTIC_LORE_ARTIFACTS } from '../data/acousticLoreArtifacts';
import { soundscapeEngine } from '../lib/soundscapes';
import { triggerHaptic } from '../lib/haptic';
import { useAuth } from '../context/AuthContext';
import { db } from '../lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';

interface ArtifactInventoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectAndEquipArtifact: (artifact: AcousticLoreArtifact) => void;
  onShowToast: (msg: string, icon?: string) => void;
  currentlyEquippedId?: string;
}

export const ArtifactInventoryModal: React.FC<ArtifactInventoryModalProps> = ({
  isOpen,
  onClose,
  onSelectAndEquipArtifact,
  onShowToast,
  currentlyEquippedId = 'kapaleeshwarar-bell',
}) => {
  const { user } = useAuth();

  const [selectedArtifact, setSelectedArtifact] = useState<AcousticLoreArtifact>(() => {
    const found = ACOUSTIC_LORE_ARTIFACTS.find((a) => a.id === currentlyEquippedId);
    return found || ACOUSTIC_LORE_ARTIFACTS[0];
  });

  const [rarityFilter, setRarityFilter] = useState<string>('all');
  const [unlockedMap, setUnlockedMap] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    ACOUSTIC_LORE_ARTIFACTS.forEach((a) => {
      initial[a.id] = !!a.unlockedByDefault;
    });
    return initial;
  });

  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const previewCanvasRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const animFrameIdRef = useRef<number | null>(null);
  const modelGroupRef = useRef<THREE.Group | null>(null);

  // Load user's unlocked artifacts from Firestore
  useEffect(() => {
    if (!user?.uid) return;

    async function loadUnlocked() {
      try {
        const ref = doc(db, 'users', user!.uid, 'meta', 'inventory');
        const snap = await getDoc(ref);
        if (snap.exists() && snap.data()?.unlockedIds) {
          const ids: string[] = snap.data().unlockedIds;
          setUnlockedMap((prev) => {
            const next = { ...prev };
            ids.forEach((id) => (next[id] = true));
            return next;
          });
        }
      } catch (err) {
        console.warn('Could not load inventory unlocks:', err);
      }
    }
    loadUnlocked();
  }, [user]);

  // Build 3D Mesh for Selected Preview
  const buildMesh = (art: AcousticLoreArtifact): THREE.Group => {
    const group = new THREE.Group();
    switch (art.modelType) {
      case 'bell': {
        const mat = new THREE.MeshStandardMaterial({ color: 0xcd7f32, metalness: 0.9, roughness: 0.22 });
        const gold = new THREE.MeshStandardMaterial({ color: 0xffd700, metalness: 0.95, roughness: 0.15 });
        const lower = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.45, 1.1, 32, 1, true), mat);
        lower.position.y = 0.55;
        const crown = new THREE.Mesh(new THREE.SphereGeometry(0.46, 32, 16, 0, Math.PI * 2, 0, Math.PI * 0.5), mat);
        crown.position.y = 1.1;
        const lip = new THREE.Mesh(new THREE.TorusGeometry(0.9, 0.09, 16, 32), gold);
        lip.rotation.x = Math.PI / 2;
        lip.position.y = 0.05;
        const loop = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.05, 16, 32, Math.PI), mat);
        loop.position.y = 1.35;
        group.add(lower, crown, lip, loop);
        break;
      }
      case 'conch': {
        const pearl = new THREE.MeshStandardMaterial({ color: 0xfbfbfb, roughness: 0.28, metalness: 0.35 });
        const whorl = new THREE.Mesh(new THREE.SphereGeometry(0.65, 32, 24), pearl);
        whorl.scale.set(0.9, 1.4, 0.75);
        whorl.position.set(0, 0.75, 0);
        group.add(whorl);
        break;
      }
      case 'davarah': {
        const brass = new THREE.MeshStandardMaterial({ color: 0xdfaa22, metalness: 0.92, roughness: 0.18 });
        const saucer = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 0.55, 0.35, 32), brass);
        saucer.position.y = 0.18;
        const tumbler = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.4, 0.85, 32), brass);
        tumbler.position.y = 0.65;
        group.add(saucer, tumbler);
        break;
      }
      case 'belfry_bell': {
        const bronze = new THREE.MeshStandardMaterial({ color: 0x3d4b42, roughness: 0.45, metalness: 0.8 });
        const body = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 0.5, 1.25, 32, 1, true), bronze);
        body.position.y = 0.65;
        const cap = new THREE.Mesh(new THREE.SphereGeometry(0.52, 32, 16, 0, Math.PI * 2, 0, Math.PI * 0.45), bronze);
        cap.position.y = 1.28;
        group.add(body, cap);
        break;
      }
      case 'urn': {
        const clay = new THREE.MeshStandardMaterial({ color: 0xba4e28, roughness: 0.85, metalness: 0.08 });
        const belly = new THREE.Mesh(new THREE.SphereGeometry(0.72, 32, 24), clay);
        belly.scale.set(1, 0.85, 1);
        belly.position.y = 0.65;
        const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.28, 0.45, 24), clay);
        neck.position.y = 1.2;
        group.add(belly, neck);
        break;
      }
    }
    return group;
  };

  // Three.js 3D Preview Inspector Setup
  useEffect(() => {
    if (!isOpen || !previewCanvasRef.current) return;
    const container = previewCanvasRef.current;
    const width = container.clientWidth || 280;
    const height = container.clientHeight || 280;

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.innerHTML = '';
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 50);
    camera.position.set(0, 1.2, 3.2);
    camera.lookAt(0, 0.7, 0);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.9);
    const dirLight = new THREE.DirectionalLight(0xffeedd, 1.8);
    dirLight.position.set(3, 4, 3);
    const rimLight = new THREE.PointLight(selectedArtifact.color, 2, 5);
    rimLight.position.set(-2, 1, 2);
    scene.add(ambientLight, dirLight, rimLight);

    const meshGroup = buildMesh(selectedArtifact);
    meshGroup.scale.setScalar(selectedArtifact.defaultScale);
    scene.add(meshGroup);
    modelGroupRef.current = meshGroup;

    let clock = new THREE.Clock();
    const animate = () => {
      animFrameIdRef.current = requestAnimationFrame(animate);
      const delta = clock.getDelta();
      if (modelGroupRef.current) {
        modelGroupRef.current.rotation.y += delta * 0.8;
      }
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      if (animFrameIdRef.current) cancelAnimationFrame(animFrameIdRef.current);
      renderer.dispose();
      container.innerHTML = '';
    };
  }, [isOpen, selectedArtifact]);

  // Audio preview toggle
  const handleToggleAudio = () => {
    triggerHaptic('light');
    if (isPlayingAudio) {
      soundscapeEngine.stop();
      setIsPlayingAudio(false);
    } else {
      soundscapeEngine.playSoundscape(selectedArtifact.soundscapeId, 0.5);
      setIsPlayingAudio(true);
    }
  };

  // Unlock Artifact action (For demonstration or field claim)
  const handleUnlockArtifact = async (art: AcousticLoreArtifact) => {
    triggerHaptic([50, 100, 200]);
    const nextMap = { ...unlockedMap, [art.id]: true };
    setUnlockedMap(nextMap);

    if (user?.uid) {
      try {
        const unlockedIds = Object.keys(nextMap).filter((k) => nextMap[k]);
        await setDoc(doc(db, 'users', user.uid, 'meta', 'inventory'), { unlockedIds }, { merge: true });
      } catch (e) {
        console.warn('Error saving unlock to Firestore:', e);
      }
    }

    onShowToast(`🎉 Deciphered & Unlocked 3D ${art.name}!`, 'lock_open');
  };

  // Equip Artifact into AR Viewfinder
  const handleEquipForAr = (art: AcousticLoreArtifact) => {
    triggerHaptic('medium');
    onSelectAndEquipArtifact(art);
    onClose();
    onShowToast(`Equipped 3D ${art.name} for AR ground placement! 📍`, 'view_in_ar');
  };

  if (!isOpen) return null;

  const filteredArtifacts = ACOUSTIC_LORE_ARTIFACTS.filter((art) => {
    if (rarityFilter !== 'all' && art.rarity?.toLowerCase() !== rarityFilter.toLowerCase()) return false;
    return true;
  });

  const totalUnlocked = Object.values(unlockedMap).filter(Boolean).length;
  const isSelectedUnlocked = !!unlockedMap[selectedArtifact.id];

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-xl flex items-center justify-center p-3 sm:p-5 animate-in fade-in">
      <div className="max-w-4xl w-full bg-[#16151a] rounded-3xl border border-orange-500/40 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header Bar */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-orange-950/40 via-[#1a191f] to-[#16151a] border-b border-[#26262b] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-orange-600 to-amber-500 text-white flex items-center justify-center shadow-md">
              <span className="material-symbols-outlined text-[22px]">backpack</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-headline text-lg sm:text-xl font-bold text-white">
                  3D Heritage Artifact Inventory
                </h3>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-mono font-bold">
                  {totalUnlocked} / {ACOUSTIC_LORE_ARTIFACTS.length} Unlocked
                </span>
              </div>
              <p className="text-xs text-zinc-400">
                Preview, inspect craftsmanship, and equip authentic 3D cultural relics for real-world AR placement.
              </p>
            </div>
          </div>

          <button
            onClick={() => {
              if (isPlayingAudio) soundscapeEngine.stop();
              onClose();
            }}
            className="w-9 h-9 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white flex items-center justify-center transition-all cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Main Content: Split Inspector & Grid */}
        <div className="flex-1 overflow-y-auto no-scrollbar grid grid-cols-1 md:grid-cols-12 divide-y md:divide-y-0 md:divide-x divide-zinc-800">
          {/* Left Column: 3D Live Inspector (md:col-span-5) */}
          <div className="md:col-span-5 p-4 sm:p-5 flex flex-col items-center justify-between space-y-4 bg-[#131216]">
            {/* 3D Orbit Viewport */}
            <div className="relative w-full h-56 sm:h-64 rounded-2xl overflow-hidden bg-gradient-to-b from-[#1a1820] to-[#0d0c0f] border border-orange-500/30 flex items-center justify-center shadow-inner">
              <div ref={previewCanvasRef} className="w-full h-full cursor-grab" />

              {/* Rarity & Status Tag */}
              <div className="absolute top-3 left-3 flex items-center gap-1.5">
                <span
                  className="px-2 py-0.5 rounded-md text-[9px] font-mono font-bold uppercase tracking-wider text-black shadow"
                  style={{ backgroundColor: selectedArtifact.color }}
                >
                  {selectedArtifact.rarity || 'Sacred'}
                </span>
                {isSelectedUnlocked ? (
                  <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[9px] font-bold">
                    ✓ Unlocked
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[9px] font-bold">
                    🔒 Locked
                  </span>
                )}
              </div>

              {/* Audio Chime Trigger */}
              <button
                onClick={handleToggleAudio}
                className="absolute bottom-3 right-3 p-2 rounded-xl bg-black/70 hover:bg-orange-600 border border-zinc-700 hover:border-orange-500 text-white text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                title="Play Acoustic Lore"
              >
                <span className="material-symbols-outlined text-[16px]">
                  {isPlayingAudio ? 'volume_off' : 'graphic_eq'}
                </span>
                <span className="text-[10px]">{isPlayingAudio ? 'Mute' : 'Play Chime'}</span>
              </button>
            </div>

            {/* Selected Artifact Quick Details */}
            <div className="w-full space-y-2 text-left">
              <div className="flex items-center justify-between">
                <h4 className="font-headline text-base font-bold text-white">
                  {selectedArtifact.name}
                </h4>
                <span className="text-xs font-mono text-orange-400 font-bold">
                  {selectedArtifact.frequencyNote.split(' ')[0]} Hz
                </span>
              </div>
              <p className="text-xs text-zinc-300 leading-relaxed">
                {selectedArtifact.lore}
              </p>

              <div className="bg-[#18181c] p-2.5 rounded-xl border border-zinc-800 text-[11px] space-y-1">
                <div className="flex items-center justify-between text-zinc-400">
                  <span>Historical Era:</span>
                  <span className="text-zinc-200 font-semibold">{selectedArtifact.historicalEra}</span>
                </div>
                <div className="flex items-center justify-between text-zinc-400">
                  <span>Craftsmanship:</span>
                  <span className="text-zinc-200 truncate max-w-[200px]">{selectedArtifact.craftsmanshipDetails || 'Traditional metal casting'}</span>
                </div>
              </div>
            </div>

            {/* Equip / Unlock Button */}
            <div className="w-full pt-1">
              {isSelectedUnlocked ? (
                <button
                  onClick={() => handleEquipForAr(selectedArtifact)}
                  className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white text-xs font-bold shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2 border border-orange-400/40 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[18px]">view_in_ar</span>
                  <span>Equip & Place in AR Viewfinder</span>
                </button>
              ) : (
                <button
                  onClick={() => handleUnlockArtifact(selectedArtifact)}
                  className="w-full py-3 px-4 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer border border-amber-400/40"
                >
                  <span className="material-symbols-outlined text-[18px]">lock_open</span>
                  <span>Decipher & Unlock ({selectedArtifact.unlockQuestObjective || 'Field Quest'})</span>
                </button>
              )}
            </div>
          </div>

          {/* Right Column: Inventory Collection Grid (md:col-span-7) */}
          <div className="md:col-span-7 p-4 sm:p-5 flex flex-col justify-between space-y-3 bg-[#16151a]">
            {/* Rarity Filter Tabs */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
              {['all', 'Sacred', 'Rare', 'Legendary', 'Common'].map((rf) => (
                <button
                  key={rf}
                  onClick={() => {
                    setRarityFilter(rf);
                    triggerHaptic('light');
                  }}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all shrink-0 cursor-pointer ${
                    rarityFilter === rf
                      ? 'bg-orange-600 text-white shadow-md'
                      : 'bg-zinc-800 text-zinc-400 hover:text-white border border-zinc-700'
                  }`}
                >
                  {rf === 'all' ? 'All Tiers' : rf}
                </button>
              ))}
            </div>

            {/* Artifacts Catalog Cards */}
            <div className="space-y-2.5 max-h-[380px] overflow-y-auto no-scrollbar pr-1">
              {filteredArtifacts.map((art) => {
                const isSelected = selectedArtifact.id === art.id;
                const isUnlocked = !!unlockedMap[art.id];
                const isEquipped = currentlyEquippedId === art.id;

                return (
                  <div
                    key={art.id}
                    onClick={() => {
                      setSelectedArtifact(art);
                      triggerHaptic('light');
                    }}
                    className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                      isSelected
                        ? 'bg-orange-950/20 border-orange-500 shadow-md ring-1 ring-orange-500/50'
                        : 'bg-[#18181c] border-zinc-800 hover:border-zinc-700'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 border"
                        style={{
                          backgroundColor: `${art.color}20`,
                          borderColor: `${art.color}50`,
                          color: art.color,
                        }}
                      >
                        <span className="material-symbols-outlined text-[24px]">
                          {art.modelType === 'bell' || art.modelType === 'belfry_bell'
                            ? 'notifications'
                            : art.modelType === 'conch'
                            ? 'waves'
                            : art.modelType === 'davarah'
                            ? 'local_cafe'
                            : 'water_drop'}
                        </span>
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h5 className="font-headline text-sm font-bold text-white truncate">
                            {art.name}
                          </h5>
                          {isEquipped && (
                            <span className="px-1.5 py-0.2 rounded bg-orange-500/30 text-orange-300 text-[8px] font-mono font-bold">
                              EQUIPPED
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-zinc-400 truncate mt-0.5">
                          {art.subtitle}
                        </p>
                        <div className="flex items-center gap-2 text-[10px] text-zinc-500 font-mono mt-1">
                          <span style={{ color: art.color }} className="font-bold">
                            {art.rarity}
                          </span>
                          <span>•</span>
                          <span>{art.historicalEra}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {isUnlocked ? (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEquipForAr(art);
                          }}
                          className="px-3 py-1.5 rounded-xl bg-orange-600 hover:bg-orange-500 text-white text-xs font-bold transition-all active:scale-95 cursor-pointer shadow"
                        >
                          Equip
                        </button>
                      ) : (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleUnlockArtifact(art);
                          }}
                          className="px-2.5 py-1.5 rounded-xl bg-zinc-800 hover:bg-amber-600 text-zinc-300 hover:text-white text-xs font-semibold border border-zinc-700 transition-all cursor-pointer flex items-center gap-1"
                        >
                          <span className="material-symbols-outlined text-[14px]">lock</span>
                          <span>Unlock</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Quick Lore Footer */}
            <div className="p-2.5 rounded-xl bg-[#121214] border border-zinc-800 text-[11px] text-zinc-400 flex items-center justify-between">
              <span>💡 Field Tip: Anchoring artifacts in AR stamps your digital passport.</span>
              <span className="text-orange-400 font-bold font-mono">KAOS LORE LABS</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
