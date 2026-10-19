import { postJson } from "../util/http.js";

const send = (url, event, data, activity) =>
    postJson(url, {event, data}, {headers: {"user-agent": "SpeedMonitor/WebhookAgent"}, activity});

const events = [
    ['testStarted', 'send_started', "TEST_STARTED"],
    ['minutePassed', 'send_alive', "KEEP_ALIVE"],
    ['testFinished', 'send_finished', "TEST_FINISHED", (d) => d],
    ['testFailed', 'send_failed', "TEST_FAILED", (e) => ({error: e})],
    ['recommendationsUpdated', 'send_recommendations', "RECOMMENDATIONS_UPDATED", (d) => d],
    ['configUpdated', 'send_config_updates', "CONFIG_UPDATED", (d) => d],
    ['outageEnded', 'send_outage', "OUTAGE_ENDED", (d) => d.raw],
    ['speedBelowPlan', 'send_slow', "SPEED_BELOW_PLAN", (d) => d]
];

export default (registerEvent) => {
    for (const [event, flag, type, getData] of events) {
        registerEvent(event, async ({data: c}, payload, activity) => {
            if (c[flag]) await send(c.url, type, getData?.(payload), activity);
        });
    }

    return {
        icon: "fa-solid fa-globe",
        fields: [
            {name: "url", type: "text", required: true, regex: /https?:\/\/.+/},
            {name: "send_started", type: "boolean", required: false},
            {name: "send_finished", type: "boolean", required: false},
            {name: "send_alive", type: "boolean", required: false},
            {name: "send_failed", type: "boolean", required: false},
            {name: "send_recommendations", type: "boolean", required: false},
            {name: "send_config_updates", type: "boolean", required: false},
            {name: "send_outage", type: "boolean", required: false},
            {name: "send_slow", type: "boolean", required: false},
            {name: "interval", type: "number", required: false, min: 1, max: 1440}
        ]
    };
};
