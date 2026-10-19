import {t} from "i18next";
import {FontAwesomeIcon} from "@fortawesome/react-fontawesome";
import {faChevronLeft, faChevronRight, faEye, faEyeSlash, faGripVertical} from "@fortawesome/free-solid-svg-icons";
import {SIZES} from "@/pages/Statistics/layout";
import "./styles.sass";

export const DashboardCard = ({card, index, count, editing, dragging, onChange, onMove, onDragStart, onDragOver, onDrop, onDragEnd, children}) => {
    if (!card.visible && !editing) return null;

    const classes = ["dash-card", `dash-span-${card.size}`];
    if (editing) classes.push("dash-editing");
    if (!card.visible) classes.push("dash-hidden");
    if (dragging) classes.push("dash-dragging");

    return (
        <div className={classes.join(" ")}
             draggable={editing}
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
                    <div className="dash-edit-controls">
                        <button title={t("dashboard.move_left")} disabled={index === 0} onClick={() => onMove(index, index - 1)}>
                            <FontAwesomeIcon icon={faChevronLeft}/>
                        </button>
                        <select value={card.size} title={t("dashboard.size")}
                                onChange={(event) => onChange(index, {size: Number(event.target.value)})}>
                            {SIZES.map((size) => <option key={size} value={size}>{t(`dashboard.sizes.${size}`)}</option>)}
                        </select>
                        <button title={t("dashboard.move_right")} disabled={index === count - 1} onClick={() => onMove(index, index + 1)}>
                            <FontAwesomeIcon icon={faChevronRight}/>
                        </button>
                    </div>
                    <button className="dash-edit-visibility" onClick={() => onChange(index, {visible: !card.visible})}>
                        <FontAwesomeIcon icon={card.visible ? faEye : faEyeSlash}/>
                        <span>{t(card.visible ? "dashboard.visible" : "dashboard.hidden")}</span>
                    </button>
                </div>
            )}
        </div>
    );
};
