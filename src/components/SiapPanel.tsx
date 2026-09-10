'use client';
import { useState, useEffect, useRef } from 'react';
import { MapPinned, Play, Pause, Bike, Footprints, Camera, Video, AlertTriangle, CheckCircle2, Clock, ChevronRight, ExternalLink, X } from 'lucide-react';
import type { SiapInspector, SiapPoint } from '@/lib/siap';

function impactoColor(impacto: string) {
  switch (impacto) {
    case 'critico': return '#D32F2F';
    case 'alto': return '#FF6F00';
    case 'medio': return '#FFC400';
    case 'bajo': return '#00C853';
    default: return '#9BA7C2';
  }
}

interface Props {
  inspectors: SiapInspector[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onPointClick: (p: SiapPoint, inspector: SiapInspector) => void;
  onPlayRoute: (inspector: SiapInspector, mode: 'moto' | 'a pie') => void;
  onStop: () => void;
  playback: { inspectorId: string; index: number; playing: boolean } | null;
  setPlayback: (p: { inspectorId: string; index: number; playing: boolean } | null) => void;
  onClose?: () => void;
  speed?: 1 | 2;
  setSpeed?: (s: 1 | 2) => void;
}

export default function SiapPanel({ inspectors, selectedId, onSelect, onPointClick, onPlayRoute, onStop, playback, setPlayback, onClose, speed: speedProp, setSpeed: setSpeedProp }: Props) {
  const selected = inspectors.find(i => i.id === selectedId) || inspectors[0];
  const [mode, setMode] = useState<'moto' | 'a pie'>('moto');
  const [speedLocal, setSpeedLocal] = useState<1 | 2>(1);
  const speed = speedProp ?? speedLocal;
  const setSpeed = setSpeedProp ?? setSpeedLocal;
  const timerRef = useRef<number | null>(null);

  // Suave: page anima el dot entre puntos, aquí solo avanzamos el índice con duración / velocidad
  useEffect(() => {
    if (!playback?.playing || !selected) return;
    const base = mode === 'moto' ? 1800 : 2800;
    const duration = base / speed;
    timerRef.current = window.setTimeout(() => {
      const next = playback.index + 1;
      if (next >= selected.points.length) {
        setPlayback({ ...playback, playing: false });
        return;
      }
      setPlayback({ inspectorId: selected.id, index: next, playing: true });
      const pt = selected.points[next];
      onPointClick(pt, selected);
    }, duration);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [playback, selected, mode, speed, onPointClick, setPlayback]);

  if (!inspectors.length) return <div className="glass-panel p-4 text-xs text-muted">Cargando SIAP…</div>;

  return (
    <div className="glass-panel w-[360px] max-h-[78vh] flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-white/[0.06]" style={{ background: 'rgba(23,167,210,0.08)' }}>
        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: '#17A7D2', boxShadow: '0 0 12px rgba(23,167,210,0.4)' }}>
          <MapPinned className="w-4 h-4 text-white" />
        </div>
        <div className="flex-1">
          <div className="text-[12px] font-mono font-bold tracking-[0.18em] text-white">SIAP • MANTA</div>
          <div className="text-[10px] font-mono text-white/50">altura.com.ec · 3 inspectores</div>
        </div>
        {onClose && <button onClick={onClose} className="w-7 h-7 rounded-md flex items-center justify-center hover:bg-white/10 text-white/50"><X className="w-4 h-4" /></button>}
      </div>

      {/* Inspector tabs */}
      <div className="flex gap-1.5 px-3 py-2 bg-black/20 border-b border-white/[0.04]">
        {inspectors.map(ins => (
          <button
            key={ins.id}
            onClick={() => onSelect(ins.id)}
            className={`flex-1 flex flex-col items-center gap-1 py-2 rounded-lg border transition-all ${selected?.id === ins.id ? 'bg-white/[0.08] border-white/20' : 'border-transparent hover:bg-white/[0.04]'}`}
          >
            <span className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold text-white" style={{ background: ins.color, boxShadow: selected?.id===ins.id ? `0 0 10px ${ins.color}60` : 'none' }}>{ins.avatar}</span>
            <span className="text-[10px] font-mono font-bold tracking-wide text-white/90">{ins.name.split(' ')[0]}</span>
            <span className="text-[9px] font-mono text-white/40 flex items-center gap-1">{ins.vehicle==='moto'?<Bike className="w-3 h-3"/>:<Footprints className="w-3 h-3"/>}{ins.vehicle}</span>
          </button>
        ))}
      </div>

      {selected && (
        <>
          {/* Inspector summary + playback */}
          <div className="px-4 py-3 border-b border-white/[0.06] space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-bold text-white">{selected.name}</span>
              <span className="text-[10px] font-mono text-white/50">{selected.role}</span>
              <span className="ml-auto text-[10px] font-mono px-2 py-0.5 rounded-full" style={{ background: selected.color+'20', color: selected.color, border: `1px solid ${selected.color}40` }}>{selected.points.length} puntos</span>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setMode('moto')} className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-[10px] font-mono border ${mode==='moto'?'bg-[#17A7D2]/20 border-[#17A7D2]/40 text-white':'border-white/10 text-white/50'}`}><Bike className="w-3.5 h-3.5"/> MOTO</button>
              <button onClick={() => setMode('a pie')} className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-[10px] font-mono border ${mode==='a pie'?'bg-[#17A7D2]/20 border-[#17A7D2]/40 text-white':'border-white/10 text-white/50'}`}><Footprints className="w-3.5 h-3.5"/> A PIE</button>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setSpeed(1)} className={`flex-1 py-1.5 rounded-md text-[10px] font-mono font-bold border ${speed===1?'bg-white/10 border-white/20 text-white':'border-white/10 text-white/50'}`}>1x</button>
              <button onClick={() => setSpeed(2)} className={`flex-1 py-1.5 rounded-md text-[10px] font-mono font-bold border ${speed===2?'bg-[#17A7D2]/20 border-[#17A7D2]/40 text-white':'border-white/10 text-white/50'}`}>2x ⚡</button>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  if (playback?.playing && playback.inspectorId===selected.id) { setPlayback({ ...playback, playing: false }); return; }
                  const start = playback?.inspectorId===selected.id ? playback.index : 0;
                  setPlayback({ inspectorId: selected.id, index: start, playing: true });
                  onPlayRoute(selected, mode);
                  const pt = selected.points[start];
                  if (pt) onPointClick(pt, selected);
                }}
                className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-mono font-bold tracking-wide text-white"
                style={{ background: selected.color, boxShadow: `0 0 16px ${selected.color}60` }}
              >
                {playback?.playing && playback.inspectorId===selected.id ? <Pause className="w-4 h-4"/> : <Play className="w-4 h-4"/>}
                {playback?.playing && playback.inspectorId===selected.id ? 'PAUSAR' : 'SIMULAR RECORRIDO'}
              </button>
              <button onClick={() => { setPlayback(null); onStop(); }} className="px-3 py-2 rounded-lg border border-white/10 text-white/60 hover:text-white text-[10px] font-mono">RESET</button>
            </div>
            {playback && playback.inspectorId===selected.id && (
              <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                <div className="h-full transition-all duration-500" style={{ width: `${((playback.index+1)/selected.points.length)*100}%`, background: selected.color }} />
              </div>
            )}
          </div>

          {/* Points list */}
          <div className="flex-1 overflow-y-auto styled-scrollbar">
            <div className="p-2 space-y-2">
              {selected.points.map((pt, idx) => {
                const active = playback?.inspectorId===selected.id && playback.index===idx;
                return (
                  <button
                    key={pt.id}
                    onClick={() => { onPointClick(pt, selected); setPlayback({ inspectorId: selected.id, index: idx, playing: false }); }}
                    className={`w-full text-left rounded-xl border overflow-hidden transition-all ${active ? 'border-[#17A7D2]/50 bg-[#17A7D2]/10' : 'border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.06] hover:border-white/10'}`}
                  >
                    <div className="relative">
                      <img src={pt.thumb} alt={pt.titulo} className="w-full h-28 object-cover" loading="lazy" />
                      <div className="absolute top-2 left-2 flex gap-1.5">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold text-white" style={{ background: impactoColor(pt.impacto) }}>{pt.impacto.toUpperCase()}</span>
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-mono font-bold ${pt.estado==='validado'?'bg-emerald-500 text-white':'bg-amber-500 text-black'}`}>{pt.estado.toUpperCase()}</span>
                      </div>
                      <div className="absolute top-2 right-2 w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white border-2 border-white" style={{ background: selected.color }}>#{pt.orden}</div>
                      <div className="absolute bottom-2 left-2 flex items-center gap-1 px-1.5 py-0.5 rounded bg-black/60 text-white text-[9px] font-mono">
                        {selected.vehicle==='moto' ? <Bike className="w-3 h-3"/> : <Footprints className="w-3 h-3"/>}{selected.vehicle.toUpperCase()}
                      </div>
                      <div className="absolute bottom-2 right-2 flex gap-1">
                        {pt.fotos.length>0 && <span className="px-1.5 py-0.5 rounded bg-black/60 text-white text-[9px] flex items-center gap-1"><Camera className="w-3 h-3"/>{pt.fotos.length}</span>}
                        {pt.video && <span className="px-1.5 py-0.5 rounded bg-black/60 text-white text-[9px] flex items-center gap-1"><Video className="w-3 h-3"/>VID</span>}
                      </div>
                    </div>
                    <div className="p-3">
                      <div className="text-xs font-mono font-bold text-white leading-tight">{pt.titulo}</div>
                      <div className="text-[11px] text-white/60 leading-snug mt-1 line-clamp-2">{pt.descripcion}</div>
                      <div className="flex items-center gap-2 mt-2 text-[10px] font-mono text-white/40">
                        <Clock className="w-3 h-3"/>{new Date(pt.fecha).toLocaleTimeString('es-EC',{hour:'2-digit',minute:'2-digit'})}
                        <span className="ml-auto flex items-center gap-1 text-[#17A7D2]">Ver en mapa <ChevronRight className="w-3 h-3"/></span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}

      <div className="px-3 py-2 border-t border-white/[0.06] bg-black/20 text-[9px] font-mono text-white/30 text-center">GAIA · Sistema de Inspección Territorial SIAP · altura.com.ec</div>
    </div>
  );
}
