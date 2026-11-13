import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import net from 'node:net';

// Country of an IPv4 address without asking anyone: DB-IP's free "IP to Country Lite" list (CC BY 4.0,
// https://db-ip.com) is downloaded once a month to data/ and searched here. Used for the thousands of
// attacking addresses on the map, too many to locate one by one.
const FILE = path.join(process.cwd(), 'data', 'dbip-country-lite.csv.gz');
const MAX_AGE = 35 * 86400000;

let table = null;
let loading = null;

const toNumber = (ip) => ip.split(".").reduce((value, part) => value * 256 + Number(part), 0);

const month = (offset) => {
    const date = new Date();
    date.setUTCDate(1);
    date.setUTCMonth(date.getUTCMonth() - offset);
    return date.toISOString().slice(0, 7);
};

const download = async () => {
    for (const offset of [0, 1]) {
        try {
            const res = await fetch(`https://download.db-ip.com/free/dbip-country-lite-${month(offset)}.csv.gz`,
                {signal: AbortSignal.timeout(60000)});
            if (!res.ok) continue;
            fs.writeFileSync(FILE, Buffer.from(await res.arrayBuffer()));
            return true;
        } catch {}
    }
    return false;
};

const parse = () => {
    const lines = zlib.gunzipSync(fs.readFileSync(FILE)).toString("utf8").split("\n");
    const starts = new Uint32Array(lines.length);
    const ends = new Uint32Array(lines.length);
    const codes = new Uint16Array(lines.length);
    const countries = [];
    const index = new Map();
    let count = 0;
    for (const line of lines) {
        const [from, to, cc] = line.split(",");
        if (!cc || !net.isIPv4(from)) continue;
        if (!index.has(cc)) {
            index.set(cc, countries.length);
            countries.push(cc.trim());
        }
        starts[count] = toNumber(from);
        ends[count] = toNumber(to);
        codes[count] = index.get(cc);
        count++;
    }
    return {starts: starts.subarray(0, count), ends: ends.subarray(0, count), codes: codes.subarray(0, count), countries};
};

const prepare = async () => {
    const fresh = fs.existsSync(FILE) && Date.now() - fs.statSync(FILE).mtimeMs < MAX_AGE;
    if (!fresh) await download();
    if (!fs.existsSync(FILE)) return null;
    try {
        return parse();
    } catch {
        return null;
    }
};

// Loads the list (downloading it when missing or older than a month); null when it is not available
export const ready = async () => {
    if (table && fs.existsSync(FILE) && Date.now() - fs.statSync(FILE).mtimeMs < MAX_AGE) return table;
    if (!loading) loading = prepare().then((result) => {
        table = result;
        loading = null;
        return result;
    });
    return loading;
};

export const countryOf = (ip) => {
    if (!table || !net.isIPv4(ip)) return null;
    const value = toNumber(ip);
    let low = 0;
    let high = table.starts.length - 1;
    while (low <= high) {
        const middle = (low + high) >> 1;
        if (table.starts[middle] > value) high = middle - 1;
        else if (table.ends[middle] < value) low = middle + 1;
        else return table.countries[table.codes[middle]];
    }
    return null;
};
