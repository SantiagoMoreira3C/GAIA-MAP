import { NextResponse } from 'next/server';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

export const dynamic = 'force-static';
export const revalidate = 3600;

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const inspector = searchParams.get('inspector');
  try {
    const file = path.join(process.cwd(), 'public', 'data', 'siap-inspections.json');
    const raw = await readFile(file, 'utf-8');
    const json = JSON.parse(raw);
    if (inspector) {
      const filtered = json.inspectors.filter((i: any) => i.id === inspector);
      return NextResponse.json({ ...json, inspectors: filtered });
    }
    return NextResponse.json(json, {
      headers: { 'Cache-Control': 'public, max-age=3600, stale-while-revalidate=600' },
    });
  } catch (e) {
    return NextResponse.json({ error: 'SIAP data unavailable', detail: String(e) }, { status: 500 });
  }
}
