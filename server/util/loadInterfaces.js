import os from 'node:os';
import https from 'node:https';
import * as config from '../controller/config.js';

export let interfaces = {};

// Whether this address reaches the internet. Every address is tried at the same time, and each one gets at most
// PROBE_TIMEOUT: tried one after another, machines with many VPN or container interfaces took minutes to start.
const PROBE_TIMEOUT = 5000;

const reachesInternet = (address) => new Promise((resolve) => {
    let done = false;
    const finish = (ok) => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        req.destroy();
        resolve(ok);
    };

    const options = {hostname: "speed.cloudflare.com", path: "/__down?bytes=1", method: "GET",
        family: address.family === "IPv4" ? 4 : 6, timeout: PROBE_TIMEOUT, localAddress: address.address};
    options.agent = new https.Agent(options);

    const req = https.request(options, () => finish(true));
    const timer = setTimeout(() => finish(false), PROBE_TIMEOUT);
    req.on('error', () => finish(false));
    req.on('timeout', () => finish(false));
    req.end();
});

export const requestInterfaces = async () => {
    const interfacesNode = os.networkInterfaces();
    const interfacesResult = {};

    console.log("Looking for network interfaces...");
    const candidates = [];
    for (const name in interfacesNode) {
        for (const address of interfacesNode[name]) {
            if (!address.internal) candidates.push({name, address});
        }
    }

    const reachable = await Promise.all(candidates.map(({address}) => reachesInternet(address)));

    // Same order as the system lists them, so the default interface does not change from one start to the next
    candidates.forEach(({name, address}, index) => {
        if (!reachable[index]) return;
        if (!interfacesResult[name]) interfacesResult[name] = [];
        interfacesResult[name].push(address.address);
    });

    for (let i in interfacesResult) {
        for (let j in interfacesResult[i]) {
            if (interfacesResult[i][j].includes(".")) {
                interfaces[i] = interfacesResult[i][j];
                break;
            }
        }

        if (!interfaces[i]) interfaces[i] = interfacesResult[i][0];
    }

    for (let i in interfaces) {
        console.log(`Found interface ${i} with IP ${interfaces[i]}`);
    }

    const currentInterface = await config.getValue("interface");

    if (!interfaces[currentInterface]) {
        if (!currentInterface) {
            console.warn("No interface set. Falling back to default.");
        } else {
            console.warn(`Interface ${currentInterface} not found. Falling back to default.`);
        }
        await config.updateValue("interface", Object.keys(interfaces)[0]);
    }
};