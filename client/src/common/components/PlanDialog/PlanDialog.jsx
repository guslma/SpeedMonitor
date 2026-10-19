import {useContext, useEffect, useState} from "react";
import {t} from "i18next";
import {faCheck, faExclamationTriangle} from "@fortawesome/free-solid-svg-icons";
import {Dialog, DialogBody, DialogFooter, DialogHeader} from "@/common/contexts/Dialog";
import {ConfigContext} from "@/common/contexts/Config";
import {ToastNotificationContext} from "@/common/contexts/ToastNotification";
import {patchRequest} from "@/common/utils/RequestUtil";
import FormField from "@/common/components/FormField";
import "./styles.sass";

const fromConfig = (value) => !value || value === "none" ? "" : value;

export const PlanDialog = ({open, onClose, onSaved}) => {
    const [config, reloadConfig] = useContext(ConfigContext);
    const updateToast = useContext(ToastNotificationContext);
    const [download, setDownload] = useState("");
    const [upload, setUpload] = useState("");
    const [router, setRouter] = useState("");
    const [monitor, setMonitor] = useState(true);

    useEffect(() => {
        if (!open) return;
        setDownload(fromConfig(config.planDownload));
        setUpload(fromConfig(config.planUpload));
        setRouter(fromConfig(config.router));
        setMonitor(config.outageMonitor !== "false");
    }, [open, config]);

    const save = async (close) => {
        const values = {
            planDownload: download === "" ? "none" : String(download),
            planUpload: upload === "" ? "none" : String(upload),
            router: router.trim() === "" ? "none" : router.trim(),
            outageMonitor: String(monitor)
        };
        try {
            for (const [key, value] of Object.entries(values)) {
                if (value === (config[key] ?? "none")) continue;
                const response = await patchRequest(`/config/${key}`, {value});
                if (!response.ok) throw new Error(key);
            }
            reloadConfig();
            onSaved?.();
            updateToast(t("dropdown.changes_applied"), "green", faCheck);
            close();
        } catch {
            updateToast(t("dropdown.changes_unsaved"), "red", faExclamationTriangle);
        }
    };

    return (
        <Dialog open={open} onClose={onClose} className="plan-dialog">
            {({close}) => (
                <>
                    <DialogHeader onClose={close}>{t("connection.configure")}</DialogHeader>
                    <DialogBody>
                        <div className="plan-dialog-content">
                            <p>{t("connection.dialog.plan_description")}</p>
                            <div className="plan-dialog-row">
                                <FormField label={t("connection.dialog.download")} type="number" value={download}
                                           onChange={setDownload} placeholder="300" min={0}/>
                                <FormField label={t("connection.dialog.upload")} type="number" value={upload}
                                           onChange={setUpload} placeholder="150" min={0}/>
                            </div>
                            <FormField label={t("connection.dialog.monitor")} type="boolean" value={monitor} onChange={setMonitor}/>
                            <FormField label={t("connection.dialog.router")} type="text" value={router}
                                       onChange={setRouter} placeholder="192.168.1.1"/>
                            <p className="plan-dialog-hint">{t("connection.dialog.router_description")}</p>
                        </div>
                    </DialogBody>
                    <DialogFooter>
                        <button className="dialog-btn" onClick={() => save(close)}>{t("dialog.update")}</button>
                    </DialogFooter>
                </>
            )}
        </Dialog>
    );
};
