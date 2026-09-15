'use client';
import { useEffect, useRef, useState } from 'react';

export default function LiveDirectPage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [ip, setIp] = useState('192.168.50.124');
  const [inspector, setInspector] = useState('SIAP-01');
  const [status, setStatus] = useState('idle');
  const [mode, setMode] = useState<'webrtc'|'hls'>('webrtc');

  useEffect(() => {
    fetch('/api/network/ip').then(r=>r.json()).then(d=>{ if(d.lanIp) setIp(d.lanIp); }).catch(()=>{});
  }, []);

  const origin = typeof window !== 'undefined' ? window.location.origin : `http://${ip}:3000`;
  const hlsUrl = `${origin}/api/siap/stream/${inspector}/index.m3u8`;
  const whepUrl = `${origin}/api/siap/whep/${inspector}/whep`;
  const rtspUrl = `rtsp://${ip}:8554/${inspector}`;
  const directHlsUrl = `http://${ip}:8888/${inspector}/index.m3u8`;
  const directWhepUrl = `http://${ip}:8889/${inspector}/whep`;

  const playWebRTC = async () => {
    if (!videoRef.current) return;
    setStatus('conectando webrtc...');
    setMode('webrtc');
    try {
      const pc = new RTCPeerConnection();
      pc.addTransceiver('video', { direction: 'recvonly' });
      pc.addTransceiver('audio', { direction: 'recvonly' });
      pc.ontrack = (e) => {
        if (videoRef.current) {
          videoRef.current.srcObject = e.streams[0];
          videoRef.current.play().catch(()=>{});
          setStatus('WebRTC EN VIVO <0.4s');
        }
      };
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      const res = await fetch(whepUrl, { method: 'POST', headers: { 'Content-Type': 'application/sdp' }, body: offer.sdp });
      if (!res.ok) throw new Error(`WHEP ${res.status}`);
      const answer = await res.text();
      await pc.setRemoteDescription({ type: 'answer', sdp: answer });
      (window as any)._pc = pc;
      setTimeout(() => { if (!videoRef.current?.srcObject) { setStatus('webrtc sin pista, prueba HLS'); } }, 3000);
    } catch (e:any) {
      setStatus(`webrtc falló: ${e.message} — prueba HLS`);
    }
  };

  const playHls = async () => {
    if (!videoRef.current) return;
    setStatus('cargando HLS...');
    setMode('hls');
    const Hls = (await import('hls.js')).default;
    if (Hls.isSupported() && videoRef.current) {
      const hls = new Hls({ enableWorker: true, lowLatencyMode: true });
      hls.loadSource(hlsUrl);
      hls.attachMedia(videoRef.current);
      hls.on(Hls.Events.MANIFEST_PARSED, () => { setStatus('HLS EN VIVO ~2s'); videoRef.current?.play().catch(()=>{}); });
      hls.on(Hls.Events.ERROR, (_e, data) => { if (data.fatal) setStatus(`HLS error ${data.details}`); });
      (window as any)._hls = hls;
    } else if (videoRef.current.canPlayType('application/vnd.apple.mpegurl')) {
      videoRef.current.src = hlsUrl;
      videoRef.current.play().catch(()=>{});
      setStatus('HLS nativo');
    }
  };

  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center p-6 gap-4">
      <h1 className="text-xl font-mono font-bold tracking-widest">SIAP LIVE DIRECT</h1>
      <p className="text-xs font-mono text-white/50">Página web directa sin proxy Next — va directo a MediaMTX {ip}:8889/8888</p>
      
      <div className="flex gap-2 flex-wrap justify-center">
        <input value={ip} onChange={e=>setIp(e.target.value)} placeholder="IP" className="px-3 py-1.5 rounded bg-white/10 border border-white/20 text-sm font-mono w-40" />
        <select value={inspector} onChange={e=>setInspector(e.target.value)} className="px-3 py-1.5 rounded bg-white/10 border border-white/20 text-sm font-mono">
          <option>SIAP-01</option><option>SIAP-02</option><option>SIAP-03</option>
        </select>
      </div>

      <div className="text-[11px] font-mono text-white/40">
        RTSP directo (VLC): <span className="text-[#17A7D2]">{rtspUrl}</span> · HLS proxy: {hlsUrl} · WebRTC proxy: {whepUrl} <br/> Directo MediaMTX: {directHlsUrl} · {directWhepUrl} (requiere https para cookie Secure)
      </div>

      <div className="flex gap-2">
        <button onClick={playWebRTC} className="px-4 py-2 rounded bg-emerald-600 hover:bg-emerald-500 text-sm font-mono font-bold">▶ WebRTC &lt;0.4s</button>
        <button onClick={playHls} className="px-4 py-2 rounded bg-white/10 hover:bg-white/20 text-sm font-mono">▶ HLS ~2s</button>
        <button onClick={()=> { if((window as any)._pc) (window as any)._pc.close(); if((window as any)._hls) (window as any)._hls.destroy(); const v=videoRef.current; if(v){ v.pause(); v.srcObject=null; v.src=''; } setStatus('detenido'); }} className="px-4 py-2 rounded bg-white/5 border border-white/10 text-sm font-mono">■ Stop</button>
      </div>

      <div className="text-xs font-mono text-amber-300">{status} · modo {mode}</div>

      <div className="w-full max-w-4xl aspect-video bg-zinc-900 rounded-xl overflow-hidden border border-white/10">
        <video ref={videoRef} autoPlay muted playsInline controls className="w-full h-full object-contain bg-black" />
      </div>

      <p className="text-[11px] font-mono text-white/30 max-w-2xl text-center">
        Abre esta misma página en otro dispositivo/otra pestaña: <span className="text-white">http://{ip}:3000/live-direct</span> o directo sin Next: <span className="text-white">http://{ip}:8888/{inspector}</span> (MediaMTX player). No pasa por el dashboard OSIRIS.
      </p>
    </div>
  );
}
