import React, {createContext, useState} from "react";

const STORAGE_KEY = "statisticsRange";
export const DEFAULT_PRESET = "last_7_days";
export const RANGE_PRESETS = ["today", "last_7_days", "last_30_days", "this_month", "last_month"];

// Shortcuts are stored by name, so "last 7 days" still means the last 7 days tomorrow
export const presetRange = (preset) => {
    const today = new Date();
    const day = (offset) => new Date(today.getFullYear(), today.getMonth(), today.getDate() - offset);
    switch (preset) {
        case "today":
            return {from: day(0), to: today};
        case "last_30_days":
            return {from: day(29), to: today};
        case "this_month":
            return {from: new Date(today.getFullYear(), today.getMonth(), 1), to: today};
        case "last_month":
            return {from: new Date(today.getFullYear(), today.getMonth() - 1, 1), to: new Date(today.getFullYear(), today.getMonth(), 0)};
        default:
            return {from: day(6), to: today};
    }
};

const toDay = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const fromDay = (value) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value || "")) return null;
    const [year, month, day] = value.split("-").map(Number);
    return new Date(year, month - 1, day);
};

// The last chosen range is remembered per browser
const loadRange = () => {
    try {
        const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
        if (saved?.preset && RANGE_PRESETS.includes(saved.preset)) return {...presetRange(saved.preset), preset: saved.preset};
        const from = fromDay(saved?.from), to = fromDay(saved?.to);
        if (from && to && from <= to) return {from, to, preset: null};
    } catch {
        // Storage unavailable or unreadable: use the default
    }
    return {...presetRange(DEFAULT_PRESET), preset: DEFAULT_PRESET};
};

const saveRange = (range) => {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(range.preset ? {preset: range.preset} : {from: toDay(range.from), to: toDay(range.to)}));
    } catch {
        // Not saved; the range still applies until the page is reloaded
    }
};

export const StatisticsRangeContext = createContext({});

export const StatisticsRangeProvider = (props) => {
    const [dateRange, setRange] = useState(loadRange);

    // Accepts {from, to} for dates picked on the calendar or {preset} for a shortcut
    const setDateRange = (range) => {
        const next = range.preset ? {...presetRange(range.preset), preset: range.preset} : {from: range.from, to: range.to, preset: null};
        saveRange(next);
        setRange(next);
    };

    return (
        <StatisticsRangeContext.Provider value={[dateRange, setDateRange]}>
            {props.children}
        </StatisticsRangeContext.Provider>
    );
};
