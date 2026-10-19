import schedule from 'node-schedule';
import { triggerEvent } from "../controller/integrations.js";
import { friendlyError, outageVariables } from "../util/messages.js";

let currentState = "ping";
let job;

export const setState = (state = "ping") => {
    currentState = state;
};

export const sendPing = async (type, message) => {
    await triggerEvent("minutePassed", {type, message});
};

export const sendCurrent = async () => {
    if (currentState === "ping") await sendPing();
};

export const sendError = async (error = "Unknown error") => {
    await triggerEvent("testFailed", friendlyError(error));
};

export const sendRunning = async () => {
    await triggerEvent("testStarted");
};

export const sendFinished = async (data) => {
    await triggerEvent("testFinished", data);
};

// Sent when the internet is back, since a message sent while it is down would not arrive
export const sendOutage = async (outage) => {
    await triggerEvent("outageEnded", {...outageVariables(outage), raw: outage});
};

export const sendSlow = async (data) => {
    await triggerEvent("speedBelowPlan", data);
};

export const startTimer = () => {
    job = schedule.scheduleJob('* * * * *', () => sendCurrent());
};

export const stopTimer = () => {
    if (job !== undefined) {
        job.cancel();
        job = undefined;
    }
};