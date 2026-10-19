import {useContext} from "react";
import {t} from "i18next";
import {useNavigate} from "react-router-dom";
import {FontAwesomeIcon} from "@fortawesome/react-fontawesome";
import {faFileLines, faSliders} from "@fortawesome/free-solid-svg-icons";
import {PreferencesContext} from "@/common/contexts/Preferences";
import {formatDateTime} from "@/common/utils/FormatUtil";
import {availabilityColor, causeLabel, formatDateParam, formatDuration, monthLabel} from "@/common/utils/ConnectionUtil";

export const PlanResult = ({result, plan}) => {
    if (!result) return <span className="connection-muted">-</span>;
    return (
        <span className={result.ok ? "icon-green" : "icon-red"}>
            {t("connection.plan_cell", {average: result.average, percent: result.averagePercent, above: result.aboveMinPercent, plan})}
        </span>
    );
};

export const OutageTable = ({outages, preferences, limit}) => {
    const list = limit ? outages.slice(0, limit) : outages;
    if (list.length === 0) return <p className="connection-muted">{t("connection.no_outages_period")}</p>;

    return (
        <table className="connection-table">
            <thead>
            <tr>
                <th>{t("connection.table.start")}</th>
                <th>{t("connection.table.end")}</th>
                <th>{t("connection.table.duration")}</th>
                <th>{t("connection.table.cause")}</th>
            </tr>
            </thead>
            <tbody>
            {list.map((outage) => (
                <tr key={outage.id}>
                    <td>{formatDateTime(outage.start, preferences, {day: "2-digit", month: "2-digit"})}</td>
                    <td>{outage.ongoing ? <span className="icon-red">{t("connection.ongoing")}</span>
                        : formatDateTime(outage.end, preferences, {day: "2-digit", month: "2-digit"})}</td>
                    <td>{formatDuration(outage.duration)}</td>
                    <td>{outage.source === "speedtest" ? t("connection.estimated") : causeLabel(outage.cause)}</td>
                </tr>
            ))}
            </tbody>
        </table>
    );
};

export const MonthTable = ({plan}) => (
    <table className="connection-table">
        <thead>
        <tr>
            <th>{t("connection.table.month")}</th>
            <th>{t("connection.table.tests")}</th>
            {plan.plan.download && <th>{t("latest.down")}</th>}
            {plan.plan.upload && <th>{t("latest.up")}</th>}
            <th>{t("connection.table.status")}</th>
        </tr>
        </thead>
        <tbody>
        {plan.months.map((month) => (
            <tr key={month.month}>
                <td>{monthLabel(month.month)}</td>
                <td>{month.tests}</td>
                {plan.plan.download && <td><PlanResult result={month.download} plan={plan.plan.download}/></td>}
                {plan.plan.upload && <td><PlanResult result={month.upload} plan={plan.plan.upload}/></td>}
                <td className={month.ok ? "icon-green" : "icon-red"}>{t(month.ok ? "connection.meets" : "connection.fails")}</td>
            </tr>
        ))}
        </tbody>
    </table>
);

export const ConnectionDetails = ({summary, dateRange, onConfigure}) => {
    const [preferences] = useContext(PreferencesContext);
    const navigate = useNavigate();
    const plan = summary.plan;

    const openReport = () => navigate(`/report?from=${formatDateParam(dateRange.from)}&to=${formatDateParam(dateRange.to)}`);

    return (
        <div className="connection-details">
            <h2>{t("connection.title")}</h2>

            <div className="connection-stats">
                <div>
                    <span>{t("connection.availability")}</span>
                    <strong className={availabilityColor(summary.availability)}>{summary.availability ?? "-"}%</strong>
                </div>
                <div>
                    <span>{t("connection.outages")}</span>
                    <strong>{summary.count}</strong>
                </div>
                <div>
                    <span>{t("connection.downtime")}</span>
                    <strong>{summary.downtime > 0 ? formatDuration(summary.downtime) : "-"}</strong>
                </div>
                <div>
                    <span>{t("connection.longest")}</span>
                    <strong>{summary.longest > 0 ? formatDuration(summary.longest) : "-"}</strong>
                </div>
            </div>

            <h3>{t("connection.outages")}</h3>
            <div className="connection-scroll">
                <OutageTable outages={summary.outages} preferences={preferences}/>
            </div>
            {summary.outages.some((outage) => outage.source === "speedtest") &&
                <p className="connection-note">{t("connection.estimated_note")}</p>}

            <h3>{t("connection.plan_title")}</h3>
            {plan.configured ? <>
                <p className="connection-note">{t("connection.rules", plan.rules)}</p>
                <div className="connection-scroll"><MonthTable plan={plan}/></div>
            </> : <p className="connection-muted">{t("connection.plan_missing_long")}</p>}

            <div className="connection-actions">
                <button className="dialog-btn" onClick={onConfigure}>
                    <FontAwesomeIcon icon={faSliders}/> <span>{t("connection.configure")}</span>
                </button>
                <button className="dialog-btn" onClick={openReport}>
                    <FontAwesomeIcon icon={faFileLines}/> <span>{t("connection.report")}</span>
                </button>
            </div>
        </div>
    );
};
