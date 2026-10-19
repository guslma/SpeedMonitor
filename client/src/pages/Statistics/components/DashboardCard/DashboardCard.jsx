import {useRef, useState} from "react";
import {t} from "i18next";
import {FontAwesomeIcon} from "@fortawesome/react-fontawesome";
import {faChevronLeft, faChevronRight, faEye, faEyeSlash, faGripVertical, faUpRightAndDownLeftFromCenter} from "@fortawesome/free-solid-svg-icons";
import {clamp, MAX_ROWS, MAX_SPAN, MIN_SPAN} from "@/pages/Statistics/layout";
import "./styles.sass";

const GAP = 24;

export const DashboardCard = ({card, index, count, editing, dragging, onChange, onMove, onDragStart, onDragOver, onDrop, onDragEnd, children}) => {
    const ref = useRef(null);
    const resize = useRef(null);
    const [resizing, setResizing] = useState(false);

    if (!card.visible && !editing) return null;

    // Dragging the corner: the width snaps to 24ths of the row and the height to whole rows
    const startResize = (event) => {
        event.preventDefault();
        event.stopPropagation();
        const parent = ref.current.parentElement;
        const area = parent.getBoundingClientRect();
        const box = ref.current.getBoundingClientRect();
        // Wide screens use a 24 column grid; below that each 24th is a 4% flex basis
        const grid = getComputedStyle(parent).display === "grid";
        resize.current = {
            x: event.clientX, y: event.clientY, size: card.size, rows: card.rows,
            column: grid ? (area.width + GAP) / 24 : area.width * 0.04,
            row: (box.height + GAP) / card.rows
        };
        event.currentTarget.setPointerCapture(event.pointerId);
        setResizing(true);
    };

    const moveResize = (event) => {
        const start = resize.current;
        if (!start) return;
        const size = clamp(Math.round(start.size + (event.clientX - start.x) / start.column), MIN_SPAN, MAX_SPAN);
        const rows = clamp(Math.round(start.rows + (event.clientY - start.y) / start.row), 1, MAX_ROWS);
        if (size !== card.size || rows !== card.rows) onChange(index, {size, rows});
    };

    const endResize = () => {
        resize.current = null;
        setResizing(false);
    };

    const classes = ["dash-card"];
    if (card.rows > 1) classes.push("dash-tall");
    if (editing) classes.push("dash-editing");
    if (!card.visible) classes.push("dash-hidden");
    if (dragging) classes.push("dash-dragging");
    if (resizing) classes.push("dash-resizing");

    return (
        <div ref={ref} className={classes.join(" ")} style={{"--span": card.size, "--rows": card.rows}}
             draggable={editing && !resizing}
             onDragStart={editing ? (event) => onDragStart(event, index) : undefined}
             onDragOver={editing ? (event) => onDragOver(event, index) : undefined}
             onDrop={editing ? (event) => onDrop(event, index) : undefined}
             onDragEnd={editing ? onDragEnd : undefined}>
            {children}
            {editing && (
                <div className="dash-edit">
                    <span className="dash-edit-name">
                        <FontAwesomeIcon icon={faGripVertical}/> {t(`dashboard.cards.${card.id}`)}
                    </span>
                    <span className="dash-edit-size">
                        {t("dashboard.width", {percent: Math.round(card.size / 24 * 100)})} · {t("dashboard.height", {count: card.rows})}
                    </span>
                    <div className="dash-edit-controls">
                        <button title={t("dashboard.move_left")} disabled={index === 0} onClick={() => onMove(index, index - 1)}>
                            <FontAwesomeIcon icon={faChevronLeft}/>
                        </button>
                        <button className="dash-edit-visibility" onClick={() => onChange(index, {visible: !card.visible})}>
                            <FontAwesomeIcon icon={card.visible ? faEye : faEyeSlash}/>
                            <span>{t(card.visible ? "dashboard.visible" : "dashboard.hidden")}</span>
                        </button>
                        <button title={t("dashboard.move_right")} disabled={index === count - 1} onClick={() => onMove(index, index + 1)}>
                            <FontAwesomeIcon icon={faChevronRight}/>
                        </button>
                    </div>
                    <div className="dash-resize" title={t("dashboard.resize")}
                         onPointerDown={startResize} onPointerMove={moveResize} onPointerUp={endResize} onPointerCancel={endResize}>
                        <FontAwesomeIcon icon={faUpRightAndDownLeftFromCenter}/>
                    </div>
                </div>
            )}
        </div>
    );
};
