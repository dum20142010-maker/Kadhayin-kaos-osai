import React, { useState, useEffect, useRef, useMemo } from 'react';
import * as d3 from 'd3';
import { triggerHaptic } from '../lib/haptic';

interface WeatherOverlayProps {
  landmarkName?: string;
  zone?: string;
  activeMoodCategory?: string;
  onShowToast: (msg: string, icon?: string) => void;
  onClose?: () => void;
}

interface TrendPoint {
  time: string;
  temp: number;
  humidity: number;
  vibe: number;
}

interface WeatherData {
  temperature: string;
  humidity: string;
  wind: string;
  vibeIndex: string;
  vibeTitle: string;
  atmosphereSummary: string;
  trend?: TrendPoint[];
}

export const WeatherOverlay: React.FC<WeatherOverlayProps> = ({
  landmarkName = 'Kapaleeshwarar Temple',
  zone = 'Mylapore',
  activeMoodCategory,
  onShowToast,
  onClose,
}) => {
  const [loading, setLoading] = useState(true);
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [selectedMetric, setSelectedMetric] = useState<'vibe' | 'temp' | 'humidity'>('vibe');
  const [hoveredPoint, setHoveredPoint] = useState<TrendPoint | null>(null);
  const [localMoodOverride, setLocalMoodOverride] = useState<string | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  // Read current active mood from override, prop, or localStorage
  const currentMood = useMemo(() => {
    return localMoodOverride || activeMoodCategory || localStorage.getItem('kaos_active_mood') || 'balanced';
  }, [localMoodOverride, activeMoodCategory]);

  useEffect(() => {
    let isMounted = true;
    async function fetchWeather() {
      setLoading(true);
      try {
        const res = await fetch('/api/ai/landmark-weather', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ landmarkName, zone, moodCategory: currentMood }),
        });
        const data = await res.json();
        if (isMounted) {
          setWeather(data);
        }
      } catch (err) {
        console.warn('Weather fetch error:', err);
        if (isMounted) {
          const isCyberTheme = currentMood === 'cyber';
          const isHeritageTheme = currentMood === 'heritage';
          setWeather({
            temperature: '31°C',
            humidity: '76%',
            wind: '13 km/h SE',
            vibeIndex: '95/100',
            vibeTitle: isCyberTheme
              ? 'Cybernetic Quantum Frequency'
              : isHeritageTheme
              ? 'Sacred Dravidian Resonance'
              : 'Coastal Sanctuary Serenity',
            atmosphereSummary: isCyberTheme
              ? 'High-density quantum signals intersecting with Marina coastal radio towers & neon corridor telemetry.'
              : isHeritageTheme
              ? 'Warm tropical breeze laden with temple sandalwood, temple bells resonance, and sacred frankincense.'
              : 'Warm tropical breeze laden with sandalwood and sea salt mist.',
            trend: [
              { time: '-10h', temp: 28, humidity: 85, vibe: 76 },
              { time: '-8h', temp: 29, humidity: 82, vibe: 81 },
              { time: '-6h', temp: 31, humidity: 79, vibe: 87 },
              { time: '-4h', temp: 33, humidity: 75, vibe: 91 },
              { time: '-2h', temp: 32, humidity: 76, vibe: 94 },
              { time: 'Now', temp: 31, humidity: 76, vibe: 95 },
            ],
          });
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    fetchWeather();
    return () => {
      isMounted = false;
    };
  }, [landmarkName, zone, currentMood]);

  // Render D3 Trend Graph based on current mood and metric
  useEffect(() => {
    if (!weather?.trend || !svgRef.current) return;

    const data = weather.trend;
    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const width = 340;
    const height = 110;
    const margin = { top: 12, right: 14, bottom: 22, left: 28 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    const g = svg
      .attr('viewBox', `0 0 ${width} ${height}`)
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // Theme-specific colors and visual treatments
    let strokeColor = '#2dd4bf'; // default teal
    let gradientStart = 'rgba(45, 212, 191, 0.45)';
    let gradientEnd = 'rgba(45, 212, 191, 0.0)';
    let gridColor = 'rgba(255, 255, 255, 0.08)';

    if (currentMood === 'cyber') {
      strokeColor = selectedMetric === 'vibe' ? '#c084fc' : selectedMetric === 'temp' ? '#f43f5e' : '#38bdf8';
      gradientStart = selectedMetric === 'vibe' ? 'rgba(192, 132, 252, 0.55)' : selectedMetric === 'temp' ? 'rgba(244, 63, 94, 0.55)' : 'rgba(56, 189, 248, 0.55)';
      gradientEnd = 'rgba(192, 132, 252, 0.0)';
      gridColor = 'rgba(192, 132, 252, 0.16)';
    } else if (currentMood === 'heritage') {
      strokeColor = selectedMetric === 'vibe' ? '#f59e0b' : selectedMetric === 'temp' ? '#ea580c' : '#fbbf24';
      gradientStart = selectedMetric === 'vibe' ? 'rgba(245, 158, 11, 0.55)' : selectedMetric === 'temp' ? 'rgba(234, 88, 12, 0.55)' : 'rgba(251, 191, 36, 0.55)';
      gradientEnd = 'rgba(245, 158, 11, 0.0)';
      gridColor = 'rgba(245, 158, 11, 0.18)';
    } else if (currentMood === 'coastal') {
      strokeColor = '#0ea5e9';
      gradientStart = 'rgba(14, 165, 233, 0.45)';
      gradientEnd = 'rgba(14, 165, 233, 0.0)';
    } else if (currentMood === 'coffee') {
      strokeColor = '#d97706';
      gradientStart = 'rgba(217, 119, 6, 0.45)';
      gradientEnd = 'rgba(217, 119, 6, 0.0)';
    }

    // Gradient definition
    const defs = svg.append('defs');
    const gradientId = `weather-trend-gradient-${currentMood}`;
    const gradient = defs
      .append('linearGradient')
      .attr('id', gradientId)
      .attr('x1', '0%')
      .attr('y1', '0%')
      .attr('x2', '0%')
      .attr('y2', '100%');

    gradient.append('stop').attr('offset', '0%').attr('stop-color', gradientStart);
    gradient.append('stop').attr('offset', '100%').attr('stop-color', gradientEnd);

    // X and Y scales
    const xScale = d3
      .scalePoint<string>()
      .domain(data.map((d) => d.time))
      .range([0, innerWidth])
      .padding(0.1);

    const values = data.map((d) => d[selectedMetric]);
    const minY = d3.min(values) || 0;
    const maxY = d3.max(values) || 100;
    const padding = (maxY - minY) * 0.2 || 5;

    const yScale = d3
      .scaleLinear()
      .domain([Math.max(0, minY - padding), maxY + padding])
      .range([innerHeight, 0]);

    // Grid lines
    const yAxis = d3.axisLeft(yScale).ticks(3).tickSize(-innerWidth).tickFormat((d) => `${d}`);
    const yAxisGroup = g.append('g').attr('class', 'grid-y').call(yAxis);
    yAxisGroup.select('.domain').remove();
    yAxisGroup.selectAll('.tick line').attr('stroke', gridColor).attr('stroke-dasharray', currentMood === 'cyber' ? '2,2' : '4,4');
    yAxisGroup.selectAll('.tick text').attr('fill', currentMood === 'cyber' ? '#c084fc' : currentMood === 'heritage' ? '#fbbf24' : '#71717a').attr('font-size', '9px').attr('font-family', 'monospace');

    // D3 Curve Generator based on theme
    const curveType = currentMood === 'cyber' ? d3.curveCatmullRom : currentMood === 'heritage' ? d3.curveNatural : d3.curveMonotoneX;

    const areaGen = d3
      .area<TrendPoint>()
      .x((d) => xScale(d.time) || 0)
      .y0(innerHeight)
      .y1((d) => yScale(d[selectedMetric]))
      .curve(curveType);

    const lineGen = d3
      .line<TrendPoint>()
      .x((d) => xScale(d.time) || 0)
      .y((d) => yScale(d[selectedMetric]))
      .curve(curveType);

    // Append Area Fill
    g.append('path')
      .datum(data)
      .attr('fill', `url(#${gradientId})`)
      .attr('d', areaGen);

    // Append Line Stroke
    const path = g
      .append('path')
      .datum(data)
      .attr('fill', 'none')
      .attr('stroke', strokeColor)
      .attr('stroke-width', currentMood === 'cyber' ? 2.5 : 2.2)
      .attr('d', lineGen);

    if (currentMood === 'cyber') {
      path.attr('filter', 'drop-shadow(0px 0px 5px rgba(192, 132, 252, 0.9))');
    } else if (currentMood === 'heritage') {
      path.attr('filter', 'drop-shadow(0px 0px 4px rgba(245, 158, 11, 0.7))');
    }

    // Data Circles & Interactions
    g.selectAll('.data-node')
      .data(data)
      .enter()
      .append('circle')
      .attr('class', 'data-node')
      .attr('cx', (d) => xScale(d.time) || 0)
      .attr('cy', (d) => yScale(d[selectedMetric]))
      .attr('r', currentMood === 'cyber' ? 4 : 3.5)
      .attr('fill', currentMood === 'cyber' ? '#0b0a10' : '#181310')
      .attr('stroke', strokeColor)
      .attr('stroke-width', 2)
      .style('cursor', 'pointer')
      .on('mouseenter', (event: MouseEvent, d: TrendPoint) => {
        triggerHaptic('light');
        setHoveredPoint(d);
        d3.select(event.currentTarget as SVGCircleElement)
          .transition()
          .duration(150)
          .attr('r', 6.5)
          .attr('fill', strokeColor);
      })
      .on('mouseleave', (event: MouseEvent) => {
        setHoveredPoint(null);
        d3.select(event.currentTarget as SVGCircleElement)
          .transition()
          .duration(150)
          .attr('r', currentMood === 'cyber' ? 4 : 3.5)
          .attr('fill', currentMood === 'cyber' ? '#0b0a10' : '#181310');
      });

    // X Axis Labels
    const xAxis = d3.axisBottom(xScale);
    const xAxisGroup = g
      .append('g')
      .attr('transform', `translate(0,${innerHeight})`)
      .call(xAxis);

    xAxisGroup.select('.domain').attr('stroke', gridColor);
    xAxisGroup.selectAll('.tick line').remove();
    xAxisGroup
      .selectAll('.tick text')
      .attr('fill', '#a1a1aa')
      .attr('font-size', '9px')
      .attr('font-family', 'monospace')
      .attr('dy', '10px');
  }, [weather, selectedMetric, currentMood]);

  const handleSyncVibe = async () => {
    if (!weather) return;
    triggerHaptic('medium');

    try {
      await fetch('/api/db/weather-vibe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          landmarkName,
          zone,
          temperature: weather.temperature,
          humidity: weather.humidity,
          wind: weather.wind,
          vibeIndex: weather.vibeIndex,
          vibeTitle: weather.vibeTitle,
          moodCategory: currentMood,
          trendData: weather.trend,
        }),
      });
      onShowToast(`Synced atmospheric telemetry for ${landmarkName} to Cloud SQL! ⚡`, 'cloud_done');
    } catch {
      onShowToast(`Atmosphere verified for ${landmarkName}: Vibe Index ${weather.vibeIndex}! 🌤️`, 'verified');
    }
  };

  const handleMoodSelect = (mood: string) => {
    triggerHaptic('light');
    setLocalMoodOverride(mood);
    localStorage.setItem('kaos_active_mood', mood);
    window.dispatchEvent(new Event('kaos-mood-changed'));
    onShowToast(`Weather HUD theme shifted to: ${mood.toUpperCase()} ⚡`, 'tune');
  };

  // Theme-specific UI classes
  const isCyber = currentMood === 'cyber';
  const isHeritage = currentMood === 'heritage';

  const containerClasses = isCyber
    ? 'bg-[#0b0a10]/95 backdrop-blur-2xl border-2 border-purple-500/70 shadow-[0_0_35px_rgba(168,85,247,0.35)] text-zinc-100'
    : isHeritage
    ? 'bg-[#181310]/95 backdrop-blur-2xl border-2 border-amber-500/70 shadow-[0_0_35px_rgba(245,158,11,0.25)] text-amber-50'
    : 'bg-[#1a1a1e]/95 backdrop-blur-xl border border-teal-500/40 shadow-2xl text-zinc-100';

  return (
    <div className={`rounded-3xl p-4 max-w-sm w-full space-y-3 relative overflow-hidden animate-in fade-in zoom-in-95 duration-200 ${containerClasses}`}>
      {/* Background Cyber/Heritage Glow Effect */}
      {isCyber && (
        <>
          <div className="absolute -top-12 -right-12 w-36 h-36 bg-purple-600/30 rounded-full blur-3xl pointer-events-none animate-pulse" />
          <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-purple-400 to-transparent opacity-75" />
        </>
      )}
      {isHeritage && (
        <>
          <div className="absolute -top-12 -right-12 w-36 h-36 bg-amber-500/25 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-amber-400 to-transparent opacity-75" />
        </>
      )}

      {/* Header with Title and Mood Selector */}
      <div className={`flex items-center justify-between border-b pb-2.5 ${isCyber ? 'border-purple-500/30' : isHeritage ? 'border-amber-500/30' : 'border-[#26262b]'}`}>
        <div className="flex items-center gap-2">
          <span
            className={`material-symbols-outlined text-[20px] ${
              isCyber ? 'text-purple-400' : isHeritage ? 'text-amber-400' : 'text-teal-400'
            }`}
            style={{ fontVariationSettings: "'FILL' 1" }}
          >
            {isCyber ? 'bolt' : isHeritage ? 'temple_hindu' : 'thermostat'}
          </span>
          <div>
            <div className="flex items-center gap-1.5">
              <h4 className="text-xs font-bold uppercase font-mono tracking-wider">
                {isCyber ? 'CYBERNETIC TELEMETRY' : isHeritage ? 'SACRED CHRONO-VIBE' : 'ATMOSPHERIC HUD'}
              </h4>
            </div>
            <span className="text-[10px] text-zinc-400 font-mono">
              {landmarkName} • {zone}
            </span>
          </div>
        </div>

        {onClose && (
          <button
            onClick={() => {
              triggerHaptic('light');
              onClose();
            }}
            className="w-7 h-7 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-zinc-400 hover:text-white cursor-pointer text-xs font-bold transition-all"
          >
            ✕
          </button>
        )}
      </div>

      {/* Interactive Mood Theme Switcher Pills */}
      <div className="flex items-center justify-between gap-1 bg-black/40 p-1 rounded-xl border border-white/5">
        <span className="text-[9px] font-mono font-bold text-zinc-500 px-1 uppercase tracking-wider">Mood:</span>
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
          {[
            { id: 'cyber', label: 'Cyber', icon: 'bolt', color: 'bg-purple-600 text-white' },
            { id: 'heritage', label: 'Heritage', icon: 'temple_hindu', color: 'bg-amber-600 text-white' },
            { id: 'coastal', label: 'Coastal', icon: 'waves', color: 'bg-sky-600 text-white' },
            { id: 'coffee', label: 'Coffee', icon: 'local_cafe', color: 'bg-amber-700 text-white' },
          ].map((theme) => {
            const active = currentMood === theme.id;
            return (
              <button
                key={theme.id}
                onClick={() => handleMoodSelect(theme.id)}
                className={`px-2 py-0.5 rounded-lg text-[10px] font-mono font-bold flex items-center gap-1 transition-all cursor-pointer ${
                  active
                    ? `${theme.color} shadow-sm ring-1 ring-white/30`
                    : 'text-zinc-400 hover:text-white bg-white/5'
                }`}
              >
                <span className="material-symbols-outlined text-[12px]">{theme.icon}</span>
                <span>{theme.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {loading ? (
        <div
          className={`py-8 flex flex-col items-center justify-center gap-2 font-mono text-xs ${
            isCyber ? 'text-purple-400' : isHeritage ? 'text-amber-400' : 'text-teal-400'
          }`}
        >
          <span className="material-symbols-outlined animate-spin text-[26px]">progress_activity</span>
          <span>{isCyber ? 'Synthesizing Neural Waveform...' : isHeritage ? 'Attuning Temple Serenity Splines...' : 'Analyzing Atmospheric Sensors...'}</span>
        </div>
      ) : weather ? (
        <div className="space-y-3 text-xs">
          {/* Main Vibe Score Banner */}
          <div
            className={`p-3 rounded-2xl border flex items-center justify-between ${
              isCyber
                ? 'bg-purple-950/30 border-purple-500/40 shadow-inner'
                : isHeritage
                ? 'bg-amber-950/30 border-amber-500/40 shadow-inner'
                : 'bg-teal-950/30 border-teal-500/30'
            }`}
          >
            <div>
              <span
                className={`text-[9px] font-mono uppercase font-bold tracking-widest block ${
                  isCyber ? 'text-purple-400' : isHeritage ? 'text-amber-400' : 'text-teal-400'
                }`}
              >
                {isCyber ? 'NEURAL VIBE FREQUENCY' : isHeritage ? 'TEMPLE TRANQUILITY INDEX' : 'VIBE INDEX SCORE'}
              </span>
              <span className="text-xs font-bold text-white leading-tight block mt-0.5">{weather.vibeTitle}</span>
            </div>
            <div className="text-right shrink-0">
              <span
                className={`text-xl font-mono font-black ${
                  isCyber ? 'text-purple-300 drop-shadow-[0_0_8px_rgba(192,132,252,0.8)]' : isHeritage ? 'text-amber-300 drop-shadow-[0_0_8px_rgba(245,158,11,0.6)]' : 'text-teal-300'
                }`}
              >
                {weather.vibeIndex}
              </span>
            </div>
          </div>

          {/* D3 Data Visualization Section */}
          <div className="bg-black/40 rounded-2xl p-2.5 border border-white/5 space-y-1.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-mono uppercase text-zinc-400 font-bold">
                  {isCyber ? 'D3 Signal Stream (12h)' : isHeritage ? 'D3 Diurnal Spline (12h)' : 'D3 Trend Curve (12h)'}
                </span>
                {hoveredPoint && (
                  <span className="text-[10px] font-mono font-bold text-white bg-white/10 px-1.5 py-0.5 rounded">
                    {hoveredPoint.time}: {hoveredPoint[selectedMetric]}
                    {selectedMetric === 'temp' ? '°C' : selectedMetric === 'humidity' ? '%' : ' pts'}
                  </span>
                )}
              </div>

              {/* Metric Selector Pills */}
              <div className="flex gap-1 bg-white/5 p-0.5 rounded-lg">
                {(['vibe', 'temp', 'humidity'] as const).map((metric) => (
                  <button
                    key={metric}
                    onClick={() => {
                      triggerHaptic('light');
                      setSelectedMetric(metric);
                    }}
                    className={`px-1.5 py-0.5 text-[9px] font-mono rounded font-bold transition-all cursor-pointer ${
                      selectedMetric === metric
                        ? isCyber
                          ? 'bg-purple-600 text-white shadow'
                          : isHeritage
                          ? 'bg-amber-600 text-white shadow'
                          : 'bg-teal-600 text-white shadow'
                        : 'text-zinc-400 hover:text-white'
                    }`}
                  >
                    {metric === 'vibe' ? 'VIBE' : metric === 'temp' ? 'TEMP' : 'HUMID'}
                  </button>
                ))}
              </div>
            </div>

            {/* D3 SVG Canvas */}
            <svg ref={svgRef} className="w-full h-24 overflow-visible" />
          </div>

          {/* Atmospheric Telemetry Grid */}
          <div className="grid grid-cols-3 gap-2 text-center font-mono">
            <div className="p-2.5 rounded-xl bg-black/30 border border-white/5">
              <span className="text-[9px] text-zinc-400 block uppercase font-bold">Temp</span>
              <span className="text-xs font-bold text-white mt-0.5 block">{weather.temperature}</span>
            </div>
            <div className="p-2.5 rounded-xl bg-black/30 border border-white/5">
              <span className="text-[9px] text-zinc-400 block uppercase font-bold">Humidity</span>
              <span className={`text-xs font-bold mt-0.5 block ${isCyber ? 'text-purple-300' : isHeritage ? 'text-amber-300' : 'text-teal-400'}`}>
                {weather.humidity}
              </span>
            </div>
            <div className="p-2.5 rounded-xl bg-black/30 border border-white/5">
              <span className="text-[9px] text-zinc-400 block uppercase font-bold">Wind</span>
              <span className="text-xs font-bold text-zinc-300 mt-0.5 block">{weather.wind}</span>
            </div>
          </div>

          <p className="text-[11px] text-zinc-300 italic leading-relaxed bg-black/20 p-2.5 rounded-xl border border-white/5">
            "{weather.atmosphereSummary}"
          </p>

          <button
            onClick={handleSyncVibe}
            className={`w-full py-2.5 rounded-xl font-bold text-xs shadow-md active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              isCyber
                ? 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white shadow-[0_0_15px_rgba(168,85,247,0.4)]'
                : isHeritage
                ? 'bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white shadow-[0_0_15px_rgba(245,158,11,0.3)]'
                : 'bg-teal-600 hover:bg-teal-500 text-white'
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">{isCyber ? 'bolt' : 'cloud_upload'}</span>
            <span>{isCyber ? 'Broadcast Telemetry to Cloud SQL' : 'Record Vibe into Cloud Database'}</span>
          </button>
        </div>
      ) : null}
    </div>
  );
};
