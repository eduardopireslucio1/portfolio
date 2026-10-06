// One-time helper: authorizes the site to read your public rides and saves the refresh token.
// 1. Create an app at https://www.strava.com/settings/api with Authorization Callback Domain: localhost
// 2. Put STRAVA_CLIENT_ID and STRAVA_CLIENT_SECRET in .env.local
// 3. npm run strava:auth, open the link, click Authorize. The token lands in .env.local by itself.
import { createServer } from 'node:http';
import { loadEnv, requireEnv, saveEnv } from './env.mjs';

const PORT = 8723;
const TIMEOUT_MIN = 5;

loadEnv();
try {
  requireEnv('STRAVA_CLIENT_ID', 'STRAVA_CLIENT_SECRET');
} catch (err) {
  console.error(err.message);
  process.exit(1);
}
const { STRAVA_CLIENT_ID: id, STRAVA_CLIENT_SECRET: secret } = process.env;

const authorize = new URL('https://www.strava.com/oauth/authorize');
authorize.search = new URLSearchParams({
  client_id: id,
  response_type: 'code',
  redirect_uri: `http://localhost:${PORT}`,
  approval_prompt: 'force',
  scope: 'read,activity:read',
}).toString();

const page = (title, body) =>
  `<!doctype html><meta charset="utf-8"><title>${title}</title>` +
  `<body style="background:#030304;color:#d7dbe0;font:15px ui-monospace,monospace;padding:48px">` +
  `<h1 style="font-weight:400">${title}</h1><p>${body}</p></body>`;

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  if (url.pathname !== '/') return res.writeHead(404).end();

  const reply = (status, title, body) => res.writeHead(status, { 'Content-Type': 'text/html' }).end(page(title, body));
  const code = url.searchParams.get('code');
  if (!code) {
    reply(400, 'Not authorized', 'Strava did not send a code. Run <code>npm run strava:auth</code> again.');
    return finish(1, `Authorization failed: ${url.searchParams.get('error') ?? 'no code'}`);
  }
  if (!(url.searchParams.get('scope') ?? '').includes('activity:read')) {
    reply(400, 'Almost', 'Keep “View data about your activities” checked and run <code>npm run strava:auth</code> again.');
    return finish(1, 'The activity permission was unchecked on the Strava page, so rides cannot be read.');
  }

  const token = await fetch('https://www.strava.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ client_id: id, client_secret: secret, code, grant_type: 'authorization_code' }),
  });
  const body = await token.json().catch(() => ({}));
  if (!token.ok || !body.refresh_token) {
    reply(500, 'Token exchange failed', 'Check STRAVA_CLIENT_SECRET in .env.local, then try again.');
    return finish(1, `Token exchange failed (${token.status}): ${JSON.stringify(body)}`);
  }

  await saveEnv('STRAVA_REFRESH_TOKEN', body.refresh_token);
  reply(200, 'Done ✓', 'The refresh token is saved in .env.local. You can close this tab and run <code>npm run strava</code>.');
  finish(0, 'Saved STRAVA_REFRESH_TOKEN to .env.local. Next: npm run strava');
});

function finish(code, message) {
  (code ? console.error : console.log)(`\n${message}`);
  server.close();
  setTimeout(() => process.exit(code), 100);
}

server.on('error', (err) => {
  console.error(err.code === 'EADDRINUSE' ? `Port ${PORT} is busy; close whatever uses it and retry.` : err.message);
  process.exit(1);
});

server.listen(PORT, () => {
  console.log(`Open this link and click "Authorize" (waiting ${TIMEOUT_MIN} min):\n\n${authorize}\n`);
  console.log(`If Strava shows "redirect_uri invalid", set Authorization Callback Domain to localhost on strava.com/settings/api.`);
});
setTimeout(() => finish(1, 'Timed out waiting for the authorization.'), TIMEOUT_MIN * 60 * 1000).unref();
