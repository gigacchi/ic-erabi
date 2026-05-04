import { NextRequest, NextResponse } from 'next/server';
import { computeMultipleRoutes } from '@/lib/recommend';
import type { SearchCondition } from '@/types';

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as SearchCondition;

    if (!body.origin || !body.entranceIcId || !body.exitIcId) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }

    const candidates = await computeMultipleRoutes(body);
    return NextResponse.json({ candidates });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
