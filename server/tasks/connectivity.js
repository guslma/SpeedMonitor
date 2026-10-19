import net from 'node:net';
import * as outages from '../controller/outages.js';
import * as config from '../controller/config.js';
import { sendOutage } from './integrations.js';

// Lightweight check between speedtests: opens a TCP connection to a few public DNS services, so it costs
// almost no data. Two failed checks in a row (about a minute) count as an outage.
const INTERVAL = 30 * 1000;
const FAILURES_FOR_OUTAGE = 2;
const TARGETS = [["1.1.1.1", 443], ["8.8.8.8", 443], ["9.9.9.9", 443], ["208.67.222.222", 443]];
const ROUTER_PORTS = [80, 443, 53];

let timer;
let firstFailure = null;
let failures = 0;
let current = null;
let checking = false;

// Resolves true when the connection opens. A refused connection does not count: Bun also reports
// ECONNREFUSED when there is no network at all.
const probe = (host, port, timeout = 3000) => new Promise((resolve) => {
    const socket = net.connect({host, port});
    const done = (result) => {
        socket.destroy();
        resolve(result);
    };
    socket.setTimeout(timeout, () => done(false));
    socket.once("connect", () => done(true));
    socket.once("error", () => done(false));
});

const anyOf = async (checks) => (await Promise.all(checks)).some(Boolean);

export const isOnline = () => anyOf(TARGETS.map(([host, port]) => probe(host, port)));

const routerAnswers = async () => {
    const router = await config.getValue("router");
    if (!router || router === "none") return null;
    return anyOf(ROUTER_PORTS.map((port) => probe(router, port)));
};

const check = async () => {
    if (checking) return;
    checking = true;
    try {
        const online = await isOnline();
        if (online) {
            failures = 0;
            firstFailure = null;
            if (current) {
                const finished = await outages.finish(current);
                current = null;
                console.log(`Internet is back. The outage lasted ${Math.round((new Date(finished.end) - new Date(finished.start)) / 60000)} min`);
                sendOutage(finished).then(undefined);
            }
            return;
        }

        if (current) {
            await outages.touch(current);
            return;
        }

        failures++;
        if (firstFailure === null) firstFailure = new Date();
        if (failures >= FAILURES_FOR_OUTAGE) {
            const router = await routerAnswers();
            const cause = router === null ? "unknown" : router ? "internet" : "local";
            current = await outages.start(firstFailure, cause);
            console.log(`Internet is down since ${firstFailure.toISOString()} (cause: ${cause})`);
        }
    } catch (e) {
        console.error("Connection check failed: " + e.message);
    } finally {
        checking = false;
    }
};

export const start = async () => {
    stop();
    if (await config.getValue("outageMonitor") === "false") return;
    await outages.closeStale();
    timer = setInterval(() => check(), INTERVAL);
    check().then(undefined);
};

export const stop = () => {
    if (timer) clearInterval(timer);
    timer = undefined;
    failures = 0;
    firstFailure = null;
    current = null;
};
