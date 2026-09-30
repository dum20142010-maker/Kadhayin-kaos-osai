import React, { useState } from 'react';
import { GEOGRAPHICAL_CLUSTERS } from '../data/masterPlacesIndex';
import { generateCustomGeographicPlan } from '../lib/aiExpeditionEngine';
import { CustomExpeditionPlan, MasterPlace } from '../types';
import { triggerHaptic } from '../lib/haptic';
import { useAuth } from '../context/AuthContext';
import { db } from '../lib/firebase';
import { doc, setDoc } from 'firebase/firestore';

interface AiExpeditionPlannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onShowToast: (msg: string, icon?: string) => void;
  onOpenDossier?: (place: any) => void;
  onNavigateToMap?: (stops: any[]) => void;
  onOpenQuestModal?: (place: MasterPlace) => void;
  initialClusterKey?: string;
}

export const AiExpeditionPlannerModal: React.FC<AiExpeditionPlannerModalProps> = ({
  isOpen,
  onClose,
  onShowToast,
  onNavigateToMap,
  onOpenQuestModal,
  initialClusterKey = 'fort-george-town',
}) => {
  const { user } = useAuth();
  const [selectedClusterKey, setSelectedClusterKey] = useState<string>(initialClusterKey);
  const [timeBudget, setTimeBudget] = useState<'1-hour' | '2-hours' | 'half-day' | 'full-day'>('2-hours');
  const [theme, setTheme] = useState<string>('Heritage & Architecture');
  const [pace, setPace] = useState<string>('Brisk Walking');
  const [customNotes, setCustomNotes] = useState<string>('');
  
  const [generating, setGenerating] = useState<boolean>(false);
  const [plan, setPlan] = useState<CustomExpeditionPlan | null>(null);

  if (!isOpen) return null;

  const handleGeneratePlan = async () => {
    setGenerating(true);
    triggerHaptic('medium');
    onShowToast('Gemini is mapping your geographic expedition...', 'auto_awesome');

    try {
      const result = await generateCustomGeographicPlan(
        selectedClusterKey,
        timeBudget,
        theme,
        pace,
        customNotes
      );
      setPlan(result);
      triggerHaptic('legendary');
      onShowToast(`Expedition Ready: ${result.title} (+${result.totalXp} XP)`, 'verified');
    } catch (err) {
      console.warn('Plan generation error:', err);
      onShowToast('Failed to generate plan. Please retry.', 'error');
    } finally {
      setGenerating(false);
    }
  };

  const handleSavePlan = async () => {
    if (!plan) return;
    triggerHaptic('medium');

    if (user) {
      try {
        await setDoc(doc(db, 'users', user.uid, 'customPlans', plan.id), plan);
        onShowToast('Expedition saved to Field Journal! 🗺️', 'bookmark_added');
      } catch (err) {
        console.warn('Error saving plan to firestore:', err);
        onShowToast('Saved locally in expedition book', 'check');
      }
    } else {
      onShowToast('Expedition saved locally to Journal 🗺️', 'check');
    }
  };

  const handlePlotOnMap = () => {
    if (!plan) return;
    triggerHaptic('light');
    onClose();
    onNavigateToMap?.(plan.stops);
    onShowToast(`Plotted ${plan.stops.length} expedition stops on Google Map! 📍`, 'map');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md" onClick={onClose}>
      <div
        className="bg-[#18181c] rounded-3xl w-full max-w-2xl shadow-2xl border border-orange-500/30 overflow-hidden flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 bg-[#121214] border-b border-[#26262b] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-orange-600/20 text-orange-400 flex items-center justify-center border border-orange-500/40">
              <span className="material-symbols-outlined text-[22px]">route</span>
            </div>
            <div>
              <h3 className="font-headline text-lg text-white font-bold flex items-center gap-1.5">
                AI Geographic Route Architect
                <span className="px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-400 text-[10px] font-mono font-bold uppercase">
                  300 Places Master
                </span>
              </h3>
              <p className="text-[11px] text-[#9898a0]">
                Customize tailored expeditions across Chennai’s 9 geographical clusters
              </p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-[#1a1a1e] text-[#9898a0] flex items-center justify-center hover:text-white">
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 overflow-y-auto space-y-4 flex-1">
          {/* Geographical Area / Cluster Selector */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1">
              <span className="material-symbols-outlined text-orange-400 text-[15px]">location_on</span>
              <span>1. Choose Geographical Cluster</span>
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {GEOGRAPHICAL_CLUSTERS.map((cluster) => {
                const isSelected = selectedClusterKey === cluster.id;
                return (
                  <button
                    key={cluster.id}
                    onClick={() => {
                      setSelectedClusterKey(cluster.id);
                      triggerHaptic('light');
                    }}
                    className={`p-2.5 rounded-2xl border text-left transition-all active:scale-98 flex items-start gap-2.5 ${
                      isSelected
                        ? 'bg-orange-600/15 border-orange-500 shadow-sm ring-1 ring-orange-500/30'
                        : 'bg-[#121214] border-[#26262b] hover:border-white/20'
                    }`}
                  >
                    <div
                      className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
                      style={{ backgroundColor: `${cluster.color}25`, color: cluster.color }}
                    >
                      <span className="material-symbols-outlined text-[18px]">{cluster.icon}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-bold text-white truncate">{cluster.shortName}</h4>
                        <span className="text-[10px] font-mono font-bold text-orange-400">{cluster.count} Places</span>
                      </div>
                      <p className="text-[10px] text-[#9898a0] line-clamp-1 mt-0.5">{cluster.tagline}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Time Budget & Pace Options */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1">
                <span className="material-symbols-outlined text-teal-400 text-[15px]">schedule</span>
                <span>2. Time Budget</span>
              </label>
              <div className="grid grid-cols-2 gap-1.5">
                {[
                  { key: '1-hour', label: '1 Hour Blitz', stops: '3 stops' },
                  { key: '2-hours', label: '2 Hours Trail', stops: '5 stops' },
                  { key: 'half-day', label: 'Half Day Odyssey', stops: '7 stops' },
                  { key: 'full-day', label: 'Grand Expedition', stops: '9 stops' },
                ].map((tb) => (
                  <button
                    key={tb.key}
                    onClick={() => {
                      setTimeBudget(tb.key as any);
                      triggerHaptic('light');
                    }}
                    className={`p-2 rounded-xl border text-center transition-all text-xs font-bold ${
                      timeBudget === tb.key
                        ? 'bg-orange-600 text-white border-orange-500 shadow'
                        : 'bg-[#121214] text-[#9898a0] border-[#26262b] hover:text-white'
                    }`}
                  >
                    <div>{tb.label}</div>
                    <div className="text-[10px] font-normal opacity-80">{tb.stops}</div>
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1">
                <span className="material-symbols-outlined text-purple-400 text-[15px]">palette</span>
                <span>3. Focus Theme</span>
              </label>
              <select
                value={theme}
                onChange={(e) => setTheme(e.target.value)}
                className="w-full bg-[#121214] text-white p-2.5 rounded-xl border border-[#26262b] text-xs focus:outline-none focus:border-orange-500"
              >
                <option value="Heritage & Architecture">🏛️ Indo-Saracenic & Architectural Vaults</option>
                <option value="100-Year Food & Coffee Lore">☕ 100-Year Culinary & Filter Coffee Trail</option>
                <option value="Sacred Temples & Tanks">🛕 Mystic Dravidian Temples & Teppakulams</option>
                <option value="Colonial Forts & Bells">🔔 Colonial Bastions, Belfries & Trade Alleys</option>
                <option value="Coastal Estuary & Nature">🌊 Estuary Wildlife, Lagoons & Beaches</option>
                <option value="Art & Cultural Sabhas">🎨 Modern Art Communes & Sabhas</option>
              </select>

              <div className="pt-1 flex gap-1.5">
                {['Walking', 'Bicycle', 'Auto-Rickshaw'].map((p) => (
                  <button
                    key={p}
                    onClick={() => setPace(p)}
                    className={`flex-1 py-1 rounded-lg text-[11px] font-semibold border ${
                      pace === p ? 'bg-amber-500 text-black border-amber-400' : 'bg-[#121214] text-[#9898a0] border-[#26262b]'
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Custom Explorer Notes Input */}
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-[#9898a0] uppercase tracking-wider">
              Optional Preferences / Special Interests
            </label>
            <input
              type="text"
              placeholder="e.g. Include places with filter coffee, best photo angles, avoid heavy stairs..."
              value={customNotes}
              onChange={(e) => setCustomNotes(e.target.value)}
              className="w-full bg-[#121214] text-white p-2.5 rounded-xl border border-[#26262b] text-xs focus:outline-none focus:border-orange-500"
            />
          </div>

          {/* Generate Button */}
          <button
            onClick={handleGeneratePlan}
            disabled={generating}
            className="w-full py-3.5 rounded-2xl bg-orange-600 hover:bg-orange-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg active:scale-98 transition-all disabled:opacity-50"
          >
            {generating ? (
              <>
                <span className="material-symbols-outlined animate-spin text-[18px]">progress_activity</span>
                <span>Calculating Geographic Route & Missions...</span>
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-[18px]">auto_awesome</span>
                <span>Generate Customized AI Expedition Plan</span>
              </>
            )}
          </button>

          {/* Display Generated Plan */}
          {plan && (
            <div className="p-4 rounded-3xl bg-[#121214] border border-orange-500/40 space-y-3.5 shadow-md animate-fadeIn">
              <div className="flex justify-between items-start">
                <div>
                  <span className="px-2.5 py-0.5 rounded-full bg-orange-500/20 text-orange-400 text-[10px] font-bold uppercase tracking-wider">
                    {plan.cluster}
                  </span>
                  <h3 className="font-headline text-lg font-bold text-white mt-1">{plan.title}</h3>
                  <p className="text-xs text-[#9898a0] italic">{plan.tagline}</p>
                </div>
                <div className="text-right">
                  <span className="text-xs font-mono font-bold text-teal-400 bg-teal-500/10 px-2 py-0.5 rounded-full border border-teal-500/20">
                    +{plan.totalXp} XP
                  </span>
                  <div className="text-[10px] text-[#9898a0] mt-1 font-mono">{plan.totalDuration} • {plan.totalDistance}</div>
                </div>
              </div>

              <p className="text-xs text-[#cfcfd6] leading-relaxed bg-[#1a1a1e] p-3 rounded-2xl border border-[#26262b]">
                {plan.overview}
              </p>

              {/* Stops Timeline */}
              <div className="space-y-2.5">
                <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-orange-400 text-[16px]">timeline</span>
                  <span>Sequential Itinerary ({plan.stops.length} Waypoints)</span>
                </h4>

                <div className="space-y-2">
                  {plan.stops.map((stop, idx) => (
                    <div
                      key={stop.stopNumber}
                      className="p-3 rounded-2xl bg-[#1a1a1e] border border-[#26262b] hover:border-orange-500/40 transition-all flex items-start gap-3"
                    >
                      <div className="w-6 h-6 rounded-full bg-orange-600 text-white font-mono font-bold text-xs flex items-center justify-center shrink-0 mt-0.5 shadow">
                        {idx + 1}
                      </div>

                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex justify-between items-center">
                          <h5 className="font-headline text-sm font-bold text-white">
                            #{stop.placeNumber} {stop.placeName}
                          </h5>
                          <span className="text-[10px] font-mono text-orange-400 font-bold">
                            +{stop.xpReward} XP • {stop.timeAllocation}
                          </span>
                        </div>

                        <p className="text-xs text-[#9898a0]">{stop.loreHook}</p>

                        <div className="bg-[#121214] p-2 rounded-xl text-[11px] text-teal-300 border border-teal-500/20 flex items-center gap-1.5">
                          <span className="material-symbols-outlined text-[14px] text-teal-400">flag</span>
                          <span><strong>Mission:</strong> {stop.mission}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Insider Tip */}
              <div className="p-3 rounded-2xl bg-amber-950/20 border border-amber-500/30 flex items-start gap-2 text-xs text-amber-300">
                <span className="material-symbols-outlined text-amber-400 text-[18px] shrink-0">lightbulb</span>
                <div>
                  <strong className="text-white">Insider Tip:</strong> {plan.insiderTip}
                </div>
              </div>

              {/* Action Buttons for Plan */}
              <div className="flex gap-2 pt-1">
                <button
                  onClick={handlePlotOnMap}
                  className="flex-1 py-3 rounded-2xl bg-orange-600 hover:bg-orange-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow active:scale-95 transition-all"
                >
                  <span className="material-symbols-outlined text-[16px]">map</span>
                  <span>Plot on Google Map</span>
                </button>

                <button
                  onClick={handleSavePlan}
                  className="px-4 py-3 rounded-2xl bg-[#1a1a1e] hover:bg-[#26262b] text-white font-bold text-xs border border-[#26262b] flex items-center justify-center gap-1.5 active:scale-95 transition-all"
                >
                  <span className="material-symbols-outlined text-[16px] text-orange-400">bookmark</span>
                  <span>Save</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
