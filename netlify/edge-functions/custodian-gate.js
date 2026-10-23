/* Server-side gate for /custodian. Runs on Netlify's edge before any file is
   served, so the app's HTML, JS and docs never reach a browser without a valid
   session. The password exists only in the CUSTODIAN_PASSWORD environment
   variable (Netlify site settings), never in the repo or the client.
   Session: HttpOnly cookie "<expiry>.<HMAC-SHA256(password, expiry)>", so
   changing the password signs everyone out. Unconfigured means locked. */

const COOKIE = 'custodian_session';
const MAX_AGE = 60 * 60 * 12;
const enc = new TextEncoder();

async function sign(secret, msg) {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(msg)));
  return btoa(String.fromCharCode(...sig)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
}

// Compare digests, not raw strings, so timing does not leak length or prefix.
async function same(a, b) {
  const [x, y] = await Promise.all([a, b].map((s) => crypto.subtle.digest('SHA-256', enc.encode(s))));
  const u = new Uint8Array(x), v = new Uint8Array(y);
  let d = 0;
  for (let i = 0; i < u.length; i++) d |= u[i] ^ v[i];
  return d === 0;
}

function readCookie(req) {
  const m = (req.headers.get('cookie') || '').match(new RegExp('(?:^|;\\s*)' + COOKIE + '=([^;]+)'));
  return m ? m[1] : null;
}

const NO_STORE = { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow' };

function page(message, status) {
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex, nofollow"><title>Custodian</title>
<style>
:root{--ink:#1d1d1f;--ink2:#6e6e73;--rule:#d2d2d7;--blue:#0071e3;--red:#c9302c;--bg:#fff}
@media (prefers-color-scheme:dark){:root{--ink:#f5f5f7;--ink2:#a1a1a6;--rule:#424245;--bg:#000}}
*{box-sizing:border-box;margin:0}body{min-height:100vh;display:grid;place-items:center;padding:24px 16px;background:var(--bg);color:var(--ink);font:17px/1.4 -apple-system,BlinkMacSystemFont,"SF Pro Text","Helvetica Neue",Arial,sans-serif;-webkit-font-smoothing:antialiased}
main{width:min(100%,400px);text-align:center}svg{width:56px;height:56px;margin:0 auto 22px;display:block}
h1{font:600 32px/1.12 -apple-system,BlinkMacSystemFont,"SF Pro Display",sans-serif}p.sub{margin-top:10px;color:var(--ink2)}
form{margin-top:32px;position:relative}input{width:100%;height:52px;padding:0 56px 0 18px;border:1px solid var(--rule);border-radius:12px;font:inherit;background:transparent;color:inherit}
input:focus{outline:0;border-color:var(--blue);box-shadow:0 0 0 4px rgba(0,113,227,.14)}
button{position:absolute;right:8px;top:8px;width:36px;height:36px;border:1px solid var(--rule);border-radius:50%;background:transparent;color:var(--ink2);font-size:17px;cursor:pointer}
button:hover{color:var(--blue);border-color:var(--blue)}.err{margin-top:12px;min-height:20px;color:var(--red);font-size:13px}.fine{margin-top:28px;font-size:12px;color:var(--ink2)}
</style></head><body><main>
<svg viewBox="0 0 56 56" fill="none" aria-hidden="true"><rect x="1" y="1" width="54" height="54" rx="14" fill="#1d1d1f"/><path d="M28 13l12 4.5v9.2c0 7.9-5.1 14.4-12 16.3-6.9-1.9-12-8.4-12-16.3v-9.2L28 13z" stroke="#f5f5f7" stroke-width="2" stroke-linejoin="round"/><path d="M22.5 28.2l3.8 3.8 7.4-7.6" stroke="#2997ff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>
<h1>Custodian</h1><p class="sub">Enterprise AI data governance. Consent, purpose, access, lineage, erasure and audit for every AI workload.</p>
<form method="post" action="/custodian/__login"><input name="password" type="password" placeholder="Password" autocomplete="current-password" autocapitalize="off" autocorrect="off" spellcheck="false" required autofocus aria-label="Password"><button type="submit" aria-label="Unlock">&rarr;</button><p class="err" role="alert">${message || ''}</p></form>
<p class="fine">Private demo. Synthetic users only.</p></main></body></html>`;
  return new Response(html, { status, headers: { 'Content-Type': 'text/html; charset=utf-8', ...NO_STORE } });
}

export default async (request, context) => {
  const url = new URL(request.url);
  const secret = Netlify.env.get('CUSTODIAN_PASSWORD');
  if (!secret) return page('This demo is locked.', 503);

  if (url.pathname === '/custodian') return Response.redirect(new URL('/custodian/', url), 301);

  if (url.pathname === '/custodian/__logout') {
    return new Response(null, { status: 303, headers: { Location: '/custodian/', 'Set-Cookie': `${COOKIE}=; Path=/custodian; Max-Age=0; HttpOnly; Secure; SameSite=Lax`, ...NO_STORE } });
  }

  if (url.pathname === '/custodian/__login') {
    if (request.method !== 'POST') return Response.redirect(new URL('/custodian/', url), 303);
    const form = await request.formData();
    const pw = String(form.get('password') || '').trim();
    if (!(await same(pw, secret))) {
      await new Promise((r) => setTimeout(r, 800)); // slows guessing
      return page('Incorrect password.', 401);
    }
    const exp = Math.floor(Date.now() / 1000) + MAX_AGE;
    return new Response(null, { status: 303, headers: { Location: '/custodian/', 'Set-Cookie': `${COOKIE}=${exp}.${await sign(secret, String(exp))}; Path=/custodian; Max-Age=${MAX_AGE}; HttpOnly; Secure; SameSite=Lax`, ...NO_STORE } });
  }

  const c = readCookie(request);
  if (c) {
    const [exp, sig] = c.split('.');
    if (Number(exp) > Date.now() / 1000 && sig && (await same(sig, await sign(secret, exp)))) {
      const res = await context.next();
      res.headers.set('Cache-Control', 'private, no-store');
      return res;
    }
  }
  const wantsPage = (request.headers.get('accept') || '').includes('text/html');
  return wantsPage ? page('', 401) : new Response('Unauthorized', { status: 401, headers: NO_STORE });
};

export const config = { path: ['/custodian', '/custodian/*'] };
