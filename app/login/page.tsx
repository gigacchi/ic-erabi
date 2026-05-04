'use client';

import { useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';

function LoginForm() {
  const params = useSearchParams();
  const next = params.get('next') ?? '/';
  const [pw, setPw] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(false);
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: pw }),
    });
    if (res.ok) {
      window.location.href = next;
    } else {
      setError(true);
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ position: 'relative' }}>
        <input
          type={show ? 'text' : 'password'}
          value={pw}
          onChange={(e) => setPw(e.target.value)}
          placeholder="パスワード"
          autoFocus
          style={{
            width: '100%',
            padding: '12px 44px 12px 14px',
            borderRadius: 10,
            border: error ? '1.5px solid #c83232' : '1.5px solid #d8d3c4',
            fontSize: 16,
            outline: 'none',
            background: '#fff',
            color: '#1a1810',
            boxSizing: 'border-box',
          }}
        />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          style={{
            position: 'absolute', right: 10, top: '50%',
            transform: 'translateY(-50%)',
            background: 'none', border: 'none',
            padding: 4, cursor: 'pointer',
            color: '#9f9b8e', lineHeight: 0,
          }}
        >
          {show ? (
            // 目を閉じるアイコン
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19M1 1l22 22"
                stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          ) : (
            // 目を開くアイコン
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M1 12S5 4 12 4s11 8 11 8-4 8-11 8S1 12 1 12z"
                stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <circle cx="12" cy="12" r="3"
                stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          )}
        </button>
      </div>
      {error && (
        <p style={{ fontSize: 12, color: '#c83232', margin: 0 }}>パスワードが違います</p>
      )}
      <button
        type="submit"
        disabled={loading || pw.length === 0}
        style={{
          padding: '13px',
          borderRadius: 10,
          border: 'none',
          background: '#1a1810',
          color: '#f3efe2',
          fontSize: 15,
          fontWeight: 700,
          cursor: loading || pw.length === 0 ? 'default' : 'pointer',
          opacity: loading || pw.length === 0 ? 0.6 : 1,
          fontFamily: 'inherit',
        }}
      >
        {loading ? '確認中…' : '入る'}
      </button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <main style={{
      minHeight: '100dvh',
      background: '#f3efe2',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
      fontFamily: '"Hiragino Sans","Yu Gothic",-apple-system,sans-serif',
    }}>
      <div style={{ width: '100%', maxWidth: 320 }}>
        <div style={{ marginBottom: 28, textAlign: 'center' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#6f6a5a', letterSpacing: '.05em', marginBottom: 4 }}>
            HIGHWAY ROUTE
          </div>
          <div style={{ fontSize: 20, fontWeight: 800, color: '#1a1810' }}>ICえらび</div>
        </div>
        <div style={{
          background: '#fff',
          borderRadius: 16,
          border: '1px solid #d8d3c4',
          padding: 20,
          boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
        }}>
          <Suspense>
            <LoginForm />
          </Suspense>
        </div>
      </div>
    </main>
  );
}
