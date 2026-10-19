import { Op } from 'sequelize';
import outages from '../models/Outages.js';
import tests from '../models/Speedtests.js';

export const getOngoing = () => outages.findOne({where: {ongoing: true}, order: [["start", "DESC"]]});

export const start = async (startTime, cause) =>
    outages.create({start: startTime.toISOString(), end: new Date().toISOString(), ongoing: true, cause, source: "monitor"});

export const touch = (outage) => outages.update({end: new Date().toISOString()}, {where: {id: outage.id}});

export const finish = async (outage, endTime = new Date()) => {
    await outages.update({end: endTime.toISOString(), ongoing: false}, {where: {id: outage.id}});
    return {...outage.get(), end: endTime.toISOString(), ongoing: false};
};

// Outages left open by a restart end at the last moment they were seen
export const closeStale = () => outages.update({ongoing: false}, {where: {ongoing: true}});

// The estimated outages overlap the ones the monitor saw, so they only count before the monitor existed
const firstMonitored = async () => (await outages.findOne({where: {source: "monitor"}, order: [["start", "ASC"]]}))?.start;

export const removeOld = async (days) => {
    if (!days) return;
    await outages.destroy({where: {ongoing: false, end: {[Op.lt]: new Date(Date.now() - days * 86400000).toISOString()}}});
};

export const summary = async (fromDate, toDate) => {
    const [fromYear, fromMonth, fromDay] = fromDate.split('-').map(Number);
    const [toYear, toMonth, toDay] = toDate.split('-').map(Number);
    const now = Date.now();

    const firstTest = await tests.findOne({order: [["created", "ASC"]]});
    const monitoredSince = firstTest ? new Date(firstTest.created).getTime() : now;

    const from = Math.max(new Date(fromYear, fromMonth - 1, fromDay).getTime(), monitoredSince);
    const to = Math.min(new Date(toYear, toMonth - 1, toDay, 23, 59, 59, 999).getTime(), now);

    const monitorStart = await firstMonitored();
    const list = (await outages.findAll({order: [["start", "DESC"]]}))
        .filter((outage) => outage.source === "monitor" || !monitorStart || outage.start < monitorStart)
        .map((outage) => {
            const start = new Date(outage.start).getTime();
            const end = outage.ongoing ? now : new Date(outage.end).getTime();
            return {
                id: outage.id, start: outage.start, end: outage.ongoing ? null : outage.end,
                ongoing: outage.ongoing, cause: outage.cause, source: outage.source,
                duration: Math.max(0, Math.round((end - start) / 1000)),
                counted: Math.max(0, Math.min(end, to) - Math.max(start, from))
            };
        })
        .filter((outage) => outage.counted > 0 || (outage.ongoing && from <= now));

    const period = Math.max(0, to - from);
    const downtime = list.reduce((sum, outage) => sum + outage.counted, 0);

    const firstDay = firstTest ? new Date(firstTest.created) : null;
    return {
        firstTest: firstDay && `${firstDay.getFullYear()}-${String(firstDay.getMonth() + 1).padStart(2, "0")}-${String(firstDay.getDate()).padStart(2, "0")}`,
        availability: period > 0 ? parseFloat((100 - downtime / period * 100).toFixed(2)) : null,
        count: list.length,
        downtime: Math.round(downtime / 1000),
        longest: list.reduce((max, outage) => Math.max(max, outage.duration), 0),
        ongoing: list.some((outage) => outage.ongoing),
        outages: list.map(({counted, ...outage}) => outage)
    };
};
