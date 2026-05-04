import { NextResponse } from 'next/server';

export async function GET() {
  const pw = process.env.ACCESS_PASSWORD ?? '';
  return NextResponse.json({
    set: pw.length > 0,
    length: pw.length,
    first: pw[0] ?? null,
    last: pw[pw.length - 1] ?? null,
  });
}
