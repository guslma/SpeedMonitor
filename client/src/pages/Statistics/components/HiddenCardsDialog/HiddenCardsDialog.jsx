import {t} from "i18next";
import {FontAwesomeIcon} from "@fortawesome/react-fontawesome";
import {faEye} from "@fortawesome/free-solid-svg-icons";
import {Dialog, DialogBody, DialogHeader} from "@/common/contexts/Dialog";
import "./styles.sass";

// Lists the hidden cards while customizing, so they can be brought back to the dashboard
export const HiddenCardsDialog = ({open, onClose, layout, onShow}) => {
    const hidden = layout.map((card, index) => ({card, index})).filter(({card}) => !card.visible);

    return (
        <Dialog open={open} onClose={onClose} className="hidden-cards-dialog">
            {({close}) => (
                <>
                    <DialogHeader onClose={close}>{t("dashboard.hidden_title")}</DialogHeader>
                    <DialogBody>
                        <p className="hidden-cards-description">{t("dashboard.hidden_description")}</p>
                        <ul className="hidden-cards-list">
                            {hidden.map(({card, index}) => (
                                <li key={card.id}>
                                    <span>{t(`dashboard.cards.${card.id}`)}</span>
                                    <button className="dialog-btn" onClick={() => {
                                        onShow(index);
                                        if (hidden.length === 1) close();
                                    }}>
                                        <FontAwesomeIcon icon={faEye}/> <span>{t("dashboard.show")}</span>
                                    </button>
                                </li>
                            ))}
                        </ul>
                    </DialogBody>
                </>
            )}
        </Dialog>
    );
};
