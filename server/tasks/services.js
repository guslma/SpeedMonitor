import net from 'node:net';
import { Op } from 'sequelize';
import checks from '../models/ServiceChecks.js';
import * as config from '../controller/config.js';
import { isOnline } from './connectivity.js';
import { resolve } from '../util/geo.js';
import { parseServices } from '../util/servicesList.js';

// Every two minutes, asks each service for its page: a page that answers is up (slow after 3 seconds), no answer
// or a server error is down. When the internet itself is down nothing is blamed on the services.
const INTERVAL = 2 * 60 * 1000;
const TIMEOUT = 10000;
const SLOW = 3000;
const KEEP_DAYS = 7;
const HEADERS = {"user-agent": "Mozilla/5.0 (compatible; SpeedMonitor)", "accept": "text/html,*/*"};

let timer = null;
let current = null;

// Time to open a connection to the service, which is close to the round trip time
const connectTime = (ip, port) => new Promise((done) => {
    const started = performance.now();
    const socket = net.connect({host: ip, port});
    const finish = (value) => {
        socket.destroy();
        done(value);
    };
    socket.setTimeout(5000, () => finish(null));
    socket.once("connect", () => finish(Math.max(1, Math.round(performance.now() - started))));
    socket.once("error", () => finish(null));
});

export const checkService = async (service) => {
    const url = new URL(service.url);
    const ip = await resolve(url.hostname);
    if (!ip) return {state: "down", ms: null, rtt: null, status: null, ip: null};

    const rtt = await connectTime(ip, url.port || (url.protocol === "https:" ? 443 : 80));
    const started = performance.now();
    try {
        const res = await fetch(service.url, {headers: HEADERS, redirect: "follow", signal: AbortSignal.timeout(TIMEOUT)});
        const ms = Math.round(performance.now() - started);
        res.body?.cancel().catch(() => {});
        const state = res.status >= 500 ? "down" : ms > SLOW ? "slow" : "up";
        return {state, ms, rtt, status: res.status, ip};
    } catch {
        return {state: "down", ms: null, rtt, status: null, ip};
    }
};

const run = async () => {
    const services = parseServices(await config.getValue("services"));
    const online = await isOnline();
    const time = new Date().toISOString();
    const results = online
        ? await Promise.all(services.map(async (service) => ({service: service.id, time, ...await checkService(service)})))
        : services.map((service) => ({service: service.id, time, state: "offline"}));
    await checks.bulkCreate(results);
};

// Only one check runs at a time. A fresh one (the list just changed, or "check now") waits for the running one
// and then runs with the current list; otherwise the running one is enough.
export const checkAll = (fresh = false) => {
    if (current && fresh) return current.catch(() => {}).then(() => checkAll());
    if (!current) current = run().finally(() => {
        current = null;
    });
    return current;
};

export const removeOld = () =>
    checks.destroy({where: {time: {[Op.lt]: new Date(Date.now() - KEEP_DAYS * 86400000).toISOString()}}});

export const start = async () => {
    stop();
    if (await config.getValue("serviceMonitor") === "false") return;
    checkAll(true).catch(() => {});
    timer = setInterval(() => checkAll().catch(() => {}), INTERVAL);
};

export const stop = () => {
    clearInterval(timer);
    timer = null;
};

export const isRunning = () => timer !== null;
