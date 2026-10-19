// Default notification texts and the variables they use

export const defaults = {
    finished: "Teste de velocidade concluído:\nPing: %ping% ms (±%jitter% ms)\nDownload: %download% Mbps\nUpload: %upload% Mbps",
    failed: "O teste de velocidade falhou: %error%",
    outage: "A internet caiu às %start_time% de %start_date% e voltou às %end_time%.\nFicou %duration% fora do ar.\nCausa provável: %cause%.",
    slow: "Velocidade abaixo do mínimo do plano.\nDownload: %download% Mbps (%download_percent% do plano)\nUpload: %upload% Mbps (%upload_percent% do plano)"
};

const causes = {
    internet: "falha do provedor (o roteador respondia, a internet não)",
    local: "rede de casa (o roteador também não respondia)",
    unknown: "não identificada"
};

const knownErrors = [
    [/could not retrieve or read configuration|configurationerror|enotfound|getaddrinfo|network unreachable|no route to host/i, "sem conexão com a internet"],
    [/timed? ?out|timeout/i, "o teste demorou demais e foi cancelado"],
    [/connection refused/i, "o servidor de teste recusou a conexão"]
];

export const friendlyError = (error = "") => {
    for (const [pattern, text] of knownErrors)
        if (pattern.test(error)) return text;

    try {
        return JSON.parse(error).message || error;
    } catch {
        return error;
    }
};

const pad = (n) => String(n).padStart(2, "0");

export const formatDuration = (seconds) => {
    const minutes = Math.round(seconds / 60);
    if (minutes < 1) return "menos de 1 minuto";
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h${pad(minutes % 60)}`;
    return `${Math.floor(hours / 24)}d ${hours % 24}h${pad(minutes % 60)}`;
};

const formatTime = (date) => `${pad(date.getHours())}:${pad(date.getMinutes())}`;
const formatDate = (date) => `${pad(date.getDate())}/${pad(date.getMonth() + 1)}`;

export const outageVariables = (outage) => {
    const start = new Date(outage.start);
    const end = new Date(outage.end);
    return {
        start_time: formatTime(start), start_date: formatDate(start),
        end_time: formatTime(end), end_date: formatDate(end),
        duration: formatDuration((end - start) / 1000),
        duration_minutes: Math.round((end - start) / 60000),
        cause: causes[outage.cause] || causes.unknown
    };
};
