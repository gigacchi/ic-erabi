import { NextRequest, NextResponse } from 'next/server';

const COOKIE = 'ic_access';
const LOGIN_PATH = '/login';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 国外アクセス制限: Vercelが付与するx-vercel-ip-countryヘッダーで判定
  // ヘッダーが存在しない場合（ローカル開発など）はスルー
  const country = request.headers.get('x-vercel-ip-country');
  if (country && country !== 'JP') {
    return new NextResponse(
      `<!DOCTYPE html><html lang="ja"><head><meta charset="UTF-8">
<title>Access Restricted</title>
<style>
  body{font-family:sans-serif;display:flex;align-items:center;justify-content:center;
       min-height:100vh;margin:0;background:#f3efe2;color:#1a1810}
  .box{text-align:center;padding:32px}
  h1{font-size:22px;font-weight:800;margin-bottom:12px}
  p{font-size:13px;color:#6f6a5a;line-height:1.7}
</style>
</head><body>
<div class="box">
  <h1>アクセス制限</h1>
  <p>このサービスは日本国内からのみご利用いただけます。<br>
  This service is only available within Japan.</p>
</div>
</body></html>`,
      { status: 403, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
    );
  }

  // ログインページ・静的アセット・デバッグエンドポイントはスルー
  if (
    pathname === LOGIN_PATH ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.startsWith('/api/auth/')
  ) {
    return NextResponse.next();
  }

  // クッキーが正しければ通過
  const token = request.cookies.get(COOKIE)?.value;
  const expected = (process.env.ACCESS_PASSWORD ?? '').trim();
  if (!expected) return NextResponse.next();
  const expectedToken = btoa(expected);
  if (token === expectedToken) {
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
