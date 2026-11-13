// The services the "is it down?" check looks at, unless the list was changed in the app
export const DEFAULT_SERVICES = [
    {id: "google", name: "Google", url: "https://www.google.com"},
    {id: "youtube", name: "YouTube", url: "https://www.youtube.com"},
    {id: "whatsapp", name: "WhatsApp", url: "https://web.whatsapp.com"},
    {id: "instagram", name: "Instagram", url: "https://www.instagram.com"},
    {id: "netflix", name: "Netflix", url: "https://www.netflix.com"},
    {id: "govbr", name: "gov.br", url: "https://www.gov.br"},
    {id: "mercadolivre", name: "Mercado Livre", url: "https://www.mercadolivre.com.br"},
    {id: "discord", name: "Discord", url: "https://discord.com"}
];

export const MAX_SERVICES = 20;

const slug = (name) => name.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 30);

// A list of {name, url}: names up to 30 characters, web addresses only. Returns the list with ids, or null.
export const validateServices = (value) => {
    if (value === "default") return value;
    try {
        const list = JSON.parse(value);
        if (!Array.isArray(list) || list.length > MAX_SERVICES) return null;
        const ids = new Set();
        const services = [];
        for (const item of list) {
            const name = typeof item?.name === "string" ? item.name.trim() : "";
            if (!name || name.length > 30 || /[\u0000-\u001f\u007f]/.test(name)) return null;
            const url = new URL(item.url);
            if (!["http:", "https:"].includes(url.protocol)) return null;
            let id = slug(name) || "service";
            for (let n = 2; ids.has(id); n++) id = slug(name).slice(0, 27) + n;
            ids.add(id);
            services.push({id, name, url: url.toString()});
        }
        return JSON.stringify(services);
    } catch {
        return null;
    }
};

export const parseServices = (value) => {
    if (!value || value === "default") return DEFAULT_SERVICES;
    try {
        return JSON.parse(value);
    } catch {
        return DEFAULT_SERVICES;
    }
};
