import {t} from "i18next";
import {errors} from "@/pages/Home/components/Speedtest/utils/errors";

export const formatDateParam = (date) =>
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

export const formatDuration = (seconds) => {
    const minutes = Math.round(seconds / 60);
    if (minutes < 1) return t("connection.duration.less_than_minute");
    if (minutes < 60) return t("connection.duration.minutes", {minutes});
    const hours = Math.floor(minutes / 60);
    const rest = String(minutes % 60).padStart(2, "0");
    if (hours < 24) return t("connection.duration.hours", {hours, minutes: rest});
    return t("connection.duration.days", {days: Math.floor(hours / 24), hours: hours % 24, minutes: rest});
};

export const causeLabel = (cause) => t(`connection.cause.${cause}`, {defaultValue: t("connection.cause.unknown")});

export const availabilityColor = (value) => {
    if (value === null || value === undefined) return "";
    if (value >= 99.5) return "icon-green";
    if (value >= 98) return "icon-orange";
    return "icon-red";
};

export const monthLabel = (month) => {
    const [year, index] = month.split("-").map(Number);
    return new Date(year, index - 1, 1).toLocaleDateString(undefined, {month: "long", year: "numeric"});
};

// Turns the raw error of a failed test into a short explanation
export const describeError = (error) => {
    if (!error) return error;
    for (const [match, text] of Object.entries(errors()))
        if (error.includes(match)) return text;
    try {
        return JSON.parse(error).message || error;
    } catch {
        return error;
    }
};
