// Card widths in 24ths of a row on wide screens; narrower screens scale them up (see styles.sass)
export const SIZES = [3, 4, 6, 8, 12, 24];

export const DEFAULT_LAYOUT = [
    {id: "overview", size: 6, visible: true},
    {id: "latest", size: 4, visible: true},
    {id: "consistency", size: 4, visible: true},
    {id: "connection", size: 4, visible: true},
    {id: "avgDownload", size: 3, visible: true},
    {id: "avgUpload", size: 3, visible: true},
    {id: "download", size: 6, visible: true},
    {id: "upload", size: 6, visible: true},
    {id: "ping", size: 6, visible: true},
    {id: "hourly", size: 6, visible: true}
];

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
    const layout = saved.filter((card) => known.has(card.id) && SIZES.includes(card.size))
        .map(({id, size, visible}) => ({id, size, visible: visible !== false}));
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
