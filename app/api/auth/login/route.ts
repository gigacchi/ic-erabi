import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  const { password } = await request.json();
  const expected = (process.env.ACCESS_PASSWORD ?? '').trim();

  if (!expected || password.trim() !== expected) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // クッキー値はBase64で安全な文字列に変換
  const token = Buffer.from(expected).toString('base64');
  const res = NextResponse.json({ ok: true });
  res.cookies.set('ic_access', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 30, // 30日
    path: '/',
  });
  return res;
}
