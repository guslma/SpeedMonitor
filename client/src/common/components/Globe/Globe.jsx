import {useEffect, useMemo, useRef, useState} from "react";
import {geoDistance, geoGraticule10, geoInterpolate, geoOrthographic, geoPath} from "d3-geo";
import {feature} from "topojson-client";
import world from "world-atlas/countries-110m.json";
import {t} from "i18next";
import {countryName, describeLocation, formatMs, pingColor, placeName, stateColor} from "@/common/utils/ServiceUtil";
import "./styles.sass";

const LAND = feature(world, world.objects.countries);
const GRATICULE = geoGraticule10();
const SPIN = 3; // degrees per second while nobody is dragging
const IDLE = 4000; // after a drag, the globe waits this long before spinning again
const MIN_ZOOM = 1;
const MAX_ZOOM = 8;

// Close enough to show the farthest place near the edge: all of them in Brazil makes the globe zoom in on Brazil
const fitZoom = (points) => {
    const home = points[0];
    if (!home) return 1;
    const farthest = Math.max(0.05, ...points.slice(1).map((point) => geoDistance([home.lon, home.lat], [point.lon, point.lat])));
    return Math.min(4, Math.max(MIN_ZOOM, 0.7 / Math.sin(Math.min(farthest, Math.PI / 2))));
};

const cssColor = (element, value) => {
    const match = /^var\((--[\w-]+)\)$/.exec(value);
    return match ? getComputedStyle(element).getPropertyValue(match[1]).trim() || "#888" : value;
};

// Services answering from close to home (their address is registered far away) sit on a small ring around it
const ringAround = (home, index, total) => {
    const angle = (index / Math.max(total, 1)) * Math.PI * 2;
    return {lat: home.lat + Math.sin(angle) * 1.6, lon: home.lon + Math.cos(angle) * 1.6};
};

// Everything that is drawn: home, and a line from it to each test server, service and added server
const buildPoints = (data) => {
    if (!data?.home) return [];
    const home = data.home;
    const nearby = (data.services || []).filter((service) => service.located === "nearby");
    const points = [{kind: "home", ...home, color: "var(--accent-primary)", name: t("map.home"), detail: placeName(home)}];

    for (const server of data.servers || []) if (server.lat !== undefined)
        points.push({kind: "server", lat: server.lat, lon: server.lon, color: pingColor(server.ping), name: server.name,
            detail: `${placeName(server)} · ${t("map.ping", {value: server.ping ?? "–"})} · ${t("map.tests", {count: server.tests})}`});

    for (const service of data.services || []) {
        const close = nearby.indexOf(service);
        if (close < 0 && service.lat === undefined) continue;
        const place = close >= 0 ? ringAround(home, close, nearby.length) : service;
        points.push({kind: "service", lat: place.lat, lon: place.lon, color: stateColor(service.state), name: service.name,
            state: service.state, near: close >= 0, estimated: service.located === "estimate",
            detail: `${describeLocation(service)} · ${service.state === "down" ? t("map.legend.down") : formatMs(service.ms)}`});
    }

    for (const node of data.nodes || []) if (node.lat !== undefined)
        points.push({kind: "node", lat: node.lat, lon: node.lon, color: "var(--accent-tertiary)", name: node.name,
            detail: placeName(node)});
    return points;
};

// Attacks around the world (optional layer): a red spot per city for the biggest attackers, and a softer one in the
// middle of each country for all the others, bigger with more attacks
const attackPoints = (attacks) => (attacks || []).map((spot) => ({
    kind: "attack", lat: spot.lat, lon: spot.lon, color: "var(--accent-danger)", attacks: spot.attacks,
    wide: spot.city === undefined,
    name: spot.city === undefined ? t("map.attacks.whole_country", {country: countryName(spot.cc, spot.cc)}) : placeName(spot),
    detail: t("map.attacks.spot", {count: spot.attacks, attacks: spot.attacks.toLocaleString(), addresses: spot.addresses})
}));

