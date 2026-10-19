import { postJson } from "../util/http.js";
import { replaceVariables } from "../util/helpers.js";
import { defaults } from "../util/messages.js";

const send = (token, chat_id, text, activity) =>
    postJson(`https://api.telegram.org/bot${token}/sendMessage`, {text, chat_id}, {activity});

export default (registerEvent) => {
    registerEvent('testFinished', async ({data: c}, data, activity) => {
        if (c.send_finished) await send(c.token, c.chat_id,
            "✨ " + replaceVariables(c.finished_message || defaults.finished, data), activity);
    });

    registerEvent('testFailed', async ({data: c}, error, activity) => {
        if (c.send_failed) await send(c.token, c.chat_id,
            "❌ " + replaceVariables(c.error_message || defaults.failed, {error}), activity);
    });

    registerEvent('outageEnded', async ({data: c}, data, activity) => {
        if (c.send_outage) await send(c.token, c.chat_id,
            "🔴 " + replaceVariables(c.outage_message || defaults.outage, data), activity);
    });

    registerEvent('speedBelowPlan', async ({data: c}, data, activity) => {
        if (c.send_slow) await send(c.token, c.chat_id,
            "🐢 " + replaceVariables(c.slow_message || defaults.slow, data), activity);
    });

    return {
        icon: "fa-brands fa-telegram",
        fields: [
            {name: "token", type: "text", required: true, regex: /(\d+):[a-zA-Z0-9_-]+/},
            {name: "chat_id", type: "text", required: true, regex: /-?\d+/},
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
