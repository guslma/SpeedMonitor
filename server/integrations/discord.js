import { postJson } from "../util/http.js";
import { replaceVariables } from "../util/helpers.js";
import { defaults } from "../util/messages.js";

const send = (url, username, color, description, activity) =>
    postJson(url, {
        content: null, username,
        embeds: [{description, color, footer: {text: "SpeedMonitor"}, timestamp: new Date().toISOString()}]
    }, {activity});

export default (registerEvent) => {
    registerEvent('testFinished', async ({data: c}, data, activity) => {
        if (c.send_finished) await send(c.url, c.display_name || "SpeedMonitor", 4572762,
            replaceVariables(c.finished_message || defaults.finished, data), activity);
    });

    registerEvent('testFailed', async ({data: c}, error, activity) => {
        if (c.send_failed) await send(c.url, c.display_name || "SpeedMonitor", 12993861,
            replaceVariables(c.error_message || defaults.failed, {error}), activity);
    });

    registerEvent('outageEnded', async ({data: c}, data, activity) => {
        if (c.send_outage) await send(c.url, c.display_name || "SpeedMonitor", 12993861,
            replaceVariables(c.outage_message || defaults.outage, data), activity);
    });

    registerEvent('speedBelowPlan', async ({data: c}, data, activity) => {
        if (c.send_slow) await send(c.url, c.display_name || "SpeedMonitor", 15105570,
            replaceVariables(c.slow_message || defaults.slow, data), activity);
    });

    return {
        icon: "fa-brands fa-discord",
        fields: [
            {name: "url", type: "text", required: true, regex: /https:\/\/.*discord.com\/api\/webhooks\/\d+\/.+/},
            {name: "display_name", type: "text", required: false},
            {name: "send_outage", type: "boolean", required: false},
            {name: "outage_message", type: "textarea", required: false},
            {name: "send_slow", type: "boolean", required: false},
            {name: "slow_message", type: "textarea", required: false},
            {name: "send_finished", type: "boolean", required: false},
            {name: "finished_message", type: "textarea", required: false},
            {name: "send_failed", type: "boolean", required: false},
            {name: "error_message", type: "textarea", required: false}
        ]
    };
};
