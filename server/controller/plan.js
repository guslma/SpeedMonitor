import tests from '../models/Speedtests.js';
import * as config from './config.js';

// Reference values from Anatel for fixed broadband: a monthly average of at least 80% of the
// contracted speed, and at least 40% of it in 95% of the measurements
export const AVERAGE_MIN = 80;
export const INSTANT_MIN = 40;
export const INSTANT_SHARE = 95;

export const getPlan = async () => {
    const download = parseFloat(await config.getValue("planDownload"));
    const upload = parseFloat(await config.getValue("planUpload"));
    return {download: download > 0 ? download : null, upload: upload > 0 ? upload : null};
};

const evaluate = (values, contracted) => {
    if (!contracted || values.length === 0) return null;
    const average = values.reduce((a, b) => a + b, 0) / values.length;
    const aboveMin = values.filter((value) => value >= contracted * INSTANT_MIN / 100).length;
    const averagePercent = average / contracted * 100;
    const aboveMinPercent = aboveMin / values.length * 100;
    return {
        average: parseFloat(average.toFixed(2)),
        averagePercent: parseFloat(averagePercent.toFixed(1)),
        belowMin: values.length - aboveMin,
        aboveMinPercent: parseFloat(aboveMinPercent.toFixed(1)),
        ok: averagePercent >= AVERAGE_MIN && aboveMinPercent >= INSTANT_SHARE
    };
};

const evaluateTests = (entries, plan) => {
    const done = entries.filter((entry) => entry.error === null);
    const download = evaluate(done.map((entry) => entry.download), plan.download);
    const upload = evaluate(done.map((entry) => entry.upload), plan.upload);
    return {
        tests: done.length,
        failed: entries.length - done.length,
        download, upload,
        ok: [download, upload].filter(Boolean).every((result) => result.ok)
    };
};

const monthKey = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

export const summary = async (fromDate, toDate) => {
    const plan = await getPlan();
    const rules = {averageMin: AVERAGE_MIN, instantMin: INSTANT_MIN, instantShare: INSTANT_SHARE};
    if (!plan.download && !plan.upload) return {plan, rules, configured: false};

    const [fromYear, fromMonth, fromDay] = fromDate.split('-').map(Number);
    const [toYear, toMonth, toDay] = toDate.split('-').map(Number);
    const from = new Date(fromYear, fromMonth - 1, fromDay);
    const to = new Date(toYear, toMonth - 1, toDay, 23, 59, 59, 999);

    const entries = (await tests.findAll({order: [["created", "ASC"]]}))
        .filter((entry) => {
            const created = new Date(entry.created);
            return created >= from && created <= to;
        });

    const months = {};
    for (const entry of entries) {
        const key = monthKey(new Date(entry.created));
        (months[key] ||= []).push(entry);
    }

    return {
        plan, rules, configured: true,
        ...evaluateTests(entries, plan),
        months: Object.entries(months).map(([month, list]) => ({month, ...evaluateTests(list, plan)}))
    };
};
