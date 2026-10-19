// Card widths are in 24ths of a row on wide screens; narrower screens give the cards more room (see styles.sass)
export const MIN_SPAN = 3;
export const MAX_SPAN = 24;
export const MAX_ROWS = 3;

export const DEFAULT_LAYOUT = [
    {id: "overview", size: 6, rows: 1, visible: true},
    {id: "latest", size: 4, rows: 1, visible: true},
    {id: "consistency", size: 4, rows: 1, visible: true},
    {id: "connection", size: 4, rows: 1, visible: true},
    {id: "avgDownload", size: 3, rows: 1, visible: true},
    {id: "avgUpload", size: 3, rows: 1, visible: true},
    {id: "download", size: 6, rows: 1, visible: true},
    {id: "upload", size: 6, rows: 1, visible: true},
    {id: "ping", size: 6, rows: 1, visible: true},
    {id: "hourly", size: 6, rows: 1, visible: true}
];

export const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

// Reads the saved layout, dropping cards that no longer exist and adding new ones at the end
export const parseLayout = (value) => {
    let saved = [];
    try {
        if (value && value !== "default") saved = JSON.parse(value);
    } catch {
        saved = [];
    }
    if (!Array.isArray(saved) || saved.length === 0) return DEFAULT_LAYOUT.map((card) => ({...card}));

    const known = new Set(DEFAULT_LAYOUT.map((card) => card.id));
    const layout = saved.filter((card) => known.has(card.id) && Number.isInteger(card.size))
        .map(({id, size, rows, visible}) => ({
            id, size: clamp(size, MIN_SPAN, MAX_SPAN), rows: clamp(rows || 1, 1, MAX_ROWS), visible: visible !== false
        }));
    const present = new Set(layout.map((card) => card.id));
    DEFAULT_LAYOUT.filter((card) => !present.has(card.id)).forEach((card) => layout.push({...card}));
    return layout;
};

export const isDefaultLayout = (layout) => JSON.stringify(layout) === JSON.stringify(DEFAULT_LAYOUT);

export const moveCard = (layout, from, to) => {
    if (to < 0 || to >= layout.length || from === to) return layout;
    const next = [...layout];
    const [card] = next.splice(from, 1);
    next.splice(to, 0, card);
    return next;
};
