'use client';
import { useState, useEffect, useRef } from 'react';
import { MapPinned, Play, Pause, Bike, Footprints, Camera, Video, AlertTriangle, CheckCircle2, Clock, ChevronRight, ExternalLink, X, Radio, Wifi, Settings2, Copy, Check, RefreshCw } from 'lucide-react';
import type { SiapInspector, SiapPoint } from '@/lib/siap';
import SiapMini3D from './SiapMini3D';
import SiapLiveViewer from './SiapLiveViewer';

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
  onCenterManta?: () => void;
  speed?: 1 | 2;
  setSpeed?: (s: 1 | 2) => void;
  liveDot?: { lng: number; lat: number; inspectorId: string } | null;
  liveTrail?: { type: 'LineString'; coordinates: [number, number][]; color?: string } | null;
}

export default function SiapPanel({ inspectors, selectedId, onSelect, onPointClick, onPlayRoute, onStop, playback, setPlayback, onClose, onCenterManta, speed: speedProp, setSpeed: setSpeedProp, liveDot, liveTrail }: Props) {
  const selected = inspectors.find(i => i.id === selectedId) || inspectors[0];
  const [mode, setMode] = useState<'moto' | 'a pie'>('moto');
  const [speedLocal, setSpeedLocal] = useState<1 | 2>(1);
  const speed = speedProp ?? speedLocal;
  const setSpeed = setSpeedProp ?? setSpeedLocal;
  const timerRef = useRef<number | null>(null);

  // ── SIAP Live (RTSP→HLS/WebRTC) ──
  const [liveStates, setLiveStates] = useState<Record<string, { status: 'offline'|'connecting'|'live'; proxyHlsUrl: string; hlsUrl: string; proxyWhepUrl: string; whepUrl: string; rtspUrl: string; updatedAt: string }>>({});
  const [lanIp, setLanIp] = useState<string | null>(null);
  const [showLiveConfig, setShowLiveConfig] = useState(false);
  const [rtspInputs, setRtspInputs] = useState<Record<string,string>>({});
  const [copied, setCopied] = useState<string | null>(null);
  const [liveConnecting, setLiveConnecting] = useState<Record<string,boolean>>({});
  const [liveRefreshing, setLiveRefreshing] = useState(false);

  const fetchLive = async (check=false) => {
    try {
      if (check && selected) {
        const r = await fetch(`/api/siap/live?inspector=${selected.id}&check=1`, { cache: 'no-store' });
        if (r.ok) { const d = await r.json(); setLiveStates(s=>({ ...s, [d.inspectorId]: d })); }
      } else {
        const r = await fetch('/api/siap/live', { cache: 'no-store' });
        if (r.ok) { const d = await r.json(); if (d.live) setLiveStates(d.live); if (d.lanIp) setLanIp(d.lanIp); }
      }
    } catch {}
  };
  useEffect(() => {
    fetch('/api/network/ip').then(r=>r.json()).then(d=>{ if(d.lanIp) setLanIp(d.lanIp); }).catch(()=>{});
    fetchLive(false);
    const iv = setInterval(()=> fetchLive(false), 8000);
    return () => clearInterval(iv);
  }, []);
  useEffect(() => { fetchLive(true); }, [selected?.id]);
  const live = selected ? liveStates[selected.id] : null;
  const rtspPort = process.env.NEXT_PUBLIC_RTSP_PORT || '8554';
  const effectiveRtsp = selected ? (rtspInputs[selected.id] || live?.rtspUrl || (lanIp ? `rtsp://${lanIp}:${rtspPort}/${selected.id}` : `rtsp://192.168.40.188:${rtspPort}/${selected?.id}`)) : '';
  const hlsUrl = live?.proxyHlsUrl || null;
  const whepUrl = live?.whepUrl || null;
  const proxyWhepUrl = live?.proxyWhepUrl || null;
  const liveStatus = live?.status || 'offline';
  const handleConnect = async () => {
    if (!selected) return;
    setLiveConnecting(s=>({ ...s, [selected.id]: true }));
    try {
      await fetch('/api/siap/live', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ inspectorId: selected.id, rtspUrl: effectiveRtsp, status: 'connecting' }) });
      await fetchLive(true);
      setTimeout(()=> fetchLive(true), 2000);
    } finally { setLiveConnecting(s=>({ ...s, [selected.id]: false })); }
  };
  const handleCopy = async (txt: string, key: string) => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(txt);
      } else throw new Error('no clipboard');
    } catch {
      try {
        const ta = document.createElement('textarea');
        ta.value = txt;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      } catch {}
    }
    setCopied(key); setTimeout(()=>setCopied(null), 1500);
  };

  // Avanza índice; la animación del dot/trail la hace page.tsx sin robar cámara por punto
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
      // sin onPointClick para no hacer flyTo 15 en cada paso y mantener vista amplia del rango
    }, duration);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [playback, selected, mode, speed, setPlayback]);

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
        {onCenterManta && <button onClick={onCenterManta} title="Centrar en Manta" className="px-2.5 py-1.5 rounded-md border border-[#17A7D2]/30 bg-[#17A7D2]/15 hover:bg-[#17A7D2]/25 text-[#17A7D2] text-[10px] font-mono font-bold tracking-wider flex items-center gap-1 transition-colors"><MapPinned className="w-3 h-3" /> MANTA</button>}
        {onClose && <button onClick={onClose} title="Ocultar SIAP" className="w-7 h-7 rounded-md flex items-center justify-center hover:bg-white/10 text-white/50"><X className="w-4 h-4" /></button>}
      </div>

      {/* Inspector tabs + live dot */}
      <div className="flex gap-1.5 px-3 py-2 bg-black/20 border-b border-white/[0.04]">
        {inspectors.map(ins => {
          const ls = liveStates[ins.id]?.status;
          return (
          <button
            key={ins.id}
            onClick={() => onSelect(ins.id)}
            className={`relative flex-1 flex flex-col items-center gap-1 py-2 rounded-lg border transition-all ${selected?.id === ins.id ? 'bg-white/[0.08] border-white/20' : 'border-transparent hover:bg-white/[0.04]'}`}
          >
            {ls==='live' && <span className="absolute top-1 right-2 w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_6px_#10b981]" title="EN VIVO" />}
            {ls==='connecting' && <span className="absolute top-1 right-2 w-2 h-2 rounded-full bg-amber-500 animate-pulse" title="Conectando" />}
            <span className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold text-white" style={{ background: ins.color, boxShadow: selected?.id===ins.id ? `0 0 10px ${ins.color}60` : 'none' }}>{ins.avatar}</span>
            <span className="text-[10px] font-mono font-bold tracking-wide text-white/90">{ins.name.split(' ')[0]}</span>
            <span className="text-[9px] font-mono text-white/40 flex items-center gap-1">{ins.vehicle==='moto'?<Bike className="w-3 h-3"/>:<Footprints className="w-3 h-3"/>}{ins.vehicle}</span>
            {ls && <span className={`text-[8px] font-mono font-bold tracking-widest px-1.5 py-0.5 rounded ${ls==='live'?'bg-emerald-500/20 text-emerald-400':ls==='connecting'?'bg-amber-500/20 text-amber-400':'bg-white/5 text-white/30'}`}>{ls==='live'?'● LIVE':ls==='connecting'?'◐ ESPERA':'○ OFF'}</span>}
          </button>
        )})}
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
                onClick={(e) => {
                  e.stopPropagation();
                  if (playback?.playing && playback.inspectorId===selected.id) { setPlayback({ ...playback, playing: false }); return; }
                  const isFinished = playback?.inspectorId===selected.id && !playback.playing && playback.index === selected.points.length - 1;
                  if (isFinished) { setPlayback(null); onStop(); return; }
                  const start = playback?.inspectorId===selected.id ? playback.index : 0;
                  setPlayback({ inspectorId: selected.id, index: start, playing: true });
                  onPlayRoute(selected, mode);
                }}
                className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-mono font-bold tracking-wide text-white"
                style={{ background: selected.color, boxShadow: `0 0 16px ${selected.color}60` }}
              >
                {playback?.playing && playback.inspectorId===selected.id ? <Pause className="w-4 h-4"/> : playback?.inspectorId===selected.id && !playback.playing && playback.index === selected.points.length - 1 ? <CheckCircle2 className="w-4 h-4"/> : <Play className="w-4 h-4"/>}
                {playback?.playing && playback.inspectorId===selected.id ? 'PAUSAR' : playback?.inspectorId===selected.id && !playback.playing && playback.index === selected.points.length - 1 ? 'REINICIAR' : 'SIMULAR RECORRIDO'}
              </button>
              {(() => {
                const isFinished = playback?.inspectorId===selected.id && !playback.playing && playback.index === selected.points.length - 1;
                return (
                  <button onClick={(e) => { e.stopPropagation(); setPlayback(null); onStop(); }} className={`px-3 py-2 rounded-lg border text-[10px] font-mono transition-all ${isFinished ? 'border-emerald-500/50 bg-emerald-500/15 text-emerald-300 animate-pulse' : 'border-white/10 text-white/60 hover:text-white'}`} title={isFinished ? 'Recorrido completado — limpiar mapa' : 'Limpiar simulación'}>
                    {isFinished ? 'LIMPIAR ✓' : 'RESET'}
                  </button>
                );
              })()}
            </div>
            {playback && playback.inspectorId===selected.id && (
              <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                <div className="h-full transition-all duration-500" style={{ width: `${((playback.index+1)/selected.points.length)*100}%`, background: selected.color }} />
              </div>
            )}
            {/* ── LIVE RTSP → HLS ── */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <button onClick={()=> setShowLiveConfig(v=>!v)} className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-[10px] font-mono font-bold border transition-colors ${showLiveConfig?'bg-[#17A7D2]/20 border-[#17A7D2]/40 text-white':'border-white/10 text-white/60 hover:text-white'}`}>
                  <Settings2 className="w-3 h-3"/> {showLiveConfig ? 'OCULTAR CONFIG' : 'CONFIGURAR LIVE'}
                  <span className={`ml-1 px-1.5 py-0.5 rounded text-[8px] ${liveStatus==='live'?'bg-emerald-500 text-white':liveStatus==='connecting'?'bg-amber-500 text-black':'bg-white/10 text-white/40'}`}>{liveStatus.toUpperCase()}</span>
                </button>
                <button onClick={async ()=>{ setLiveRefreshing(true); try{ await fetchLive(true);} finally{ setTimeout(()=>setLiveRefreshing(false), 800); } }} title="Verificar señal" disabled={liveRefreshing} className="px-2.5 py-1.5 rounded-md border border-white/10 hover:bg-white/10 text-white/60 disabled:opacity-50"><RefreshCw className={`w-3 h-3 ${liveRefreshing ? 'animate-spin' : ''}`}/></button>
              </div>
              {showLiveConfig && (
                <div className="rounded-lg border border-white/[0.06] bg-black/30 p-2.5 space-y-2">
                  <div className="flex items-center gap-1.5 text-[10px] font-mono text-white/50"><Wifi className="w-3 h-3 text-[#17A7D2]"/> {lanIp ? `Servidor: ${lanIp}` : 'Detectando IP…'} <span className="ml-auto text-[9px] text-white/20">puerto 8554</span></div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-mono tracking-widest text-white/40">URL RTSP PARA LARIX (copia y pega en el teléfono)</label>
                    <div className="flex gap-1.5">
                      <input value={effectiveRtsp} onChange={e=> setRtspInputs(s=>({ ...s, [selected.id]: e.target.value }))} className="flex-1 px-2.5 py-1.5 rounded-md bg-black/50 border border-white/10 text-[11px] font-mono text-[#17A7D2] placeholder:text-white/20 focus:outline-none focus:border-[#17A7D2]/40" placeholder="rtsp://192.168.50.127:8554/SIAP-01" />
                      <button onClick={()=> handleCopy(effectiveRtsp, 'rtsp')} className="px-2.5 py-1.5 rounded-md border border-white/10 bg-white/5 hover:bg-white/10 text-white/70"><Copy className="w-3.5 h-3.5"/>{copied==='rtsp' && <Check className="w-3 h-3 text-emerald-400 ml-1"/>}</button>
                    </div>
                    <div className="flex gap-1.5">
                      <button onClick={handleConnect} disabled={!!liveConnecting[selected.id]} className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-[10px] font-mono font-bold tracking-widest text-white disabled:opacity-50" style={{ background: selected.color }}>
                        <Radio className="w-3 h-3"/> {liveConnecting[selected.id] ? 'CONECTANDO…' : liveStatus==='live' ? 'RE-CONECTAR' : 'HABILITAR CÁMARA'}
                      </button>
                      <button onClick={()=> handleCopy(hlsUrl || '', 'hls')} title="Copiar HLS" className="px-2.5 py-1.5 rounded-md border border-white/10 bg-white/5 hover:bg-white/10 text-white/50 text-[10px] font-mono"><Copy className="w-3 h-3"/></button>
                    </div>
                    <p className="text-[9px] font-mono text-white/25 leading-snug">En Larix: crea nueva conexión → URL = la de arriba → Start. Luego dale a HABILITAR CÁMARA aquí y click en el preview.</p>
                  </div>
                </div>
              )}
              <SiapLiveViewer inspectorId={selected.id} inspectorName={selected.name} color={selected.color} hlsUrl={hlsUrl} whepUrl={whepUrl} proxyWhepUrl={proxyWhepUrl} rtspUrl={effectiveRtsp} status={liveStatus as any} onRetry={()=> fetchLive(true)} />
            </div>
            {/* Mini 3D inclinado tiempo real — debajo del simulacro, con dot/trail smooth si existe */}
            <SiapMini3D
              inspector={selected}
              playback={liveDot && liveDot.inspectorId===selected.id ? liveDot : (playback && playback.inspectorId===selected.id && selected.points[playback.index] ? { lng: selected.points[playback.index].lng, lat: selected.points[playback.index].lat, inspectorId: selected.id } : null)}
              trail={liveTrail && (liveTrail as any).coordinates?.length ? liveTrail as any : (playback && playback.inspectorId===selected.id ? { type: 'LineString', coordinates: selected.points.slice(0, playback.index + 1).map(p => [p.lng, p.lat] as [number, number]), color: selected.color } : null)}
            />
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
