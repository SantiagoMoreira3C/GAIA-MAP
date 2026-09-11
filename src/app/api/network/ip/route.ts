import { NextResponse } from 'next/server';
import os from 'node:os';

export const dynamic = 'force-dynamic';

function getLanIp(): string | null {
  const ifaces = os.networkInterfaces();
  let fallback: string | null = null;
  // Prioritize physical WiFi/Ethernet, ignore vEthernet/WSL/Hyper-V
  const sorted = Object.entries(ifaces).sort(([a], [b]) => {
    const score = (k: string) => {
      const l = k.toLowerCase();
      if (l.includes('wi-fi') || l.includes('wifi') || l === 'wi-fi') return 0;
      if (l.includes('ethernet') && !l.includes('vethernet') && !l.includes('wsl') && !l.includes('hyper-v')) return 1;
      if (l.includes('wlan')) return 1;
      return 10;
    };
    return score(a) - score(b);
  });
  for (const [, addrs] of sorted) {
    if (!addrs) continue;
    for (const a of addrs) {
      if (a.family !== 'IPv4' || a.internal) continue;
      if (a.address.startsWith('127.') || a.address.startsWith('169.254.')) continue;
      // Skip WSL/Hyper-V subnets
      if (a.address.startsWith('192.168.192.') || a.address.startsWith('172.18.') || a.address.startsWith('172.19.') || a.address.startsWith('172.20.')) {
        fallback = fallback || a.address;
        continue;
      }
      if (a.address.startsWith('192.168.') || a.address.startsWith('10.')) return a.address;
      fallback = a.address;
    }
  }
  return fallback;
}

export async function GET(req: Request) {
  const lanIp = getLanIp();
  const url = new URL(req.url);
  const host = req.headers.get('host') || `${lanIp || 'localhost'}:3000`;
  const proto = req.headers.get('x-forwarded-proto') || (url.protocol.replace(':', '') || 'http');

  if (!lanIp) {
    return NextResponse.json({ lanIp: null, urls: {}, warning: 'No LAN IP detected' }, { status: 200 });
  }

  const rtspBase = `rtsp://${lanIp}:8554`;
  const hlsBase = `http://${lanIp}:8888`;
  const proxyBase = `${proto}://${host}`;

  return NextResponse.json({
    lanIp,
    host,
    urls: {
      rtsp: {
        // Ejemplo para Larix: rtsp://192.168.50.127:8554/SIAP-01
        example: `${rtspBase}/SIAP-01`,
        perInspector: (id: string) => `${rtspBase}/${id}`,
        base: rtspBase,
        port: 8554,
      },
      hls: {
        base: hlsBase,
        perInspector: (id: string) => `${hlsBase}/${id}/index.m3u8`,
      },
      proxyHls: {
        perInspector: (id: string) => `${proxyBase}/api/siap/stream/${id}/index.m3u8`,
      },
      webrtc: {
        base: `http://${lanIp}:8889`,
      },
    },
    inspectors: ['SIAP-01', 'SIAP-02', 'SIAP-03'],
    instructions: {
      larix: `En Larix Broadcaster -> Connection URL = rtsp://${lanIp}:8554/SIAP-01 (cambia SIAP-01 por SIAP-02/03 según inspector)`,
    },
  });
}