export const Globe = ({data, attacks = null, showConnection = true, compact = false}) => {
    const wrapRef = useRef(null);
    const canvasRef = useRef(null);
    // The canvas fills the box; the globe is as big as the shorter side (zoomed in, it fills the whole box)
    const [box, setBox] = useState({width: 0, height: 0});
    const size = Math.min(box.width, box.height);
    const [hover, setHover] = useState(null);
    const state = useRef({rotation: null, zoom: 1, fitted: false, dragging: null, lastDrag: 0, points: [], projection: null});

    // Each map on its own: the attacks one does not show this connection's places
    state.current.points = showConnection ? buildPoints(data) : [];
    state.current.attacks = useMemo(() => {
        const spots = attackPoints(attacks);
        // Only the biggest spots glow and pulse; drawn last so they stay on top of the small ones
        const biggest = new Set([...spots].sort((a, b) => b.attacks - a.attacks).slice(0, 150));
        spots.forEach((spot) => spot.glows = biggest.has(spot));
        return [...spots.filter((spot) => !spot.glows), ...spots.filter((spot) => spot.glows)];
    }, [attacks]);
    const showWorld = Boolean(attacks);

    // Starts facing home, zoomed so that every place shows
    const fit = () => {
        const current = state.current;
        if (!data?.home) return;
        current.zoom = fitZoom(current.points);
        current.rotation = current.zoom > 1.3 ? [-data.home.lon, -data.home.lat] : [-data.home.lon + 25, -data.home.lat * 0.5 - 8];
        current.fitted = true;
    };
    if (!state.current.fitted && data?.home) {
        fit();
        if (showWorld) state.current.zoom = 1;
    }

    useEffect(() => {
        const current = state.current;
        if (showWorld) {
            current.zoom = 1;
            current.rotation = [current.rotation?.[0] ?? 0, -12];
            current.lastDrag = 0;
        } else if (current.fitted) fit();
    }, [showWorld]);

    useEffect(() => {
        const observer = new ResizeObserver(([entry]) => {
            const {width, height} = entry.contentRect;
            setBox({width: Math.floor(width), height: Math.floor(height || width)});
        });
        observer.observe(wrapRef.current);
        return () => observer.disconnect();
    }, []);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas || !size) return;
        const ratio = window.devicePixelRatio || 1;
        canvas.width = box.width * ratio;
        canvas.height = box.height * ratio;
        const context = canvas.getContext("2d");
        context.setTransform(ratio, 0, 0, ratio, 0, 0);

        let frame = null;
        let previous = performance.now();
        const draw = (now) => {
            const current = state.current;
            const elapsed = (now - previous) / 1000;
            previous = now;
            if (!current.rotation) current.rotation = [0, -10];
            // Only the whole globe spins: zoomed in, home stays in view
            if (!current.dragging && current.zoom <= 1.3 && now - current.lastDrag > IDLE && !document.hidden)
                current.rotation = [current.rotation[0] + SPIN * elapsed, current.rotation[1]];

            const projection = geoOrthographic().scale((size / 2 - 2) * current.zoom).translate([box.width / 2, box.height / 2])
                .rotate(current.rotation).clipAngle(90).precision(0.6);
            current.projection = projection;
            const path = geoPath(projection, context);
            const color = (value) => cssColor(canvas, value);
            const center = [-current.rotation[0], -current.rotation[1]];
            const visible = (point) => geoDistance([point.lon, point.lat], center) < Math.PI / 2 - 0.02;

            context.clearRect(0, 0, box.width, box.height);

            // Sea, a soft glow, the grid and the land
            const radius = (size / 2) * current.zoom;
            const glow = context.createRadialGradient(box.width / 2 - radius * 0.2, box.height / 2 - radius * 0.3, radius * 0.1,
                box.width / 2, box.height / 2, radius);
            glow.addColorStop(0, color("var(--dark-gray)"));
            glow.addColorStop(1, color("var(--darker-gray)"));
            context.beginPath();
            path({type: "Sphere"});
            context.fillStyle = glow;
            context.fill();
            context.lineWidth = 1;
            context.strokeStyle = color("var(--light-gray)");
            context.stroke();

            context.beginPath();
            path(GRATICULE);
            context.globalAlpha = 0.35;
            context.strokeStyle = color("var(--light-gray)");
            context.stroke();
            context.globalAlpha = 1;

            context.beginPath();
            path(LAND);
            context.fillStyle = color("var(--light-gray)");
            context.fill();
            context.lineWidth = 0.5;
            context.strokeStyle = color("var(--darker-gray)");
            context.stroke();

            // Attacks: a glow and a ring going out, each spot at its own pace
            const seconds = now / 1000;
            current.attacks.forEach((spot, index) => {
                if (!visible(spot)) return;
                const [x, y] = projection([spot.lon, spot.lat]);
                // Grows with the number of attacks, but slowly, so thousands do not cover a continent
                const radius = ((compact ? 1 : 1.6) + Math.log10(1 + spot.attacks) * (compact ? 0.9 : 1.5)) * (spot.wide ? 0.8 : 1);
                // Hundreds of small spots: just a dot, so the globe keeps turning smoothly (also on phones)
                if (!spot.glows) {
                    context.beginPath();
                    context.arc(x, y, Math.max(1.3, radius * 0.45), 0, Math.PI * 2);
                    context.fillStyle = "rgba(248, 113, 113, 0.75)";
                    context.fill();
                    return;
                }
                const glow = context.createRadialGradient(x, y, 0, x, y, radius * 2.2);
                glow.addColorStop(0, spot.wide ? "rgba(239, 68, 68, 0.3)" : "rgba(239, 68, 68, 0.55)");
                glow.addColorStop(1, "rgba(239, 68, 68, 0)");
                context.beginPath();
                context.arc(x, y, radius * 2.2, 0, Math.PI * 2);
                context.fillStyle = glow;
                context.fill();
                const phase = ((seconds + index * 0.23) % 2.4) / 2.4;
                context.beginPath();
                context.arc(x, y, radius * (1 + phase * 1.8), 0, Math.PI * 2);
                context.strokeStyle = `rgba(239, 68, 68, ${(spot.wide ? 0.45 : 0.8) * (1 - phase)})`;
                context.lineWidth = 1.2;
                context.stroke();
                context.beginPath();
                context.arc(x, y, Math.max(1.2, radius * 0.35), 0, Math.PI * 2);
                context.fillStyle = "rgb(248, 113, 113)";
                context.fill();
            });

            const points = current.points;
            const home = points[0];
            if (!home) {
                frame = requestAnimationFrame(draw);
                return;
            }

            // Lines from home, with a dash moving along them: traffic going out
            points.slice(1).forEach((point, index) => {
                const line = {type: "LineString", coordinates: [[home.lon, home.lat], [point.lon, point.lat]]};
                context.beginPath();
                path(line);
                context.strokeStyle = color(point.color);
                context.globalAlpha = point.kind === "service" && point.state === "down" ? 0.9 : 0.55;
                context.lineWidth = compact ? 1.2 : 1.6;
                context.setLineDash([3, 6]);
                context.lineDashOffset = -seconds * 18;
                context.stroke();
                context.setLineDash([]);
                context.globalAlpha = 1;

                const travel = geoInterpolate([home.lon, home.lat], [point.lon, point.lat])(((seconds * 0.35) + index * 0.37) % 1);
                if (geoDistance(travel, center) < Math.PI / 2) {
                    const [x, y] = projection(travel);
                    context.beginPath();
                    context.arc(x, y, compact ? 1.6 : 2.2, 0, Math.PI * 2);
                    context.fillStyle = color(point.color);
                    context.fill();
                }
            });

            // Names beside the places, not on the small card: places closer than a few pixels share one label,
            // and the ones right next to home are left to the tooltip so home's name stays readable
            if (!compact) {
                const [homeX, homeY] = projection([home.lon, home.lat]);
                const labels = [];
                points.slice(1).forEach((point) => {
                    if (point.near || point.kind === "node" || !visible(point)) return;
                    const [x, y] = projection([point.lon, point.lat]);
                    if (Math.hypot(x - homeX, y - homeY) < 24) return;
                    const close = labels.find((label) => Math.hypot(label.x - x, label.y - y) < 16);
                    const name = point.estimated ? `≈ ${point.name}` : point.name;
                    if (close) {
                        if (!close.names.includes(name)) close.names.push(name);
                    } else labels.push({x, y, names: [name]});
                });
                context.font = "500 11px Inter, sans-serif";
                context.fillStyle = color("var(--subtext)");
                labels.forEach(({x, y, names}) => context.fillText(names.join(", "), x + 7, y + 4));
            }

            // The places themselves, home last so it stays on top
            [...points.slice(1), home].forEach((point) => {
                if (!visible(point)) return;
                const [x, y] = projection([point.lon, point.lat]);
                const radius = point.kind === "home" ? (compact ? 4 : 5.5) : compact ? 2.8 : 4;
                const pulse = point.kind === "home" || (point.kind === "service" && point.state === "down");
                if (pulse) {
                    const phase = (seconds % 2) / 2;
                    context.beginPath();
                    context.arc(x, y, radius + phase * radius * 3, 0, Math.PI * 2);
                    context.strokeStyle = color(point.color);
                    context.globalAlpha = 1 - phase;
                    context.lineWidth = 1.5;
                    context.stroke();
                    context.globalAlpha = 1;
                }
                context.beginPath();
                if (point.kind === "node") context.rect(x - radius, y - radius, radius * 2, radius * 2);
                else context.arc(x, y, radius, 0, Math.PI * 2);
                if (point.estimated) {
                    // An estimated place is only a ring: the service is around there, not exactly there
                    context.fillStyle = color("var(--darker-gray)");
                    context.fill();
                    context.lineWidth = 2;
                    context.strokeStyle = color(point.color);
                    context.stroke();
                } else {
                    context.fillStyle = color(point.color);
                    context.fill();
                    context.lineWidth = 1.5;
                    context.strokeStyle = color("var(--darker-gray)");
                    context.stroke();
                }

                if (!compact && (point.kind === "home" || point.kind === "node")) {
                    context.font = "600 12px Inter, sans-serif";
                    context.fillStyle = color("var(--white)");
                    context.fillText(point.kind === "home" ? point.detail.split(",")[0] : point.name, x + radius + 4, y + 4);
                }
            });

            frame = requestAnimationFrame(draw);
        };
        frame = requestAnimationFrame(draw);
        return () => cancelAnimationFrame(frame);
    }, [box.width, box.height, compact]);

    // Dragging turns the globe; hovering shows what is under the pointer
    const pointerDown = (event) => {
        if (compact) return;
        event.currentTarget.setPointerCapture(event.pointerId);
        state.current.dragging = {x: event.clientX, y: event.clientY, rotation: state.current.rotation};
    };
    const pointerMove = (event) => {
        const current = state.current;
        if (current.dragging) {
            const scale = 180 / Math.max(size, 1) / current.zoom;
            const {x, y, rotation} = current.dragging;
            current.rotation = [rotation[0] + (event.clientX - x) * scale, Math.max(-80, Math.min(80, rotation[1] - (event.clientY - y) * scale))];
            current.lastDrag = performance.now();
            return;
        }
        if (compact || !current.projection) return;
        const box = canvasRef.current.getBoundingClientRect();
        const mouse = [event.clientX - box.left, event.clientY - box.top];
        const center = [-current.rotation[0], -current.rotation[1]];
        const near = [...current.points, ...current.attacks].filter((point) => geoDistance([point.lon, point.lat], center) < Math.PI / 2)
            .map((point) => {
                const [x, y] = current.projection([point.lon, point.lat]);
                return {point, gap: Math.hypot(x - mouse[0], y - mouse[1]), x, y};
            }).filter((entry) => entry.gap < 12).sort((a, b) => a.gap - b.gap);
        if (near.length) current.lastDrag = performance.now();
        setHover(near.length ? {x: near[0].x, y: near[0].y, points: near.map((entry) => entry.point)} : null);
    };
    const pointerUp = () => {
        state.current.dragging = null;
        state.current.lastDrag = performance.now();
    };

    const zoomBy = (factor) => {
        const current = state.current;
        current.zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, current.zoom * factor));
        current.lastDrag = performance.now();
    };

    // The wheel zooms (and does not scroll the page while over the globe)
    useEffect(() => {
        const canvas = canvasRef.current;
        if (compact || !canvas) return;
        const onWheel = (event) => {
            event.preventDefault();
            zoomBy(event.deltaY < 0 ? 1.15 : 1 / 1.15);
        };
        canvas.addEventListener("wheel", onWheel, {passive: false});
        return () => canvas.removeEventListener("wheel", onWheel);
    }, [compact]);

    return (
        <div className={"globe" + (compact ? " globe-compact" : "")} ref={wrapRef}>
            <canvas ref={canvasRef} style={{width: box.width, height: box.height}} aria-label={t("map.title")} role="img"
                    onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerUp}
                    onPointerCancel={pointerUp} onPointerLeave={() => setHover(null)} onDoubleClick={fit}/>
            {!compact && (
                <div className="globe-zoom">
                    <button onClick={() => zoomBy(1.4)} title={t("map.zoom_in")} aria-label={t("map.zoom_in")}>+</button>
                    <button onClick={() => zoomBy(1 / 1.4)} title={t("map.zoom_out")} aria-label={t("map.zoom_out")}>−</button>
                    <button onClick={fit} title={t("map.zoom_fit")} aria-label={t("map.zoom_fit")}>⌂</button>
                </div>
            )}
            {hover && (
                <div className="globe-tooltip" style={{left: hover.x, top: hover.y}}>
                    {hover.points.slice(0, 4).map((point, index) => (
                        <div key={index} className="globe-tooltip-row">
                            <span className="globe-dot" style={{background: point.color}}/>
                            <div>
                                <strong>{point.name}</strong>
                                <span>{point.detail}</span>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default Globe;
