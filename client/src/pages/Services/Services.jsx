import {useContext, useEffect, useState} from "react";
import {useNavigate} from "react-router-dom";
import {t} from "i18next";
import {FontAwesomeIcon} from "@fortawesome/react-fontawesome";
import {faArrowLeft, faArrowsRotate, faPen, faPlus, faTrash, faXmark} from "@fortawesome/free-solid-svg-icons";
import {jsonRequest, patchRequest, postRequest} from "@/common/utils/RequestUtil";
import {ConfigContext} from "@/common/contexts/Config";
import {ToastNotificationContext} from "@/common/contexts/ToastNotification";
import {formatMs, formatSince, stateColor} from "@/common/utils/ServiceUtil";
import "./styles.sass";

const REFRESH = 60 * 1000;

const host = (url) => {
    try {
        return new URL(url).host;
    } catch {
        return url;
    }
};

// What the line under a service says: normal and how fast, slow, or down and for how long
export const describeService = (service) => {
    if (!service.state) return t("services.state.waiting");
    if (service.state === "offline") return t("services.state.offline");
    if (service.state === "down") return t("services.state.down", {since: formatSince(service.since)});
    if (service.state === "slow") return t("services.state.slow", {ms: formatMs(service.ms)});
    return t("services.state.up", {ms: formatMs(service.ms)});
};

// One line for the whole list: all fine, which ones are down, or no internet at all
export const describeAll = (services) => {
    if (!services.length || services.every((service) => !service.state)) return {tone: "waiting", text: t("services.summary.waiting")};
    if (services.some((service) => service.state === "offline")) return {tone: "offline", text: t("services.summary.offline")};
    const down = services.filter((service) => service.state === "down");
    if (down.length) return {tone: "down", text: t("services.summary.down", {count: down.length, names: down.map((service) => service.name).join(", ")})};
    const slow = services.filter((service) => service.state === "slow");
    if (slow.length) return {tone: "slow", text: t("services.summary.slow", {count: slow.length, names: slow.map((service) => service.name).join(", ")})};
    return {tone: "up", text: t("services.summary.up")};
};

const HourBars = ({hours}) => (
    <div className="service-hours" aria-hidden="true">
        {hours.map((state, index) => <span key={index} style={{background: stateColor(state)}} className={state ? "" : "service-hour-empty"}/>)}
    </div>
);

export const Services = () => {
    const navigate = useNavigate();
    const [config, reloadConfig] = useContext(ConfigContext);
    const updateToast = useContext(ToastNotificationContext);
    const [data, setData] = useState(null);
    const [checking, setChecking] = useState(false);
    const [editing, setEditing] = useState(null);
    const canEdit = !config.viewMode;

    const load = () => jsonRequest("/services").then(setData).catch(() => {});

    useEffect(() => {
        load();
        const timer = setInterval(load, REFRESH);
        return () => clearInterval(timer);
    }, []);

    const checkNow = async () => {
        setChecking(true);
        try {
            const res = await postRequest("/services/check");
            if (res.ok) setData(await res.json());
        } finally {
            setChecking(false);
        }
    };

    const saveList = async () => {
        const list = editing.filter((item) => item.name.trim() && item.url.trim())
            .map((item) => ({name: item.name.trim(), url: /^https?:\/\//i.test(item.url.trim()) ? item.url.trim() : "https://" + item.url.trim()}));
        const res = await patchRequest("/config/services", {value: JSON.stringify(list)}).catch(() => null);
        if (!res?.ok) return updateToast(t("services.edit.error"), "red", faXmark);
        setEditing(null);
        reloadConfig();
        updateToast(t("dropdown.changes_applied"), "green", faPen);
        checkNow();
    };

    const toggleMonitor = async () => {
        const res = await patchRequest("/config/serviceMonitor", {value: data.monitor ? "false" : "true"}).catch(() => null);
        if (res?.ok) setTimeout(load, 500);
    };

    const services = data?.services || [];
    const overall = describeAll(services);

    return (
        <div className="services-page">
            <div className="services-toolbar">
                <button className="dialog-btn" onClick={() => navigate("/statistics")}>
                    <FontAwesomeIcon icon={faArrowLeft}/> {t("map.back")}
                </button>
                {canEdit && data && !editing && <div className="services-actions">
                    <button className="dialog-btn" onClick={checkNow} disabled={checking || !data.monitor}>
                        <FontAwesomeIcon icon={faArrowsRotate} spin={checking}/> {t("services.check_now")}
                    </button>
                    <button className="dialog-btn" onClick={() => setEditing(services.map(({name, url}) => ({name, url})))}>
                        <FontAwesomeIcon icon={faPen}/> {t("services.edit.button")}
                    </button>
                </div>}
            </div>

            <div className="services-intro">
                <h1>{t("services.title")}</h1>
                <p>{t("services.description")}</p>
            </div>

            {data && !data.monitor && (
                <div className="services-banner services-banner-offline">
                    <span>{t("services.monitor_off")}</span>
                    {canEdit && <button className="dialog-btn" onClick={toggleMonitor}>{t("services.turn_on")}</button>}
                </div>
            )}
            {data && data.monitor && <div className={"services-banner services-banner-" + overall.tone}>{overall.text}</div>}

            {editing ? (
                <div className="services-edit">
                    {editing.map((item, index) => (
                        <div className="services-edit-row" key={index}>
                            <input className="dialog-input" value={item.name} maxLength={30} placeholder={t("services.edit.name")}
                                   onChange={(event) => setEditing(editing.map((row, i) => i === index ? {...row, name: event.target.value} : row))}/>
                            <input className="dialog-input" value={item.url} placeholder={t("services.edit.url")}
                                   onChange={(event) => setEditing(editing.map((row, i) => i === index ? {...row, url: event.target.value} : row))}/>
                            <button className="dialog-btn services-remove" title={t("services.edit.remove")} aria-label={t("services.edit.remove")}
                                    onClick={() => setEditing(editing.filter((row, i) => i !== index))}>
                                <FontAwesomeIcon icon={faTrash}/>
                            </button>
                        </div>
                    ))}
                    <div className="services-edit-actions">
                        <button className="dialog-btn" disabled={editing.length >= 20} onClick={() => setEditing([...editing, {name: "", url: ""}])}>
                            <FontAwesomeIcon icon={faPlus}/> {t("services.edit.add")}
                        </button>
                        <span/>
                        <button className="dialog-btn" onClick={() => setEditing(null)}>{t("dashboard.cancel")}</button>
                        <button className="dialog-btn services-save" onClick={saveList}>{t("dashboard.save")}</button>
                    </div>
                    {canEdit && data?.monitor && <button className="services-link" onClick={toggleMonitor}>{t("services.turn_off")}</button>}
                </div>
            ) : (
                <div className="services-list">
                    {services.map((service) => (
                        <div className="service-row" key={service.id}>
                            <span className={"service-dot" + (service.state === "down" ? " service-dot-down" : "")}
                                  style={{background: stateColor(service.state)}}/>
                            <div className="service-text">
                                <strong>{service.name}</strong>
                                <span>{host(service.url)}</span>
                            </div>
                            <div className="service-state">
                                <span style={{color: service.state === "up" ? undefined : stateColor(service.state)}}>{describeService(service)}</span>
                                {service.uptime !== null && <small>{t("services.uptime", {value: service.uptime.toLocaleString()})}</small>}
                            </div>
                            <HourBars hours={service.hours}/>
                        </div>
                    ))}
                    {data && <p className="services-note">{t("services.note")}</p>}
                </div>
            )}
        </div>
    );
};

export default Services;
