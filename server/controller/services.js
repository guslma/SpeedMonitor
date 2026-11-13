import { Op } from 'sequelize';
import checks from '../models/ServiceChecks.js';
import * as config from './config.js';
import { parseServices } from '../util/servicesList.js';

const HOUR = 3600000;
// When a service has several states in the same hour, the worst one is shown
const WEIGHT = {down: 3, slow: 2, up: 1, offline: 0};

const median = (values) => {
    if (!values.length) return null;
    const sorted = [...values].sort((a, b) => a - b);
    return sorted[Math.floor(sorted.length / 2)];
};

const isAnswer = (check) => check.state === "up" || check.state === "slow";

// Each service with its last state, since when it is in that state, and the last 24 hours (one entry per hour)
export const summary = async () => {
    const services = parseServices(await config.getValue("services"));
    const now = Date.now();
    const since = new Date(now - 24 * HOUR).toISOString();
    const rows = await checks.findAll({where: {time: {[Op.gte]: since}}, order: [["time", "ASC"]], raw: true});

    return services.map((service) => {
        const list = rows.filter((row) => row.service === service.id);
        const last = list[list.length - 1] || null;
        let streak = list.length - 1;
        while (streak > 0 && last && list[streak - 1].state === last.state) streak--;

        const judged = list.filter((check) => check.state !== "offline");
        const answered = judged.filter(isAnswer);
        const hours = Array.from({length: 24}, (_, i) => {
            const from = now - (24 - i) * HOUR;
            const inHour = list.filter((check) => {
                const time = new Date(check.time).getTime();
                return time >= from && time < from + HOUR;
            });
            return inHour.reduce((worst, check) => worst === null || WEIGHT[check.state] > WEIGHT[worst] ? check.state : worst, null);
        });

        return {
            ...service,
            state: last?.state || null,
            since: last ? list[Math.max(0, streak)].time : null,
            lastCheck: last?.time || null,
            ms: last?.ms ?? null,
            rtt: last?.rtt ?? null,
            // The usual connection time (median of the last checks), steadier than a single one for the map
            typicalRtt: median(list.filter((check) => check.rtt).slice(-15).map((check) => check.rtt)),
            status: last?.status ?? null,
            ip: last?.ip ?? null,
            uptime: judged.length ? parseFloat((answered.length / judged.length * 100).toFixed(1)) : null,
            averageMs: answered.length ? Math.round(answered.reduce((sum, check) => sum + check.ms, 0) / answered.length) : null,
            hours
        };
    });
};

export const history = async (serviceId, hours = 24) => checks.findAll({
    where: {service: serviceId, time: {[Op.gte]: new Date(Date.now() - hours * HOUR).toISOString()}},
    order: [["time", "ASC"]], attributes: ["time", "state", "ms", "rtt", "status"], raw: true
});
