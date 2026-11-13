import { BATCHES_PER_MINUTE, locate } from '../util/geo.js';
import { countryOf, ready as countriesReady } from '../util/ipCountry.js';
// The middle of each country (of its biggest piece of land), by two letter code
import CENTROIDS from '../util/countryCentroids.json' with { type: 'json' };

// Attacks around the world, from the SANS Internet Storm Center (DShield): sensors all over the internet record
// who tries to break in. Free and without a key; they update hourly, so the answer is kept for an hour.
// It says where attacks come from, not whom they hit: none of this is about this connection.
// Up to the 10000 addresses that attacked the most today; the first 300 are placed on their city, the rest on
// their country (located with the DB-IP list kept on this server)
const SOURCES = (count) => `https://isc.sans.edu/api/sources/attacks/${count}?json`;
const SIZES = [10000, 5000, 300];
const PRECISE = 300;
// Besides those, up to this many addresses of each country are placed on their city, so big countries show
// several spots; they are located a minute's worth at a time (and kept for a week), the rest wait for the next round
const PER_COUNTRY = 60;
const ROUND = 65 * 1000;
const PORTS = "https://isc.sans.edu/api/topports/records/10?json";
const KEEP = 60 * 60 * 1000;
const HEADERS = {"user-agent": "SpeedMonitor"};

const PORT_NAMES = {
    21: "FTP", 22: "SSH", 23: "Telnet", 25: "SMTP", 53: "DNS", 80: "HTTP", 443: "HTTPS", 445: "SMB",
    1433: "SQL Server", 2323: "Telnet", 3306: "MySQL", 3389: "Remote Desktop", 5555: "Android (ADB)",
    5900: "VNC", 6379: "Redis", 8000: "HTTP", 8080: "HTTP", 8443: "HTTPS", 8888: "HTTP"
};

let cached = null;

const getJson = async (url) => {
    const res = await fetch(url, {headers: HEADERS, signal: AbortSignal.timeout(15000)});
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
};

const fetchSources = async () => {
    for (const size of SIZES) {
        try {
            const list = await getJson(SOURCES(size));
            if (Array.isArray(list) && list.length) return list.filter((row) => row.ip && row.attacks > 0);
        } catch {}
    }
    throw new Error("No attack sources");
};

// The list of the hour: the rounds that place more addresses keep using it (the source changes during the day)
let hourList = null;
let hourPorts = null;

const load = async (fresh = true) => {
    if (fresh || !hourList) {
        [hourList, hourPorts] = await Promise.all([fetchSources(), getJson(PORTS).catch(() => ({})), countriesReady()]);
    }
    const list = [...hourList];
    const ports = hourPorts;
    list.sort((a, b) => b.attacks - a.attacks);
    // Which addresses to place on a city: the biggest first, then the countries taking turns
    const byCountry = new Map();
    for (const row of list.slice(PRECISE)) {
        const cc = countryOf(row.ip);
        if (!cc) continue;
        if (!byCountry.has(cc)) byCountry.set(cc, []);
        if (byCountry.get(cc).length < PER_COUNTRY) byCountry.get(cc).push(row);
    }
    const turns = [...byCountry.values()];
    const wanted = list.slice(0, PRECISE);
    for (let turn = 0; turn < PER_COUNTRY; turn++)
        for (const rows of turns) if (rows[turn]) wanted.push(rows[turn]);
    const places = await locate(wanted.map((row) => row.ip), {maxBatches: BATCHES_PER_MINUTE});
    const precise = wanted.filter((row) => places[row.ip]);
    const pending = wanted.length - precise.length;

    // The first ones on their city: several attacking addresses often share a data center
    const spots = new Map();
    const placed = new Set();
    for (const row of precise) {
        const place = places[row.ip];
        if (!place) continue;
        placed.add(row.ip);
        const key = `${place.lat.toFixed(1)},${place.lon.toFixed(1)}`;
        const spot = spots.get(key) || {lat: place.lat, lon: place.lon, city: place.city, country: place.country,
            cc: place.cc, attacks: 0, addresses: 0};
        spot.attacks += row.attacks;
        spot.addresses++;
        spots.set(key, spot);
    }

    // Every address counts for its country; the ones without a city become one spot in the middle of the country
    const countries = new Map();
    const countrySpots = new Map();
    for (const row of list) {
        const cc = places[row.ip]?.cc || countryOf(row.ip);
        if (!cc) continue;
        const country = countries.get(cc) || {cc, country: places[row.ip]?.country || null, attacks: 0, addresses: 0};
        country.attacks += row.attacks;
        country.addresses++;
        countries.set(cc, country);

        if (placed.has(row.ip) || !CENTROIDS[cc]) continue;
        const spot = countrySpots.get(cc) || {lat: CENTROIDS[cc][0], lon: CENTROIDS[cc][1], cc, attacks: 0, addresses: 0, country: true};
        spot.attacks += row.attacks;
        spot.addresses++;
        countrySpots.set(cc, spot);
    }

    return {
        updated: new Date().toISOString(),
        pending,
        date: ports?.date || null,
        total: {addresses: list.length, countries: countries.size},
        sources: [...spots.values()].sort((a, b) => b.attacks - a.attacks),
        countrySpots: [...countrySpots.values()].map(({country, ...spot}) => spot).sort((a, b) => b.attacks - a.attacks),
        countries: [...countries.values()].sort((a, b) => b.attacks - a.attacks),
        ports: Object.values(ports || {}).filter((row) => row && typeof row === "object" && row.targetport !== undefined)
            .map((row) => ({port: Number(row.targetport), name: PORT_NAMES[row.targetport] || null,
                records: row.records, sources: row.sources}))
            .sort((a, b) => b.records - a.records)
    };
};

let round = null;
let rounds = 0;
const MAX_ROUNDS = 8;

// While some addresses still wait to be placed on a city, another round runs a minute later (the free
// locating service takes a minute's worth at a time); the map shows each round's result
const nextRound = () => {
    if (round || !cached?.pending || rounds >= MAX_ROUNDS) return;
    round = setTimeout(async () => {
        round = null;
        rounds++;
        try {
            cached = {...await load(false), updated: cached.updated};
        } catch {
            return;
        }
        nextRound();
    }, ROUND);
};

export const attacks = async () => {
    if (cached && Date.now() - new Date(cached.updated).getTime() < KEEP) return cached;
    try {
        cached = await load();
        rounds = 0;
        nextRound();
    } catch (error) {
        // Keeps showing the last answer when the source does not answer
        if (!cached) return {error: true, sources: [], countrySpots: [], countries: [], ports: []};
    }
    return cached;
};
