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

export async function GET(req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  const segments = path || [];
  if (!segments.length) return NextResponse.json({ error: 'path requerido' }, { status: 400 });

  // Solo permitir paths de HLS: {inspector}/index.m3u8 o {inspector}/seg_*.ts etc
  const inspectorId = segments[0];
  if (!/^SIAP-\d{2}$/.test(inspectorId)) {
    return NextResponse.json({ error: 'inspector inválido' }, { status: 400 });
  }

  const subPath = segments.join('/');
  const lanIp = getLanIp();
  // En docker mediamtx es accesible por nombre de servicio; en dev/host usa lanIp
  const candidates = [
    `http://siap-mediamtx:8888/${subPath}`,
    `http://${lanIp}:8888/${subPath}`,
    `http://127.0.0.1:8888/${subPath}`,
  ];

  const search = new URL(req.url).search;
  let lastError: string | null = null;

  for (const base of candidates) {
    const url = base + search;
    try {
      const upstream = await fetch(url, {
        cache: 'no-store',
        signal: AbortSignal.timeout(5000),
        headers: {
          // Reenviar range si es segmento
          ...(req.headers.get('range') ? { Range: req.headers.get('range')! } : {}),
        },
      });

      if (!upstream.ok && upstream.status === 404) {
        lastError = `404 ${url}`;
        continue; // probar siguiente host
      }
      if (!upstream.ok) {
        lastError = `${upstream.status} ${url}`;
        // si es 502/503, intentar otro host
        if (upstream.status >= 502) continue;
        return new NextResponse(upstream.body, {
          status: upstream.status,
          headers: {
            'Cache-Control': 'no-store',
            'Content-Type': upstream.headers.get('content-type') || 'application/octet-stream',
          },
        });
      }

      const contentType = upstream.headers.get('content-type') || (subPath.endsWith('.m3u8') ? 'application/vnd.apple.mpegurl' : 'video/MP2T');
      const headers: Record<string, string> = {
        'Cache-Control': subPath.endsWith('.m3u8') ? 'no-cache, no-store' : 'public, max-age=1',
        'Content-Type': contentType,
        'Access-Control-Allow-Origin': '*',
      };
      const cl = upstream.headers.get('content-length');
      if (cl) headers['Content-Length'] = cl;

      // Para m3u8, reescribir URLs absolutas si las hubiera (MediaMTX usa relativas, pero por si acaso)
      if (subPath.endsWith('.m3u8')) {
        const text = await upstream.text();
        // Las URLs en m3u8 son relativas; no hace falta reescribir. Pero aseguramos que no expongan lanIp interno.
        return new NextResponse(text, { status: 200, headers });
      }

      return new NextResponse(upstream.body, { status: 200, headers });
    } catch (e) {
      lastError = String(e);
      continue;
    }
  }

  return NextResponse.json({ error: 'HLS no disponible', detail: lastError, hint: 'Verifica que MediaMTX esté corriendo y Larix esté publicando' }, { status: 404 });
}
