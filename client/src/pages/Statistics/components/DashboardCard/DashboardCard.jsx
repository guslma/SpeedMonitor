import {useEffect, useLayoutEffect, useRef, useState} from "react";
import i18n, {t} from "i18next";
import {FontAwesomeIcon} from "@fortawesome/react-fontawesome";
import {faEye, faEyeSlash} from "@fortawesome/free-solid-svg-icons";
import {clamp, MAX_HEIGHT, MAX_SPAN, MIN_HEIGHT, MIN_SCALE, MIN_SPAN, ROW} from "@/pages/Statistics/layout";
import "./styles.sass";

export const DashboardCard = ({card, index, editing, dragging, onChange, onDragStart, onDragOver, onDrop, onDragEnd, children}) => {
    const ref = useRef(null);
    const resize = useRef(null);
    const [resizing, setResizing] = useState(null);
    // When the text does not fit the chosen height, it first shrinks a little (down to MIN_SCALE) and only then
    // the card grows by the quarters this screen needs (fit, 0 when the chosen height is enough)
    const [scale, setScale] = useState(1);
    const [fit, setFit] = useState(0);
    const [screen, setScreen] = useState(0);
    const shown = Math.max(card.height, fit);

    useEffect(() => {
        const onResize = () => setScreen((count) => count + 1);
        window.addEventListener("resize", onResize);
        return () => window.removeEventListener("resize", onResize);
    }, []);

    // Measure again, before painting, whenever the chosen height or the screen changes
    useLayoutEffect(() => {
        setScale(1);
        setFit(0);
    }, [card.height, card.size, card.visible, editing, screen]);
    useLayoutEffect(() => {
        const content = ref.current?.querySelector(":scope > .stats-container > .stats-content");
        if (!content || content.scrollHeight - content.clientHeight <= 1) return;
        if (scale > MIN_SCALE) {
            const style = getComputedStyle(content);
            const padding = (parseFloat(style.paddingTop) || 0) + (parseFloat(style.paddingBottom) || 0);
            const room = content.clientHeight - padding;
            const next = Math.floor(scale * room / (content.scrollHeight - padding) * 100) / 100;
            setScale(Math.max(MIN_SCALE, Math.min(next, scale - 0.02)));
        } else if (shown < MAX_HEIGHT) {
            // Even the smallest text does not fit: the card grows a quarter and the text tries its normal size again
            setScale(1);
            setFit(shown + 1);
        }
    });

    // Fingers: the browser's drag and drop does not work with them, so touching and holding a card picks it up and
    // dragging it over another one moves it there, scrolling the page when the finger gets close to its top or bottom
    const latest = useRef(null);
    const coarse = window.matchMedia?.("(pointer: coarse)").matches;
    latest.current = {index, onDragStart, onDragOver, onDragEnd};
    useEffect(() => {
        const element = ref.current;
        if (!editing || !element) return;
        const fake = {preventDefault: () => {}, dataTransfer: {}};
        const scroller = () => document.body.scrollHeight > document.body.clientHeight ? document.body : document.scrollingElement;
        let hold = null, active = false, frame = null, start = null, finger = null;

        const moveOver = () => {
            const over = document.elementFromPoint(finger.x, finger.y)?.closest(".dash-card");
            if (over?.dataset.index !== undefined) latest.current.onDragOver(fake, Number(over.dataset.index));
        };
        const autoScroll = () => {
            const edge = 90;
            const speed = finger.y < edge ? -(edge - finger.y) / 6 : finger.y > window.innerHeight - edge ? (finger.y - window.innerHeight + edge) / 6 : 0;
            if (speed) {
                scroller().scrollBy(0, speed);
                moveOver();
            }
            frame = requestAnimationFrame(autoScroll);
        };
        const stop = () => {
            clearTimeout(hold);
            cancelAnimationFrame(frame);
            if (active) latest.current.onDragEnd();
            hold = null;
            active = false;
        };
        const onStart = (event) => {
            if (event.touches.length !== 1 || event.target.closest(".dash-hide, .dash-resize")) return;
            start = finger = {x: event.touches[0].clientX, y: event.touches[0].clientY};
            hold = setTimeout(() => {
                active = true;
                navigator.vibrate?.(15);
                latest.current.onDragStart(fake, latest.current.index);
                frame = requestAnimationFrame(autoScroll);
            }, 350);
        };
        const onMove = (event) => {
            finger = {x: event.touches[0].clientX, y: event.touches[0].clientY};
            if (!active) {
                // Moving before the hold ends is scrolling the page
                if (Math.hypot(finger.x - start.x, finger.y - start.y) > 10) clearTimeout(hold);
                return;
            }
            event.preventDefault();
            moveOver();
        };

        element.addEventListener("touchstart", onStart, {passive: true});
        element.addEventListener("touchmove", onMove, {passive: false});
        element.addEventListener("touchend", stop);
        element.addEventListener("touchcancel", stop);
        return () => {
            stop();
            element.removeEventListener("touchstart", onStart);
            element.removeEventListener("touchmove", onMove);
            element.removeEventListener("touchend", stop);
            element.removeEventListener("touchcancel", stop);
        };
    }, [editing]);

    // Hidden cards stay out of the dashboard, also while customizing, so it shows how it will look
    if (!card.visible) return null;

    // Pulling the corner: the width snaps to 24ths of the row and the height to quarters of a row
    const startResize = (event) => {
        event.preventDefault();
        event.stopPropagation();
        const parent = ref.current.parentElement;
        const style = getComputedStyle(parent);
        const area = parent.getBoundingClientRect();
        const box = ref.current.getBoundingClientRect();
        const columnGap = parseFloat(style.columnGap) || 0;
        const rowGap = parseFloat(style.rowGap) || 0;
        const grid = style.display === "grid";
        // Notebooks and phones give every card the same width: there only the height changes
        const fixedWidth = style.getPropertyValue("--dash-fixed-width").trim() === "1";
        resize.current = {
            x: event.clientX, y: event.clientY, size: card.size, height: shown, fixedWidth,
            // Wide screens use a 24 column grid; below that each 24th is a 4% flex basis
            column: grid ? (area.width + columnGap) / 24 : area.width * 0.04,
            // In the grid each quarter of a row is a grid row (gaps included); elsewhere the card height is split evenly
            unit: grid ? (box.height + rowGap) / shown : box.height / shown
        };
        event.currentTarget.setPointerCapture(event.pointerId);
        setResizing(fixedWidth ? "height" : "both");
    };

    const moveResize = (event) => {
        const start = resize.current;
        if (!start) return;
        const size = start.fixedWidth ? card.size
            : clamp(Math.round(start.size + (event.clientX - start.x) / start.column), MIN_SPAN, MAX_SPAN);
        const height = clamp(Math.round(start.height + (event.clientY - start.y) / start.unit), MIN_HEIGHT, MAX_HEIGHT);
        if (size !== card.size || height !== card.height) onChange(index, {size, height});
    };

    const endResize = () => {
        // A card pulled smaller than its text stops at the smallest height that still shows everything
        if (resize.current && fit > card.height) onChange(index, {size: card.size, height: fit});
        resize.current = null;
        setResizing(null);
    };

    const rows = shown / ROW;
    const heightText = t("dashboard.height", {count: rows, value: rows.toLocaleString(i18n.language)});
    const widthText = t("dashboard.width", {percent: Math.round(card.size / 24 * 100)});

    const classes = ["dash-card"];
    if (shown !== ROW) classes.push("dash-sized");
    if (editing) classes.push("dash-editing");
    if (dragging) classes.push("dash-dragging");
    if (resizing) classes.push("dash-resizing");

    return (
        <div ref={ref} data-index={index} className={classes.join(" ")} style={{"--span": card.size, "--height": shown, "--dash-zoom": scale}}
             draggable={editing && !resizing && !coarse}
             onDragStart={editing ? (event) => onDragStart(event, index) : undefined}
             onDragOver={editing ? (event) => onDragOver(event, index) : undefined}
             onDrop={editing ? (event) => onDrop(event, index) : undefined}
             onDragEnd={editing ? onDragEnd : undefined}>
            {children}
            {editing && (
                <>
                    <button className="dash-hide" title={t("dashboard.hide")} aria-label={t("dashboard.hide")}
                            onClick={() => onChange(index, {visible: false})}>
                        <FontAwesomeIcon icon={faEye} className="dash-hide-eye"/>
                        <FontAwesomeIcon icon={faEyeSlash} className="dash-hide-slash"/>
                    </button>
                    {resizing && <span className="dash-size">{resizing === "height" ? heightText : `${widthText} · ${heightText}`}</span>}
                    <div className="dash-resize" title={t("dashboard.resize")}
                         onPointerDown={startResize} onPointerMove={moveResize} onPointerUp={endResize} onPointerCancel={endResize}/>
                </>
            )}
        </div>
    );
};
