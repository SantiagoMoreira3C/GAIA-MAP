import { NextResponse } from 'next/server';
import os from 'node:os';

export const dynamic = 'force-dynamic';

// In-memory registry (per process). Para WiFi local es suficiente.
// Si se quiere persistencia, cambiar a archivo o Redis.
type LiveStatus = 'offline' | 'connecting' | 'live';
interface LiveEntry {
  inspectorId: string;
  rtspUrl: string;
  hlsUrl: string;
  proxyHlsUrl: string;
  whepUrl: string;
  proxyWhepUrl: string;
  status: LiveStatus;
  updatedAt: string;
  lastSeen?: string;
  error?: string;
}

const registry = new Map<string, LiveEntry>();
const VALID_IDS = new Set(['SIAP-01', 'SIAP-02', 'SIAP-03']);

function getLanIp(): string | null {
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
  return null;
}

function inferHlsUrls(inspectorId: string, req: Request) {
  const lanIp = getLanIp() || 'localhost';
  const host = req.headers.get('host') || `${lanIp}:3000`;
  const proto = req.headers.get('x-forwarded-proto') || 'http';
  return {
    hlsUrl: `http://${lanIp}:8888/${inspectorId}/index.m3u8`,
    proxyHlsUrl: `${proto}://${host}/api/siap/stream/${inspectorId}/index.m3u8`,
    whepUrl: `http://${lanIp}:8889/${inspectorId}/whep`,
    proxyWhepUrl: `${proto}://${host}/api/siap/whep/${inspectorId}/whep`,
    rtspUrl: `rtsp://${lanIp}:8554/${inspectorId}`,
  };
}

