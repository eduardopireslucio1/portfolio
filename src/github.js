const API = 'https://api.github.com';
const TTL = 30 * 60 * 1000;

function cacheGet(key) {
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    const { t, v } = JSON.parse(raw);
    return Date.now() - t < TTL ? v : null;
  } catch {
    return null;
  }
}

function cacheSet(key, v) {
  try {
    sessionStorage.setItem(key, JSON.stringify({ t: Date.now(), v }));
  } catch {
    // storage full or blocked: just skip the cache
  }
}

async function get(path) {
  const res = await fetch(API + path, { headers: { Accept: 'application/vnd.github+json' } });
  if (!res.ok) throw new Error(`GitHub ${res.status}`);
  return res.json();
}

// Profile + public repo languages, trimmed to the fields the page uses.
// Unauthenticated API allows 60 req/h per IP, hence the session cache.
export async function loadGitHub(user) {
  const key = `gh:v2:${user}`;
  const hit = cacheGet(key);
  if (hit) return hit;

  const [p, repos] = await Promise.all([
    get(`/users/${user}`),
    get(`/users/${user}/repos?per_page=100&sort=pushed`),
  ]);

  const data = {
    profile: {
      login: p.login,
      repos: p.public_repos,
      followers: p.followers,
      since: new Date(p.created_at).getFullYear(),
    },
    repos: repos.map((r) => ({ name: r.name, language: r.language, fork: r.fork })),
  };
  cacheSet(key, data);
  return data;
}
