'use client';
import { useEffect, useRef } from 'react';
import * as maplibregl from 'maplibre-gl';
import { installTerrainTileProtocol } from '@/lib/terrain-tiles';
import { attachTerrain } from '@/lib/map-terrain';
import type { SiapInspector } from '@/lib/siap';
import 'maplibre-gl/dist/maplibre-gl.css';

interface Props {
  inspector: SiapInspector | null;
  playback: { lng: number; lat: number; inspectorId: string; heading?: number } | null;
  trail: { type: 'LineString'; coordinates: [number, number][]; color?: string } | null;
}

export default function SiapMini3D({ inspector, playback, trail }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    installTerrainTileProtocol((maplibregl as any).addProtocol);
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: '/dark-matter-style.json',
      center: inspector ? [inspector.route.coordinates[Math.floor(inspector.route.coordinates.length / 2)][0], inspector.route.coordinates[Math.floor(inspector.route.coordinates.length / 2)][1]] as [number, number] : [-80.712, -0.963],
      zoom: 12.2,
      pitch: 58,
      bearing: -18,
      minZoom: 1.5,
      maxPitch: 60,
      attributionControl: false,
    });
    mapRef.current = map;
    // Terrain inclinado tiempo real
    (map as any)._siapTerrainDetach = attachTerrain(map, () => {});
    map.on('load', () => {
      map.addSource('mini-route', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      map.addSource('mini-trail', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      map.addSource('mini-dot', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      map.addLayer({ id: 'mini-route-casing', type: 'line', source: 'mini-route', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#001014', 'line-width': 6, 'line-opacity': 0.6 } });
      map.addLayer({ id: 'mini-route-line', type: 'line', source: 'mini-route', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': ['get', 'color'], 'line-width': 3, 'line-opacity': 0.25, 'line-dasharray': [4, 6] } });
      map.addLayer({ id: 'mini-trail-casing', type: 'line', source: 'mini-trail', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#001014', 'line-width': 7, 'line-opacity': 0.85 } });
      map.addLayer({ id: 'mini-trail', type: 'line', source: 'mini-trail', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': ['get', 'color'], 'line-width': 4.5, 'line-opacity': 1 } });
      map.addLayer({ id: 'mini-dot-glow', type: 'circle', source: 'mini-dot', paint: { 'circle-radius': 14, 'circle-color': ['get', 'color'], 'circle-opacity': 0.25, 'circle-blur': 0.8 } });
      map.addLayer({ id: 'mini-dot', type: 'circle', source: 'mini-dot', paint: { 'circle-radius': 6, 'circle-color': ['get', 'color'], 'circle-stroke-width': 2, 'circle-stroke-color': '#fff' } });
    });
    return () => {
      try { (map as any)._siapTerrainDetach?.(); } catch {}
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Update route when inspector changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !(map as any).isStyleLoaded?.() && !(map as any).loaded?.()) return;
    const src = map.getSource('mini-route') as any;
    if (!src) return;
    if (!inspector) {
      src.setData({ type: 'FeatureCollection', features: [] });
      return;
    }
    const feat = { type: 'Feature' as const, geometry: inspector.route, properties: { color: inspector.color } };
    src.setData({ type: 'FeatureCollection', features: [feat] });
    // Centra con inclinación
    const coords = inspector.route.coordinates as [number, number][];
    const lats = coords.map(c => c[1]), lngs = coords.map(c => c[0]);
    const center: [number, number] = [(Math.min(...lngs) + Math.max(...lngs)) / 2, (Math.min(...lats) + Math.max(...lats)) / 2];
    try { map.flyTo({ center, zoom: 12.4, pitch: 58, bearing: -18, duration: 1200 }); } catch {}
  }, [inspector]);

  // Update trail + dot en tiempo real
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const trailSrc = map.getSource('mini-trail') as any;
    const dotSrc = map.getSource('mini-dot') as any;
    if (trailSrc) {
      if (!trail || !trail.coordinates.length) trailSrc.setData({ type: 'FeatureCollection', features: [] });
      else trailSrc.setData({ type: 'FeatureCollection', features: [{ type: 'Feature', geometry: trail, properties: { color: trail.color || inspector?.color || '#17A7D2' } }] });
    }
    if (dotSrc) {
      if (!playback) dotSrc.setData({ type: 'FeatureCollection', features: [] });
      else dotSrc.setData({ type: 'FeatureCollection', features: [{ type: 'Feature', geometry: { type: 'Point', coordinates: [playback.lng, playback.lat] }, properties: { color: inspector?.color || '#17A7D2' } }] });
      // Cámara sigue suavemente al dot en 3D (inclinado tiempo real)
      if (playback) {
        try { map.easeTo({ center: [playback.lng, playback.lat], duration: 800, pitch: 58 }); } catch {}
      }
    }
  }, [trail, playback, inspector]);

  if (!inspector) return null;
  return (
    <div className="mx-3 mb-3 rounded-xl overflow-hidden border border-white/[0.08] bg-black/30">
      <div className="flex items-center justify-between px-3 py-2 border-b border-white/[0.06] bg-white/[0.03]">
        <span className="text-[10px] font-mono font-bold tracking-[0.15em] text-white/70">VISTA 3D — TIEMPO REAL</span>
        <span className="text-[9px] font-mono text-white/40">TERRAIN • 60° pitch</span>
      </div>
      <div ref={containerRef} className="w-full h-[180px]" />
      <div className="px-3 py-2 flex items-center gap-2 text-[9px] font-mono text-white/45">
        <span className="w-2 h-2 rounded-full" style={{ background: inspector.color }} />
        <span>{inspector.name} · {inspector.vehicle}</span>
        <span className="ml-auto">{inspector.points.length} pts</span>
      </div>
    </div>
  );
}