async function probeHls(hlsUrl: string): Promise<boolean> {
  const tryFetch = async (url: string, withCookie = false): Promise<boolean> => {
    try {
      const res = await fetch(url, {
        method: 'GET',
        cache: 'no-store',
        redirect: 'manual',
        signal: AbortSignal.timeout(3500),
        headers: withCookie ? { Cookie: 'cookieCheck=1' } : {},
      });
      // MediaMTX usa 302 -> ?cookieCheck=1 + Set-Cookie para la primera visita HLS
      if (res.status === 302 || res.status === 301) {
        const loc = res.headers.get('location') || '';
        const setCookie = res.headers.get('set-cookie') || '';
        // seguir el redirect con cookie
        if (loc.includes('cookieCheck')) {
          const nextUrl = loc.startsWith('http') ? loc : new URL(loc, url).toString();
          const cookie = setCookie ? setCookie.split(';')[0] : 'cookieCheck=1';
          try {
            const res2 = await fetch(nextUrl, {
              method: 'GET',
              cache: 'no-store',
              signal: AbortSignal.timeout(3500),
              headers: { Cookie: cookie },
            });
            if (res2.ok) {
              const txt = await res2.text();
              return txt.includes('#EXTM3U');
            }
          } catch {}
          // fallback: reintentar directo con cookieCheck query + cookie header
          try {
            const alt = url.includes('?') ? `${url}&cookieCheck=1` : `${url}?cookieCheck=1`;
            const res3 = await fetch(alt, {
              method: 'GET',
              cache: 'no-store',
              signal: AbortSignal.timeout(3500),
              headers: { Cookie: 'cookieCheck=1' },
            });
            if (res3.ok) {
              const txt = await res3.text();
              return txt.includes('#EXTM3U');
            }
          } catch {}
        }
        return false;
      }
      if (res.ok) {
        const ct = res.headers.get('content-type') || '';
        if (ct.includes('mpegurl') || ct.includes('application/vnd.apple')) {
          const txt = await res.text();
          return txt.includes('#EXTM3U');
        }
        return true;
      }
      return false;
    } catch {
      return false;
    }
  };

  // 1) directo con lanIp
  if (await tryFetch(hlsUrl)) return true;
  // 2) con cookieCheck forzado
  if (await tryFetch(hlsUrl, true)) return true;
  // 3) fallback local
  const localUrl = hlsUrl.replace(/http:\/\/[^/]+:8888/, 'http://127.0.0.1:8888');
  if (localUrl !== hlsUrl && (await tryFetch(localUrl) || await tryFetch(localUrl, true))) return true;
  return false;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const inspector = searchParams.get('inspector');
  const check = searchParams.get('check') === '1';

  // Probe real contra MediaMTX si se pide ?check=1
  if (inspector && check) {
    const lanIp = getLanIp() || '127.0.0.1';
    const hlsUrl = `http://${lanIp}:8888/${inspector}/index.m3u8`;
    const isLive = await probeHls(hlsUrl);
    const entry = registry.get(inspector);
    const status: LiveStatus = isLive ? 'live' : (entry ? 'connecting' : 'offline');
    const urls = inferHlsUrls(inspector, req);
    const updated: LiveEntry = {
      inspectorId: inspector,
      rtspUrl: entry?.rtspUrl || urls.rtspUrl,
      hlsUrl: urls.hlsUrl,
      proxyHlsUrl: urls.proxyHlsUrl,
      whepUrl: urls.whepUrl,
      proxyWhepUrl: urls.proxyWhepUrl,
      status,
      updatedAt: new Date().toISOString(),
      lastSeen: isLive ? new Date().toISOString() : entry?.lastSeen,
    };
    if (isLive) registry.set(inspector, updated);
    return NextResponse.json(updated);
  }

  if (inspector) {
    const entry = registry.get(inspector);
    if (!entry) {
      const urls = inferHlsUrls(inspector, req);
      return NextResponse.json({
        inspectorId: inspector,
        rtspUrl: urls.rtspUrl,
        hlsUrl: urls.hlsUrl,
        proxyHlsUrl: urls.proxyHlsUrl,
        whepUrl: urls.whepUrl,
        proxyWhepUrl: urls.proxyWhepUrl,
        status: 'offline' as LiveStatus,
        updatedAt: new Date().toISOString(),
      });
    }
    // Si lleva > 30s sin check, marcar offline si no hubo lastSeen reciente
    return NextResponse.json(entry);
  }

  // Todos
  const all: Record<string, LiveEntry> = {};
  for (const id of VALID_IDS) {
    const entry = registry.get(id);
    if (entry) all[id] = entry;
    else {
      const urls = inferHlsUrls(id, req);
      all[id] = {
        inspectorId: id,
        rtspUrl: urls.rtspUrl,
        hlsUrl: urls.hlsUrl,
        proxyHlsUrl: urls.proxyHlsUrl,
        whepUrl: urls.whepUrl,
        proxyWhepUrl: urls.proxyWhepUrl,
        status: 'offline',
        updatedAt: new Date().toISOString(),
      };
    }
  }
  return NextResponse.json({ live: all, lanIp: getLanIp() });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { inspectorId, rtspUrl, status } = body as { inspectorId: string; rtspUrl?: string; status?: LiveStatus };
    if (!inspectorId || !VALID_IDS.has(inspectorId)) {
      return NextResponse.json({ error: 'inspectorId inválido. Usa SIAP-01, SIAP-02 o SIAP-03' }, { status: 400 });
    }
    const urls = inferHlsUrls(inspectorId, req);
    // Validación SSRF básica: solo rtsp:// hacia LAN
    if (rtspUrl && !rtspUrl.startsWith('rtsp://')) {
      return NextResponse.json({ error: 'rtspUrl debe empezar con rtsp://' }, { status: 400 });
    }
    const entry: LiveEntry = {
      inspectorId,
      rtspUrl: rtspUrl || urls.rtspUrl,
      hlsUrl: urls.hlsUrl,
      proxyHlsUrl: urls.proxyHlsUrl,
      whepUrl: urls.whepUrl,
      proxyWhepUrl: urls.proxyWhepUrl,
      status: (status as LiveStatus) || 'connecting',
      updatedAt: new Date().toISOString(),
    };
    registry.set(inspectorId, entry);
    return NextResponse.json(entry);
  } catch (e) {
    return NextResponse.json({ error: 'Body inválido', detail: String(e) }, { status: 400 });
  }
}

export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url);
  const inspector = searchParams.get('inspector');
  if (!inspector) return NextResponse.json({ error: 'inspector requerido' }, { status: 400 });
  registry.delete(inspector);
  return NextResponse.json({ ok: true, inspectorId: inspector, status: 'offline' });
}
