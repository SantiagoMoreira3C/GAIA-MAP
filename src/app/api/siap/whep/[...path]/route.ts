import { NextResponse } from 'next/server';
import os from 'node:os';

export const dynamic = 'force-dynamic';

function getLanIp(): string {
  const ifaces = os.networkInterfaces();
  const sorted = Object.entries(ifaces).sort(([a],[b])=>{
    const s=(k:string)=>{ const l=k.toLowerCase(); if(l.includes('wi-fi')||l.includes('wifi')) return 0; if(l.includes('ethernet')&&!l.includes('vethernet')&&!l.includes('wsl')) return 1; return 10; };
    return s(a)-s(b);
  });
  for (const [,addrs] of sorted) {
    if(!addrs) continue;
    for (const a of addrs) {
      if(a.family!=='IPv4'||a.internal) continue;
      if(a.address.startsWith('127.')||a.address.startsWith('169.254.')) continue;
      if(a.address.startsWith('192.168.192.')||a.address.startsWith('172.18.')||a.address.startsWith('172.19.')) continue;
      if(a.address.startsWith('192.168.')||a.address.startsWith('10.')) return a.address;
    }
  }
  return '127.0.0.1';
}

// Proxy WHEP (WebRTC) — POST offer SDP -> answer SDP
// Usado por SiapLiveViewer para <500ms latencia. MediaMTX WHEP está en :8889
export async function POST(req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  const segments = path || [];
  if (!segments.length) return NextResponse.json({ error: 'path requerido' }, { status: 400 });
  const inspectorId = segments[0];
  if (!/^SIAP-\d{2}$/.test(inspectorId)) return NextResponse.json({ error: 'inspector inválido' }, { status: 400 });

  const subPath = segments.join('/'); // SIAP-01/whep
  const lanIp = getLanIp();
  const candidates = [
    `http://siap-mediamtx:8889/${subPath}`,
    `http://${lanIp}:8889/${subPath}`,
    `http://127.0.0.1:8889/${subPath}`,
  ];

  const body = await req.text();
  const contentType = req.headers.get('content-type') || 'application/sdp';

  for (const base of candidates) {
    try {
      const upstream = await fetch(base, {
        method: 'POST',
        body,
        headers: { 'Content-Type': contentType },
        signal: AbortSignal.timeout(8000),
      });
      const text = await upstream.text();
      return new NextResponse(text, {
        status: upstream.status,
        headers: {
          'Content-Type': upstream.headers.get('content-type') || 'application/sdp',
          'Access-Control-Allow-Origin': '*',
        },
      });
    } catch (e) {
      continue;
    }
  }
  return NextResponse.json({ error: 'WHEP no disponible', hint: 'Verifica MediaMTX :8889 y que Larix esté publicando' }, { status: 502 });
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
