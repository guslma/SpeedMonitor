import fs from 'node:fs';
import { Op } from 'sequelize';
import tests from '../models/Speedtests.js';
import nodes from '../models/Node.js';
import * as services from './services.js';
import { cloudflareCity, distance, locate, locateSelf, reachableKm, resolve, reverseName } from '../util/geo.js';
import { airportOf, AIRPORTS } from '../util/airports.js';
import { writePasswordHeaders } from '../util/passwordHeader.js';

const HOST_PORT = /:\d+$/;
const DAYS = 30;

// Home is where the nearest test server is (the list Ookla gives is sorted by distance to this connection),
// or else where this server's public address is
export const home = async () => {
    try {
        const list = Object.values(JSON.parse(fs.readFileSync("data/servers/ookla.json", "utf8")))
            .filter((server) => server.host).sort((a, b) => a.distance - b.distance);
        for (const server of list.slice(0, 3)) {
            const ip = await resolve(server.host.replace(HOST_PORT, ""));
            const place = ip && (await locate([ip]))[ip];
            if (place) return {lat: place.lat, lon: place.lon, city: server.name || place.city,
                country: server.country || place.country, cc: server.cc || place.cc};
        }
    } catch {}
    const self = await locateSelf();
    return self && {lat: self.lat, lon: self.lon, city: self.city, country: self.country, cc: self.cc};
};

// The servers the speed tests used in the last 30 days
const testServers = async () => {
    const rows = await tests.findAll({
        where: {serverHost: {[Op.ne]: null}}, order: [["created", "DESC"]], limit: 5000,
        attributes: ["serverName", "serverHost", "ping", "created"], raw: true
    }).then((list) => {
        // Dates are kept as ISO text, so they are compared here
        const since = Date.now() - DAYS * 86400000;
        return list.filter((row) => new Date(row.created).getTime() >= since);
    });
    const byHost = new Map();
    for (const row of rows) {
        if (!row.serverHost) continue;
        const entry = byHost.get(row.serverHost) || {name: row.serverName, host: row.serverHost, tests: 0, pings: [], last: null};
        entry.tests++;
        if (row.ping > 0) entry.pings.push(row.ping);
        if (!entry.last || new Date(row.created) > new Date(entry.last)) entry.last = row.created;
        byHost.set(row.serverHost, entry);
    }
    return Promise.all([...byHost.values()].map(async ({pings, ...entry}) => ({
        ...entry,
        ping: pings.length ? Math.round(pings.reduce((a, b) => a + b, 0) / pings.length) : null,
        ip: await resolve(entry.host.replace(HOST_PORT, ""))
    })));
};

const addedServers = async () => Promise.all((await nodes.findAll({raw: true})).map(async (node) => {
    try {
        const res = await fetch(node.url + "/api/map/home",
            {headers: writePasswordHeaders(node.password), signal: AbortSignal.timeout(5000)});
        const place = res.ok ? await res.json() : null;
        return place?.lat !== undefined ? {id: node.id, name: node.name, ...place} : {id: node.id, name: node.name};
    } catch {
        return {id: node.id, name: node.name};
    }
}));

const isCloudflare = (place) => /cloudflare/i.test(place?.org || "");
// Networks that answer from copies all over the world: where their addresses are registered says nothing
const SPREAD_OUT = /google|netflix|amazon|aws|akamai|fastly|microsoft|azure|facebook|meta platforms|apple|edgecast|limelight|cdn77|bunny/i;

// Where each service really answers from, from the most to the least certain:
//  "name"       its server's name has the city's airport code (for2 = Fortaleza)
//  "cloudflare" it is on Cloudflare, which answers from the city it reports for this connection
//  "address"    where its address is registered, when the response time makes that possible
//  "estimate"   none of the above: the place of a service (or test server) that answers just as fast
//  "nearby"     not even that: only known to be within reach
const placeServices = async (checked, places, here, servers) => {
    const names = await Promise.all(checked.map((service) => service.ip ? reverseName(service.ip) : null));
    const cloudflare = checked.some((service) => isCloudflare(places[service.ip])) ? await cloudflareCity() : null;
    const cloudflarePlace = cloudflare && AIRPORTS[cloudflare.toLowerCase()];

    const placed = checked.map(({hours, ip, ...service}, index) => {
        const rtt = service.typicalRtt || service.rtt;
        const reach = rtt ? reachableKm(rtt) : null;
        const base = {...service, rtt, reachKm: reach};
        const byName = airportOf(names[index]);
        if (byName) return {...base, lat: byName.lat, lon: byName.lon, city: byName.city, cc: byName.cc, located: "name", hint: byName.code};

        const found = places[ip];
        if (found && isCloudflare(found) && cloudflarePlace) {
            const [city, cc, lat, lon] = cloudflarePlace;
            return {...base, lat, lon, city, cc, located: "cloudflare", hint: cloudflare};
        }
        if (found && !SPREAD_OUT.test(found.org || "") && (!here || !reach || distance(here, found) <= reach))
            return {...base, lat: found.lat, lon: found.lon, city: found.city, country: found.country, cc: found.cc, located: "address"};
        return {...base, located: ip ? "nearby" : "unknown"};
    });

    // Estimates: the known place whose response time is closest, when it is close enough and within reach
    const references = [
        ...placed.filter((service) => ["name", "cloudflare", "address"].includes(service.located) && service.rtt)
            .map((service) => ({name: service.name, rtt: service.rtt, lat: service.lat, lon: service.lon, city: service.city, cc: service.cc, country: service.country})),
        ...servers.filter((server) => server.lat !== undefined && server.ping > 0)
            .map((server) => ({name: server.name, rtt: server.ping, lat: server.lat, lon: server.lon, city: server.city, cc: server.cc, country: server.country}))
    ];
    return placed.map((service) => {
        if (service.located !== "nearby" || !service.rtt || !here) return service;
        const best = references
            .filter((reference) => distance(here, reference) <= service.reachKm)
            .sort((a, b) => Math.abs(a.rtt - service.rtt) - Math.abs(b.rtt - service.rtt))[0];
        if (!best || Math.abs(best.rtt - service.rtt) > Math.max(10, service.rtt * 0.3)) return service;
        return {...service, lat: best.lat, lon: best.lon, city: best.city, cc: best.cc, country: best.country,
            located: "estimate", hint: best.name};
    });
};

export const map = async () => {
    const [here, servers, checked, added] = await Promise.all([home(), testServers(), services.summary(), addedServers()]);
    const places = await locate([...servers.map((server) => server.ip), ...checked.map((service) => service.ip)]);

    const place = (ip) => {
        const found = ip && places[ip];
        return found ? {lat: found.lat, lon: found.lon, city: found.city, country: found.country, cc: found.cc, org: found.org} : null;
    };
    const located = servers.map(({ip, ...server}) => ({...server, ...place(ip)}));

    return {
        home: here,
        servers: located,
        services: await placeServices(checked, places, here, located),
        nodes: added
    };
};
