import { NextRequest, NextResponse } from 'next/server';
import { findNearbyEntranceIcs } from '@/lib/ic';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const lat = parseFloat(searchParams.get('lat') ?? '');
  const lng = parseFloat(searchParams.get('lng') ?? '');
  const radiusKm = parseFloat(searchParams.get('radiusKm') ?? '30');
  const includeSmartIc = searchParams.get('includeSmartIc') !== 'false';
  const useEtc = searchParams.get('useEtc') !== 'false';

  if (isNaN(lat) || isNaN(lng)) {
    return NextResponse.json({ error: 'lat and lng are required' }, { status: 400 });
  }

  const ics = findNearbyEntranceIcs({ origin: { lat, lng }, radiusKm, includeSmartIc, useEtc });
  return NextResponse.json(ics);
}
