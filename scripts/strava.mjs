// Pulls the latest public ride and the ride totals from the Strava API into public/strava.json.
// Needs STRAVA_CLIENT_ID, STRAVA_CLIENT_SECRET and STRAVA_REFRESH_TOKEN, from the environment or .env.local
// (`npm run strava:auth` writes the token there).
//
// Privacy: only activities visible to everyone are used, the first and last STRAVA_TRIM_M metres of the
// route are dropped (rides tend to start and end at home), and the route is stored as a bare shape in
// metres around its own centre, so no coordinates are published.
import { writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { loadEnv, requireEnv } from './env.mjs';

const API = 'https://www.strava.com/api/v3';
const OUT = new URL('../public/strava.json', import.meta.url);
const RIDES = new Set(['Ride', 'GravelRide', 'MountainBikeRide', 'EBikeRide', 'EMountainBikeRide']);
// indoor rides have no route, but they still count as days ridden
const DAYS = new Set([...RIDES, 'VirtualRide']);
const TRIM_M = Number(process.env.STRAVA_TRIM_M ?? 1000);

const round = (v, digits = 0) => Math.round(v * 10 ** digits) / 10 ** digits;
const isPublic = (a) => !a.private && a.visibility === 'everyone';

async function accessToken({ clientId, clientSecret, refreshToken }) {
  const res = await fetch('https://www.strava.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
  });
  if (!res.ok) throw new Error(`token: ${res.status} ${await res.text()}`);
  return (await res.json()).access_token;
}

async function get(path, token) {
  const res = await fetch(API + path, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`${path}: ${res.status} ${await res.text()}`);
  return res.json();
}

// Keeps the part of the ride at least `trim` metres away from both the start and the finish.
export function trimByDistance(latlng, distance, trim) {
  const total = distance.at(-1) ?? 0;
  if (total <= trim * 2) return [];
  return latlng.filter((_, i) => distance[i] >= trim && distance[i] <= total - trim);
}

// lat/lng → metres east/north of the route's own centre (equirectangular is plenty at ride scale)
export function toShape(latlng) {
  if (!latlng.length) return [];
  const lat0 = latlng.reduce((sum, [lat]) => sum + lat, 0) / latlng.length;
  const lng0 = latlng.reduce((sum, [, lng]) => sum + lng, 0) / latlng.length;
  const k = (Math.PI / 180) * 6371000;
  return latlng.map(([lat, lng]) => [(lng - lng0) * k * Math.cos((lat0 * Math.PI) / 180), (lat - lat0) * k]);
}

export function downsample(list, n) {
  if (list.length <= n) return list;
  return Array.from({ length: n }, (_, i) => list[Math.round((i * (list.length - 1)) / (n - 1))]);
}

// Every public ride of `year`, summed per local day: { 'YYYY-MM-DD': km }
export function sumDays(activities, year) {
  const days = {};
  for (const a of activities) {
    const day = a.start_date_local.slice(0, 10);
    if (!DAYS.has(a.sport_type) || !isPublic(a) || !day.startsWith(`${year}-`)) continue;
    days[day] = round((days[day] ?? 0) + a.distance / 1000, 1);
  }
  return days;
}

async function yearActivities(token, year) {
  const after = Math.floor(Date.UTC(year, 0, 1) / 1000) - 86400; // a day early; start_date_local decides
  const all = [];
  for (let page = 1; ; page++) {
    const batch = await get(`/athlete/activities?after=${after}&per_page=200&page=${page}`, token);
    all.push(...batch);
    if (batch.length < 200) return all;
  }
}

const totals = (t) => ({
  rides: t.count,
  km: round(t.distance / 1000),
  elevation_m: round(t.elevation_gain),
  hours: round(t.moving_time / 3600),
});

async function main() {
  loadEnv();
  requireEnv('STRAVA_CLIENT_ID', 'STRAVA_CLIENT_SECRET', 'STRAVA_REFRESH_TOKEN');
  const { STRAVA_CLIENT_ID: clientId, STRAVA_CLIENT_SECRET: clientSecret, STRAVA_REFRESH_TOKEN: refreshToken } =
    process.env;
  const token = await accessToken({ clientId, clientSecret, refreshToken });

  const athlete = await get('/athlete', token);
  const stats = await get(`/athletes/${athlete.id}/stats`, token);
  const activities = await get('/athlete/activities?per_page=50', token);
  const ride = activities.find((a) => RIDES.has(a.sport_type) && isPublic(a) && !a.trainer && a.map?.summary_polyline);
  const year = new Date().getFullYear();
  const days = sumDays(await yearActivities(token, year), year);

  let last = null;
  if (ride) {
    const streams = await get(`/activities/${ride.id}/streams?keys=latlng,distance,altitude&key_by_type=true`, token);
    const route = toShape(trimByDistance(streams.latlng?.data ?? [], streams.distance?.data ?? [], TRIM_M));
    last = {
      date: ride.start_date_local.slice(0, 10),
      km: round(ride.distance / 1000, 1),
      elevation_m: round(ride.total_elevation_gain),
      moving_s: ride.moving_time,
      avg_kmh: round(ride.average_speed * 3.6, 1),
      route: downsample(route, 400).map(([x, y]) => [round(x), round(y)]),
      profile: downsample(streams.altitude?.data ?? [], 120).map((v) => round(v)),
    };
  }

  // no timestamp on purpose: the file only changes (and gets committed) when the data does
  const data = {
    profile: `https://www.strava.com/athletes/${athlete.id}`,
    last,
    ytd: totals(stats.ytd_ride_totals),
    calendar: { year, days },
    all: totals(stats.all_ride_totals),
  };
  await writeFile(OUT, JSON.stringify(data) + '\n');
  console.log(last ? `last ride ${last.date}: ${last.km} km, ${last.route.length} route points` : 'no public outdoor ride found');
  console.log(`${year}: ${Object.keys(days).length} days ridden`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
}
