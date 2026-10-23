/* Sample rows for every dataset in the catalog, generated deterministically from
   the synthetic population so the same dataset always shows the same rows.
   Columns carry their PII tag; the console masks tagged columns by role. */
import { mulberry32, sampleEvents, minimize } from './engine.js?v=20261023-3';

const NAMES = ['Ana', 'Ben', 'Chloe', 'Diego', 'Emma', 'Farah', 'Hiro', 'Ines', 'Jonah', 'Lea', 'Mateo', 'Nora', 'Omar', 'Priya', 'Sofia', 'Tom'];
const INTENTS = ['find_place', 'route_help', 'hours_question', 'reservation', 'account_help', 'feedback'];
const QUERIES = ['coffee near me', 'pharmacy open now', 'ev charger', 'ramen', 'hardware store', 'gym', 'bookstore', 'bakery', 'parking downtown', 'vet clinic'];
const PLACES = ['cafe', 'restaurant', 'fitness', 'retail', 'health', 'automotive'];

const col = (name, type, pii) => ({ name, type, pii });
const pick = (r, a) => a[Math.floor(r() * a.length)];
const hours = (n) => new Date(Date.now() - n * 36e5).toISOString().slice(0, 19) + 'Z';

function usersOf(p, ds, n) {
  const pool = p.users.filter((u) => (ds.region === 'EU' ? u.eu : !u.eu));
  return pool.slice(0, n);
}

export const SAMPLES = {
  raw: {
    cols: [col('event_id', 'string'), col('user_id', 'string', 'user_id'), col('idfa', 'string', 'device_id'), col('event_name', 'string'), col('query', 'string'), col('latitude', 'double', 'precise_location'), col('longitude', 'double', 'precise_location'), col('ts', 'timestamp')],
    rows: (p, ds) => usersOf(p, ds, 4).flatMap((u) => sampleEvents(u, 3)).map((e) => [e.event_id, e.user_id, e.idfa, e.event_name, e.query || '', e.latitude, e.longitude, e.ts]),
  },
  clean: {
    cols: [col('event_id', 'string'), col('user_id', 'string', 'user_id'), col('session_id', 'string'), col('event_name', 'string'), col('city', 'string', 'coarse_location'), col('geohash5', 'string', 'coarse_location'), col('ts_hour', 'timestamp')],
    rows: (p, ds) => usersOf(p, ds, 4).flatMap((u) => sampleEvents(u, 3).map((e) => { const m = minimize(e); return [e.event_id, e.user_id, 's_' + e.event_id.slice(2, 6), e.event_name, e.city, m.geohash5, m.ts]; })),
  },
  features: {
    cols: [col('user_id', 'string', 'user_id'), col('sessions_7d', 'int'), col('ctr_7d', 'double'), col('top_place_category', 'string'), col('searches_7d', 'int'), col('att_authorized', 'bool'), col('snapshot_ts', 'timestamp')],
    rows: (p, ds) => usersOf(p, ds, 12).map((u) => { const r = mulberry32(parseInt(u.id.slice(2), 10) + 5); return [u.id, 2 + Math.floor(r() * 30), (r() * 0.08).toFixed(4), pick(r, PLACES), Math.floor(r() * 40), u.att === 'authorized', hours(6)]; }),
  },
  metrics: {
    cols: [col('date', 'date'), col('region', 'string'), col('sessions', 'int'), col('active_users', 'int'), col('avg_session_sec', 'int'), col('search_success_rate', 'double')],
    rows: () => { const r = mulberry32(42); const out = []; for (let d = 0; d < 4; d++) for (const reg of ['US-CA', 'US-NY', 'US-TX']) out.push([new Date(Date.now() - (d + 1) * 864e5).toISOString().slice(0, 10), reg, 18000 + Math.floor(r() * 9000), 6000 + Math.floor(r() * 3000), 140 + Math.floor(r() * 90), (0.71 + r() * 0.12).toFixed(3)]); return out; },
  },
  convRaw: {
    cols: [col('conversation_id', 'string'), col('user_id', 'string', 'user_id'), col('email', 'string', 'email'), col('message', 'string', 'free_text'), col('intent', 'string'), col('ts', 'timestamp')],
    rows: (p, ds) => usersOf(p, ds, 10).map((u, i) => { const r = mulberry32(i + 99); const n = pick(r, NAMES); const msg = [`Hi, I'm ${n}, can you book a table for 4 at the ramen place on 5th tonight?`, `My email is ${n.toLowerCase()}@example.com, why was I charged twice?`, `Call me at +1 415 555 01${10 + i} when the pharmacy opens`, `Find an EV charger near my office, I'm ${n} from accounting`, `Is the bakery on Pine open Sunday? Ask for ${n}`][i % 5]; return ['c_' + (7100 + i), u.id, `${n.toLowerCase()}.${u.id.slice(-3)}@example.com`, msg, pick(r, INTENTS), hours(i * 3 + 1)]; }),
  },
  convRedacted: {
    cols: [col('conversation_id', 'string'), col('user_id', 'string', 'user_id'), col('message_redacted', 'string'), col('intent', 'string'), col('redactions', 'string'), col('ts', 'timestamp')],
    rows: (p, ds) => SAMPLES.convRaw.rows(p, ds).map(([id, uid, , msg, intent, ts]) => { const kinds = new Set(); const red = msg.replace(/[\w.]+@[\w.]+/g, () => (kinds.add('EMAIL'), '[EMAIL]')).replace(/\+?\d[\d ]{7,}\d/g, () => (kinds.add('PHONE'), '[PHONE]')).replace(new RegExp(`\\b(${NAMES.join('|')})\\b`, 'g'), () => (kinds.add('NAME'), '[NAME]')); return [id, uid, red, intent, [...kinds].join(', ') || 'none', ts]; }),
  },
  search: {
    cols: [col('user_id', 'string', 'user_id'), col('query_text', 'string', 'free_text'), col('result_rank', 'int'), col('clicked', 'bool'), col('dwell_ms', 'int'), col('ts', 'timestamp')],
    rows: (p, ds) => usersOf(p, ds, 12).map((u, i) => { const r = mulberry32(i + 7); return [u.id, pick(r, QUERIES), 1 + Math.floor(r() * 8), r() < 0.42, Math.floor(r() * 40000), hours(i + 1)]; }),
  },
};

/* Which sample shape each catalog dataset uses. */
export function sampleKind(id) {
  if (/_ads$/.test(id)) return 'clean';
  if (/raw|iphone_app_events_v2$/.test(id)) return 'raw';
  if (/clean/.test(id)) return 'clean';
  if (/features/.test(id)) return 'features';
  if (/metrics/.test(id)) return 'metrics';
  if (id === 'assistant_conversations') return 'convRaw';
  if (/redacted/.test(id)) return 'convRedacted';
  if (/search/.test(id)) return 'search';
  return 'clean';
}

/* Dynamic masking: these tags are hidden unless the role is allowed to see them. */
export const MASKED_TAGS = new Set(['device_id', 'email', 'precise_location', 'free_text']);
export const UNMASKED_ROLES = new Set(['data_steward', 'privacy_reviewer', 'legal_reviewer']);
export function mask(value, tag) {
  const v = String(value);
  if (tag === 'email') return v.replace(/^(.).*(@.*)$/, '$1•••$2');
  if (tag === 'device_id') return v.slice(0, 4) + '••••-••••-••••-' + '••••';
  if (tag === 'precise_location') return v.replace(/(\.\d)\d+$/, '$1•••••');
  if (tag === 'free_text') return '•••• ' + v.split(' ').length + ' words';
  return '••••';
}
