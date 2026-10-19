import { postJson } from "../util/http.js";
import { replaceVariables } from "../util/helpers.js";
import { defaults } from "../util/messages.js";

const URL = "https://api.pushover.net/1/messages.json";

const send = ({token, user_key}, message, activity) =>
    postJson(URL, {token, user: user_key, message}, {activity});

export default (registerEvent) => {
    registerEvent('testFinished', async ({data: c}, data, activity) => {
        if (c.send_finished) await send(c,
            replaceVariables(c.finished_message || defaults.finished, data), activity);
    });

    registerEvent('testFailed', async ({data: c}, error, activity) => {
        if (c.send_failed) await send(c,
            replaceVariables(c.error_message || defaults.failed, {error}), activity);
    });

    registerEvent('outageEnded', async ({data: c}, data, activity) => {
        if (c.send_outage) await send(c,
            replaceVariables(c.outage_message || defaults.outage, data), activity);
    });

    registerEvent('speedBelowPlan', async ({data: c}, data, activity) => {
        if (c.send_slow) await send(c,
            replaceVariables(c.slow_message || defaults.slow, data), activity);
    });

    return {
        icon: "fa-solid fa-pushover",
        fields: [
            {name: "token", type: "text", required: true, regex: /^[a-z0-9]{30}$/},
            {name: "user_key", type: "text", required: true, regex: /^[a-z0-9]{30}$/},
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
