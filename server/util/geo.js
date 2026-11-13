import fs from 'node:fs';
import path from 'node:path';
import dns from 'node:dns/promises';
import net from 'node:net';

// Where an address is, for the map. ip-api.com has no key and answers up to 100 addresses at once; the
// answers are kept for a week in data/geo-cache.json, so it is asked rarely.
const CACHE_FILE = path.join(process.cwd(), 'data', 'geo-cache.json');
const CACHE_TIME = 7 * 86400000;
const EARTH_RADIUS = 6371;

let cache = null;
const loadCache = () => {
    if (cache) return cache;
    try {
        cache = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
    } catch {
        cache = {};
    }
    return cache;
};
const saveCache = () => {
    try {
        fs.writeFileSync(CACHE_FILE, JSON.stringify(cache));
    } catch {}
};

const isPrivate = (ip) => /^(10\.|127\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.|::1$|f[cd])/i.test(ip);

export const resolve = async (host) => {
    if (net.isIP(host)) return host;
    try {
        return (await dns.lookup(host, {family: 4})).address;
    } catch {
        return null;
    }
};

// Locates several addresses; the result has an entry only for the ones that could be found
// ip-api.com takes at most 15 batches a minute; a call can be kept to fewer, leaving the rest for a later one
export const BATCHES_PER_MINUTE = 14;

export const locate = async (ips, {maxBatches = Infinity} = {}) => {
    const known = loadCache();
    const now = Date.now();
    const missing = [...new Set(ips.filter((ip) => ip && !isPrivate(ip) && !(known[ip] && now - known[ip].at < CACHE_TIME)))];

    for (let i = 0; i < missing.length && i / 100 < maxBatches; i += 100) {
        try {
            const res = await fetch("http://ip-api.com/batch?fields=status,query,city,regionName,country,countryCode,lat,lon,org", {
                method: "POST",
                headers: {"content-type": "application/json"},
                body: JSON.stringify(missing.slice(i, i + 100)),
                signal: AbortSignal.timeout(8000)
            });
            if (!res.ok) break;
            for (const row of await res.json()) {
                if (row.status === "success")
                    known[row.query] = {city: row.city, region: row.regionName, country: row.country, cc: row.countryCode,
                        lat: row.lat, lon: row.lon, org: row.org, at: now};
            }
        } catch {
            break;
        }
    }
    if (missing.length) saveCache();

    return Object.fromEntries(ips.filter((ip) => known[ip]).map((ip) => {
        const {at, ...place} = known[ip];
        return [ip, place];
    }));
};

// Where this server's own public address is (used when there is no nearby test server to go by)
export const locateSelf = async () => {
    const known = loadCache();
    if (known.self && Date.now() - known.self.at < CACHE_TIME) return known.self;
    try {
        const res = await fetch("http://ip-api.com/json/?fields=status,city,regionName,country,countryCode,lat,lon",
            {signal: AbortSignal.timeout(8000)});
        const row = await res.json();
        if (row.status !== "success") return null;
        known.self = {city: row.city, region: row.regionName, country: row.country, cc: row.countryCode,
            lat: row.lat, lon: row.lon, at: Date.now()};
        saveCache();
        return known.self;
    } catch {
        return null;
    }
};

export const distance = (a, b) => {
    const rad = Math.PI / 180;
    const dLat = (b.lat - a.lat) * rad;
    const dLon = (b.lon - a.lon) * rad;
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2;
    return 2 * EARTH_RADIUS * Math.asin(Math.sqrt(h));
};

// Light in fiber covers about 100 km per millisecond of round trip: an answer faster than that from an address
// said to be farther away comes from a nearby copy of the service (big services answer from close to you)
export const reachableKm = (rtt) => rtt * 100;

// The name an address has (reverse DNS): big networks put the city's airport code in it (for2, gru3...)
export const reverseName = async (ip) => {
    const known = loadCache();
    const key = "name:" + ip;
    if (known[key] && Date.now() - known[key].at < CACHE_TIME) return known[key].name;
    let name = null;
    try {
        name = (await dns.reverse(ip))[0] || null;
    } catch {}
    known[key] = {name, at: Date.now()};
    saveCache();
    return name;
};

// The Cloudflare city that serves this connection (all Cloudflare sites answer from it), from its public trace
let colo = null;
export const cloudflareCity = async () => {
    if (colo && Date.now() - colo.at < 3600000) return colo.code;
    try {
        const text = await (await fetch("https://1.1.1.1/cdn-cgi/trace", {signal: AbortSignal.timeout(5000)})).text();
        colo = {code: /^colo=([A-Z]{3})$/m.exec(text)?.[1] || null, at: Date.now()};
    } catch {
        colo = {code: null, at: Date.now()};
    }
    return colo.code;
};
