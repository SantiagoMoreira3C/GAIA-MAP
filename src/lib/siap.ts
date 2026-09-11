'use client';

export type Impacto = 'bajo' | 'medio' | 'alto' | 'critico';
export type Estado = 'pendiente' | 'validado' | 'rechazado';

export interface SiapPoint {
  id: string;
  orden: number;
  titulo: string;
  descripcion: string;
  lng: number;
  lat: number;
  impacto: Impacto;
  estado: Estado;
  fecha: string;
  fotos: string[];
  video: string | null;
  thumb: string;
}

export type SiapLiveStatus = 'offline' | 'connecting' | 'live';
export interface SiapLiveState {
  status: SiapLiveStatus;
  rtspUrl: string;
  hlsUrl: string;
  proxyHlsUrl: string;
  updatedAt: string;
  lastSeen?: string;
}
export interface SiapInspector {
  id: string;
  name: string;
  role: string;
  avatar: string;
  color: string;
  vehicle: 'moto' | 'a pie';
  route: { type: 'LineString'; coordinates: [number, number][] };
  points: SiapPoint[];
  live?: SiapLiveState;
}

export interface SiapData {
  version: string;
  generated: string;
  center: { lng: number; lat: number; zoom: number };
  inspectors: SiapInspector[];
}

export const MANTA_CENTER = { lng: -80.712, lat: -0.963, zoom: 13 };

export function impactoColor(impacto: Impacto): string {
  switch (impacto) {
    case 'critico': return '#D32F2F';
    case 'alto': return '#FF6F00';
    case 'medio': return '#FFC400';
    case 'bajo': return '#00C853';
  }
}

export function toGeoJSONPoints(inspectors: SiapInspector[]) {
  const features = inspectors.flatMap(ins =>
    ins.points.map(p => ({
      type: 'Feature' as const,
      geometry: { type: 'Point' as const, coordinates: [p.lng, p.lat] as [number, number] },
      properties: {
        id: p.id,
        inspectorId: ins.id,
        inspectorName: ins.name,
        inspectorAvatar: ins.avatar,
        color: ins.color,
        vehicle: ins.vehicle,
        orden: p.orden,
        titulo: p.titulo,
        descripcion: p.descripcion,
        impacto: p.impacto,
        estado: p.estado,
        fecha: p.fecha,
        fotos: p.fotos,
        video: p.video,
        thumb: p.thumb,
      },
    }))
  );
  return { type: 'FeatureCollection' as const, features };
}

export function toGeoJSONRoutes(inspectors: SiapInspector[]) {
  return {
    type: 'FeatureCollection' as const,
    features: inspectors.map(ins => ({
      type: 'Feature' as const,
      geometry: ins.route,
      properties: {
        inspectorId: ins.id,
        inspectorName: ins.name,
        color: ins.color,
        vehicle: ins.vehicle,
        pointsCount: ins.points.length,
      },
    })),
  };
}

export async function fetchSiap(): Promise<SiapData> {
  const res = await fetch('/api/siap', { cache: 'no-store' });
  if (!res.ok) throw new Error('SIAP fetch failed');
  return res.json();
}
