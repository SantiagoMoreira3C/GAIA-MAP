'use client';
import { useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';
import { Radio, CameraOff, RefreshCw, Maximize2, X, Signal, Copy, Check } from 'lucide-react';

interface Props {
  inspectorId: string;
  inspectorName: string;
  color: string;
  hlsUrl: string | null;
  whepUrl?: string | null;
  proxyWhepUrl?: string | null;
  rtspUrl: string | null;
  status: 'offline' | 'connecting' | 'live';
  onRetry?: () => void;
  onClose?: () => void;
}

export default function SiapLiveViewer({ inspectorId, inspectorName, color, hlsUrl, whepUrl, proxyWhepUrl, rtspUrl, status, onRetry, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [stallCount, setStallCount] = useState(0);
  const [mode, setMode] = useState<'webrtc' | 'hls'>('webrtc');
  const [refreshing, setRefreshing] = useState(false);
  const retryTimer = useRef<number | null>(null);

  const startHls = (video: HTMLVideoElement) => {
    if (!hlsUrl) { setError(true); setLoading(false); return; }
    if (Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: false,
        backBufferLength: 30,
        maxBufferLength: 10,
        liveSyncDurationCount: 3,
        liveMaxLatencyDurationCount: 5,
      });
      hlsRef.current = hls;
      hls.loadSource(hlsUrl);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        setLoading(false);
        setStallCount(0);
        setMode('hls');
        video.play().catch(() => {});
      });
      const scheduleRetry = () => {
        if (retryTimer.current) clearTimeout(retryTimer.current);
        retryTimer.current = window.setTimeout(() => {
          setError(false);
          setLoading(true);
          hls.startLoad();
          video.play().catch(() => {});
        }, 2000);
      };
      hls.on(Hls.Events.ERROR, (_e, data) => {
        if (data.details === 'bufferStalledError' || (data.details as string) === 'bufferNudgeOnStall') {
          setStallCount(c => c + 1);
          hls.recoverMediaError();
          return;
        }
        if ((data.details as string) === 'bufferSeekOverHole' || (data.details as string) === 'bufferHole') return;
        if (data.fatal) {
          if (data.type === Hls.ErrorTypes.MEDIA_ERROR) { hls.recoverMediaError(); scheduleRetry(); return; }
          if (data.type === Hls.ErrorTypes.NETWORK_ERROR) { hls.startLoad(); scheduleRetry(); return; }
          setStallCount(c => {
            const n = c + 1;
            if (n >= 3) { setError(true); setLoading(false); }
            else scheduleRetry();
            return n;
          });
        }
      });
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = hlsUrl;
      video.addEventListener('loadedmetadata', () => { setLoading(false); setMode('hls'); video.play().catch(()=>{}); }, { once: true });
      video.addEventListener('error', () => { setError(true); setLoading(false); }, { once: true });
    } else {
      setError(true); setLoading(false);
    }
  };

  useEffect(() => {
    setError(false);
    setStallCount(0);
    setLoading(true);
    if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null; }
    if (pcRef.current) { try { pcRef.current.close(); } catch {} pcRef.current = null; }
    if (retryTimer.current) { clearTimeout(retryTimer.current); retryTimer.current = null; }
    if (status !== 'live' || !videoRef.current) {
      setLoading(false);
      return;
    }
    const video = videoRef.current;

    // HTTP solo: HLS vía proxy (200 en 200ms) — WebRTC deshabilitado para no dejar negro 10s
    const whep = proxyWhepUrl || whepUrl;
    const fallbackWhep = whepUrl && proxyWhepUrl && whep !== proxyWhepUrl ? (whep === whepUrl ? proxyWhepUrl : whepUrl) : null;
    const canWebRTC = false;

    if (canWebRTC && whep) {
      let cancelled = false;
      const startWebRTC = async () => {
        try {
          const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
          pcRef.current = pc;
          pc.addTransceiver('video', { direction: 'recvonly' });
          pc.addTransceiver('audio', { direction: 'recvonly' });
          pc.ontrack = (e) => {
            if (cancelled) return;
            video.srcObject = e.streams[0];
            video.play().catch(()=>{});
            setLoading(false);
            setMode('webrtc');
            setStallCount(0);
          };
          pc.onconnectionstatechange = () => {
            if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
              if (!cancelled && !hlsRef.current) {
                pc.close();
                startHls(video);
              }
            }
          };
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          let res: Response | null = null;
          let lastErr = '';
          for (const url of [whep, fallbackWhep].filter(Boolean) as string[]) {
            try {
              const r = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/sdp' },
                body: offer.sdp,
              });
              if (r.ok) { res = r; break; }
              lastErr = `WHEP ${r.status} at ${url}`;
            } catch (e) { lastErr = String(e); }
          }
          if (!res || !res.ok) throw new Error(lastErr || `WHEP failed`);
          const answer = await res.text();
          await pc.setRemoteDescription({ type: 'answer', sdp: answer });
          // si en 4s no llega track, fallback a HLS
          setTimeout(() => {
            if (cancelled) return;
            if (!video.srcObject && pc.connectionState !== 'connected') {
              try { pc.close(); } catch {}
              if (!hlsRef.current) startHls(video);
            }
          }, 4000);
        } catch (e) {
          if (cancelled) return;
          // Fallback directo a HLS
          startHls(video);
        }
      };
      startWebRTC();
      return () => {
        cancelled = true;
        if (retryTimer.current) clearTimeout(retryTimer.current);
        if (pcRef.current) { try { pcRef.current.close(); } catch {} pcRef.current = null; }
        hlsRef.current?.destroy(); hlsRef.current = null;
        video.srcObject = null;
      };
    }

    // Sin WebRTC → HLS directo
    startHls(video);
    return () => {
      if (retryTimer.current) clearTimeout(retryTimer.current);
      hlsRef.current?.destroy(); hlsRef.current = null;
      if (pcRef.current) { try { pcRef.current.close(); } catch {} pcRef.current = null; }
    };
  }, [hlsUrl, whepUrl, proxyWhepUrl, status]);

  const copyRtsp = async () => {
    if (!rtspUrl) return;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(rtspUrl);
      } else throw new Error('no clipboard');
    } catch {
      // fallback para http / 192.168.x donde clipboard exige HTTPS
      try {
        const ta = document.createElement('textarea');
        ta.value = rtspUrl;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      } catch {}
    }
    setCopied(true); setTimeout(()=>setCopied(false), 1800);
  };

  return (
    <div className="rounded-xl overflow-hidden border border-white/[0.08] bg-black/40">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-white/[0.06]" style={{ background: `${color}12` }}>
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${status==='live' ? 'bg-emerald-500 animate-pulse shadow-[0_0_6px_#10b981]' : status==='connecting' ? 'bg-amber-500 animate-pulse' : 'bg-white/30'}`} />
          <span className="text-[11px] font-mono font-bold tracking-widest text-white flex items-center gap-1.5">
            <Radio className="w-3 h-3" /> {inspectorId} · {status==='live' ? 'EN VIVO' : status==='connecting' ? 'CONECTANDO…' : 'SIN SEÑAL'}
          </span>
        </div>
        <div className="flex items-center gap-1">
          {onRetry && <button onClick={async () => { setRefreshing(true); try { await onRetry(); } finally { setTimeout(()=>setRefreshing(false), 1200); } }} title="Verificar señal" disabled={refreshing} className="w-6 h-6 rounded flex items-center justify-center hover:bg-white/10 text-white/60 disabled:opacity-50"><RefreshCw className={`w-3 h-3 ${refreshing ? 'animate-spin' : ''}`} /></button>}
          {onClose && <button onClick={onClose} title="Cerrar" className="w-6 h-6 rounded flex items-center justify-center hover:bg-white/10 text-white/60"><X className="w-3 h-3" /></button>}
        </div>
      </div>

      {/* Video / placeholder — el <video> siempre montado para no perder frame al recuperar */}
      <div className="relative aspect-video bg-black">
        {status==='live' ? (
          <>
            <video ref={videoRef} className="w-full h-full object-cover bg-black" autoPlay muted playsInline controls={false} />
            {loading && !error && <div className="absolute inset-0 flex items-center justify-center bg-black/60 z-10"><div className="w-5 h-5 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: color, borderTopColor: 'transparent' }} /><span className="ml-2 text-[10px] font-mono text-white/70">CARGANDO SEÑAL…</span></div>}
            {error ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/75 z-10 p-4 text-center">
                <p className="text-[11px] font-mono font-bold tracking-widest text-amber-400">SEÑAL INTERMITENTE</p>
                <p className="text-[9px] font-mono text-white/50 mt-1">Reconectando… {stallCount ? `(${stallCount})` : ''}</p>
                {onRetry && <button onClick={async () => { setError(false); setStallCount(0); setRefreshing(true); try { await onRetry(); } finally { setTimeout(()=>setRefreshing(false), 1200); } }} disabled={refreshing} className="mt-2 px-3 py-1 rounded bg-white/10 border border-white/10 text-[10px] font-mono text-white/80 disabled:opacity-50 flex items-center gap-1.5 mx-auto">{refreshing ? <RefreshCw className="w-3 h-3 animate-spin"/> : null}REINTENTAR</button>}
              </div>
            ) : (
              <>
                <div className="absolute top-2 left-2 flex items-center gap-1 px-2 py-0.5 rounded bg-red-600 text-white text-[9px] font-mono font-bold tracking-widest"><span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" /> REC · EN VIVO</div>
                <div className="absolute bottom-2 right-2 px-2 py-1 rounded bg-black/70 text-white text-[9px] font-mono">{inspectorName}</div>
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-[0.04]"><div className="w-[90%] h-px bg-white absolute top-1/2" /><div className="h-[90%] w-px bg-white absolute left-1/2" /></div>
              </>
            )}
            {/* overlay leve de stall sin oscurecer del todo */}
            {stallCount > 0 && !error && !loading && <div className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[8px] font-mono">BUFFER {stallCount}</div>}
          </>
        ) : status==='connecting' ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center">
            <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin mb-3" style={{ borderColor: color, borderTopColor: 'transparent' }} />
            <p className="text-[11px] font-mono font-bold tracking-widest" style={{ color }}>ADQUIRIENDO SEÑAL</p>
            <p className="text-[9px] font-mono text-white/40 mt-1">Esperando a Larix…</p>
            {rtspUrl && <p className="text-[9px] font-mono text-white/20 mt-2 break-all">{rtspUrl}</p>}
          </div>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.04),transparent_70%)]">
            <CameraOff className="w-8 h-8 text-white/20 mb-3" />
            <p className="text-[12px] font-mono font-bold tracking-[0.18em] text-white/80">SIN SEÑAL</p>
            <p className="text-[10px] font-mono text-white/35 mt-1">No hay transmisión activa para {inspectorId}</p>
            <p className="text-[9px] font-mono text-white/25 mt-1">Publica desde Larix a:</p>
            {rtspUrl && (
              <button onClick={copyRtsp} className="mt-2 px-2.5 py-1 rounded bg-white/5 border border-white/10 hover:bg-white/10 text-[10px] font-mono text-white/70 flex items-center gap-1.5 max-w-full">
                <span className="truncate">{rtspUrl}</span>{copied ? <Check className="w-3 h-3 text-emerald-400"/> : <Copy className="w-3 h-3"/>}
              </button>
            )}
            {onRetry && <button onClick={onRetry} className="mt-3 px-3 py-1.5 rounded-md text-[10px] font-mono font-bold tracking-widest border" style={{ borderColor: color+'40', color, background: color+'12' }}>REINTENTAR</button>}
          </div>
        )}
      </div>

      {/* Footer meta */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-black/30 border-t border-white/[0.04]">
        <span className="text-[9px] font-mono text-white/30 flex items-center gap-1"><Signal className="w-3 h-3"/>{status==='live' ? (mode==='webrtc' ? 'RTSP → WebRTC · 0.3s' : 'RTSP → HLS · 2s') : status==='connecting' ? 'RTSP esperando' : 'RTSP offline'}</span>
        <span className="text-[9px] font-mono" style={{ color: status==='live' ? '#10b981' : status==='connecting' ? '#f59e0b' : '#6b7280' }}>{status==='live' ? (mode==='webrtc' ? '● WebRTC' : '● HLS') : status==='connecting' ? '◐ CONECTANDO' : '○ INACTIVO'}</span>
      </div>
    </div>
  );
}
