import { SPORTSIO_APIKEY } from '$env/static/private';

const BASE_URL = 'https://v1.american-football.api-sports.io';

export async function apiSportsFetch(endpoint) {
  const res = await fetch(`${BASE_URL}${endpoint}`, {
    headers: { 'x-apisports-key': SPORTSIO_APIKEY }
  });
  if (!res.ok) throw new Error(`api-sports.io ${endpoint}: ${res.status}`);
  return res.json();
}

export function normalizeStatus(shortStatus) {
  const map = {
    NS: 'scheduled',
    Q1: 'in_progress', Q2: 'in_progress',
    Q3: 'in_progress', Q4: 'in_progress',
    OT: 'in_progress', HT: 'in_progress',
    FT: 'final', AOT: 'final',
    CANC: 'cancelled', PST: 'postponed'
  };
  return map[shortStatus] ?? 'scheduled';
}

export function getApiWeek(weekType, weekNumber) {
  const playoffMap = {
    wildcard: 19, divisional: 20,
    conference: 21, superbowl: 22
  };
  return playoffMap[weekType] ?? weekNumber;
}
