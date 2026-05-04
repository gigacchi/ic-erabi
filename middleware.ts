import { NextRequest, NextResponse } from 'next/server';

const COOKIE = 'ic_access';
const LOGIN_PATH = '/login';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ログインページ・静的アセットはスルー
  if (pathname === LOGIN_PATH || pathname.startsWith('/_next') || pathname.startsWith('/favicon')) {
    return NextResponse.next();
  }

  // クッキーが正しければ通過
  const token = request.cookies.get(COOKIE)?.value;
  const expected = process.env.ACCESS_PASSWORD;
  if (!expected || token === expected) {
    return NextResponse.next();
  }

  // 未認証 → ログインページへ
  const url = request.nextUrl.clone();
  url.pathname = LOGIN_PATH;
  url.searchParams.set('next', pathname);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
