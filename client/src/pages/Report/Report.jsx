import {useContext, useEffect, useState} from "react";
import {useNavigate, useSearchParams} from "react-router-dom";
import {t} from "i18next";
import {FontAwesomeIcon} from "@fortawesome/react-fontawesome";
import {faArrowLeft, faPrint} from "@fortawesome/free-solid-svg-icons";
import {jsonRequest} from "@/common/utils/RequestUtil";
import {PreferencesContext} from "@/common/contexts/Preferences";
import {formatDateTime} from "@/common/utils/FormatUtil";
import {availabilityColor, describeError, formatDuration} from "@/common/utils/ConnectionUtil";
import {MonthTable, OutageTable} from "@/pages/Statistics/charts/ConnectionChart/ConnectionDetails";
import "@/pages/Statistics/charts/ConnectionChart/styles.sass";
import "./styles.sass";

const validDate = (value) => /^\d{4}-\d{2}-\d{2}$/.test(value || "");

const formatDay = (value) => {
    const [year, month, day] = value.split("-").map(Number);
    return new Date(year, month - 1, day).toLocaleDateString();
};

export const Report = () => {
    const [params] = useSearchParams();
    const navigate = useNavigate();
    const [preferences] = useContext(PreferencesContext);
    const [data, setData] = useState(null);
    const [failed, setFailed] = useState(false);
    const from = params.get("from");
    const to = params.get("to");

    useEffect(() => {
        if (!validDate(from) || !validDate(to)) return setFailed(true);
        Promise.all([
            jsonRequest(`/outages?from=${from}&to=${to}`),
            jsonRequest(`/speedtests/export?from=${from}&to=${to}`)
        ]).then(([summary, tests]) => setData({summary, tests}))
            .catch(() => setFailed(true));
    }, [from, to]);

    if (failed) return <div className="report-page"><p>{t("connection.report_failed")}</p></div>;
    if (!data) return <div className="report-page"><p>{t("connection.loading")}</p></div>;

    const {summary, tests} = data;
    const plan = summary.plan;
    const done = tests.filter((test) => !test.error);
    const belowMin = plan.configured ? done.filter((test) =>
        (plan.plan.download && test.download < plan.plan.download * plan.rules.instantMin / 100) ||
        (plan.plan.upload && test.upload < plan.plan.upload * plan.rules.instantMin / 100)) : [];
    const failedTests = tests.filter((test) => test.error);

    return (
        <div className="report-page connection-details">
            <div className="report-toolbar">
                <button className="dialog-btn" onClick={() => navigate("/statistics")}>
                    <FontAwesomeIcon icon={faArrowLeft}/> <span>{t("connection.back")}</span>
                </button>
                <button className="dialog-btn" onClick={() => window.print()}>
                    <FontAwesomeIcon icon={faPrint}/> <span>{t("connection.print")}</span>
                </button>
            </div>

            <h1>{t("connection.report_title")}</h1>
            <p className="connection-muted">
                {t("connection.report_period", {from: formatDay(from), to: formatDay(to), interpolation: {escapeValue: false}})}
                {plan.configured && <> · {t("connection.report_plan", {download: plan.plan.download ?? "-", upload: plan.plan.upload ?? "-"})}</>}
                {" · "}{t("connection.report_generated", {date: formatDateTime(new Date(), preferences), interpolation: {escapeValue: false}})}
            </p>

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
                    <span>{t("connection.table.tests")}</span>
                    <strong>{tests.length}</strong>
                </div>
            </div>

            <h3>{t("connection.plan_title")}</h3>
            {plan.configured ? <>
                <p className="connection-note">{t("connection.rules", plan.rules)}</p>
                <MonthTable plan={plan}/>
            </> : <p className="connection-muted">{t("connection.plan_missing_long")}</p>}

            <h3>{t("connection.outages")}</h3>
            <OutageTable outages={summary.outages} preferences={preferences}/>
            {summary.outages.some((outage) => outage.source === "speedtest") &&
                <p className="connection-note">{t("connection.estimated_note")}</p>}

            {plan.configured && <>
                <h3>{t("connection.below_min_title", {percent: plan.rules.instantMin})}</h3>
                {belowMin.length === 0 ? <p className="connection-muted">{t("connection.below_min_none")}</p> :
                    <table className="connection-table">
                        <thead>
                        <tr>
                            <th>{t("connection.table.date")}</th>
                            <th>{t("latest.down")}</th>
                            <th>{t("latest.up")}</th>
                            <th>{t("latest.ping")}</th>
                        </tr>
                        </thead>
                        <tbody>
                        {belowMin.map((test) => (
                            <tr key={test.id}>
                                <td>{formatDateTime(test.created, preferences)}</td>
                                <td>{test.download} Mbps</td>
                                <td>{test.upload} Mbps</td>
                                <td>{test.ping} ms</td>
                            </tr>
                        ))}
                        </tbody>
                    </table>}
            </>}

            <h3>{t("connection.failed_tests")}</h3>
            {failedTests.length === 0 ? <p className="connection-muted">{t("connection.failed_tests_none")}</p> :
                <table className="connection-table">
                    <thead>
                    <tr>
                        <th>{t("connection.table.date")}</th>
                        <th>{t("connection.table.reason")}</th>
                    </tr>
                    </thead>
                    <tbody>
                    {failedTests.map((test) => (
                        <tr key={test.id}>
                            <td>{formatDateTime(test.created, preferences)}</td>
                            <td>{describeError(test.error)}</td>
                        </tr>
                    ))}
                    </tbody>
                </table>}
        </div>
    );
};
