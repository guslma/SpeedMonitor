import i18n, {t} from "i18next";

// Colors and words for the state of a service (up, slow, down, offline) and for a test server's ping
export const STATE_COLORS = {
    up: "var(--accent-primary)",
    slow: "var(--accent-warning)",
    down: "var(--accent-danger)",
    offline: "var(--subtext)"
};

export const stateColor = (state) => STATE_COLORS[state] || "var(--light-gray)";

export const pingColor = (ping) => ping === null || ping === undefined ? "var(--subtext)"
    : ping < 30 ? STATE_COLORS.up : ping < 80 ? STATE_COLORS.slow : STATE_COLORS.down;

export const formatMs = (ms) => ms === null || ms === undefined ? "–"
    : ms >= 1000 ? `${(ms / 1000).toLocaleString(undefined, {maximumFractionDigits: 1})} s` : `${ms} ms`;

// "há 5 min", "há 2 h": how long a service has been in its state
export const formatSince = (iso) => {
    if (!iso) return "";
    const minutes = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
    if (minutes < 60) return t("services.since_minutes", {count: minutes});
    const hours = Math.round(minutes / 60);
    if (hours < 48) return t("services.since_hours", {count: hours});
    return t("services.since_days", {count: Math.round(hours / 24)});
};

// The country's name in the language of the app (the locations come in English), from its two letter code
export const countryName = (cc, fallback) => {
    try {
        return (cc && new Intl.DisplayNames([i18n.language], {type: "region"}).of(cc)) || fallback || "";
    } catch {
        return fallback || "";
    }
};

export const placeName = (item) => [item?.city, countryName(item?.cc, item?.country)].filter(Boolean).join(", ");

// Where a service answers from, and how that is known (see the map controller on the server)
export const describeLocation = (service) => {
    if (service.located === "name") return `${placeName(service)} · ${t("map.located.name", {code: service.hint})}`;
    if (service.located === "cloudflare") return `${placeName(service)} · ${t("map.located.cloudflare", {code: service.hint})}`;
    if (service.located === "estimate") return `≈ ${placeName(service)} · ${t("map.located.estimate", {name: service.hint})}`;
    if (service.located === "nearby") return t("map.nearby", {km: service.reachKm});
    if (service.lat === undefined) return t("map.node_unknown");
    return placeName(service);
};

// Answering, but much slower than its own average of the last 24 hours (60% and 150 ms above it)
export const isAltered = (service) => service.state === "up" && service.averageMs > 0 && service.ms !== null
    && service.ms > Math.max(service.averageMs * 1.6, service.averageMs + 150);

// What needs attention first: down, then slow, then slower than usual
export const problemRank = (service) => service.state === "down" ? 0 : service.state === "slow" ? 1 : isAltered(service) ? 2 : 3;
