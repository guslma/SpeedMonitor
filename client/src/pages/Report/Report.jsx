import {useContext, useEffect, useState} from "react";
import {formatDateParam} from "@/common/utils/ConnectionUtil";
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

// Ranges in whole calendar months, since the Anatel reference is monthly
const ALL_HISTORY_START = "2000-01-01";
const presets = () => {
    const today = new Date();
    const monthStart = (back) => new Date(today.getFullYear(), today.getMonth() - back, 1);
    const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0);
    return [
        {key: "this_month", from: monthStart(0), to: today},
        {key: "last_month", from: monthStart(1), to: lastMonthEnd},
        {key: "last_3", from: monthStart(2), to: today},
        {key: "last_6", from: monthStart(5), to: today},
        {key: "last_12", from: monthStart(11), to: today},
        {key: "all", from: null, to: today}
    ].map((preset) => ({...preset, from: preset.from ? formatDateParam(preset.from) : ALL_HISTORY_START, to: formatDateParam(preset.to)}));
};

const PeriodPicker = ({from, to, firstTest, onChange}) => {
    // Before the first test there is nothing to show, so the field starts at the first test
    const shownFrom = firstTest && from < firstTest ? firstTest : from;
    const [customFrom, setCustomFrom] = useState(shownFrom);
    const [customTo, setCustomTo] = useState(to);

    useEffect(() => {
        setCustomFrom(shownFrom);
        setCustomTo(to);
    }, [shownFrom, to]);

    const list = presets();
    const active = list.find((preset) => preset.to === to &&
        (preset.from === from || (preset.key === "all" && firstTest && from <= firstTest)));

    return (
        <div className="report-period">
            <div className="report-presets">
                {list.map((preset) => (
                    <button key={preset.key} className={"report-chip" + (active?.key === preset.key ? " report-chip-active" : "")}
                            onClick={() => onChange(preset.from, preset.to)}>
                        {t(`connection.period.${preset.key}`)}
                    </button>
                ))}
            </div>
            <form className="report-custom" onSubmit={(event) => {
                event.preventDefault();
                if (validDate(customFrom) && validDate(customTo))
                    customFrom <= customTo ? onChange(customFrom, customTo) : onChange(customTo, customFrom);
            }}>
                <label>{t("connection.period.from")}
                    <input type="date" value={customFrom} max={customTo} onChange={(event) => setCustomFrom(event.target.value)}/>
                </label>
                <label>{t("connection.period.to")}
                    <input type="date" value={customTo} min={customFrom} onChange={(event) => setCustomTo(event.target.value)}/>
                </label>
                <button type="submit" className="report-chip">{t("connection.period.apply")}</button>
            </form>
        </div>
    );
};

export const Report = () => {
    const [params, setParams] = useSearchParams();
    const navigate = useNavigate();
    const [preferences] = useContext(PreferencesContext);
    const [data, setData] = useState(null);
    const [failed, setFailed] = useState(false);
    // Without a period in the address, show the current month
    const thisMonth = presets()[0];
    const from = validDate(params.get("from")) ? params.get("from") : thisMonth.from;
    const to = validDate(params.get("to")) ? params.get("to") : thisMonth.to;
    const changePeriod = (newFrom, newTo) => setParams({from: newFrom, to: newTo});

    useEffect(() => {
        setData((current) => current && {...current, loading: true});
        setFailed(false);
        Promise.all([
            jsonRequest(`/outages?from=${from}&to=${to}`),
            jsonRequest(`/speedtests/export?from=${from}&to=${to}`)
        ]).then(([summary, tests]) => setData({summary, tests}))
            .catch(() => setFailed(true));
    }, [from, to]);

    const picker = <PeriodPicker from={from} to={to} firstTest={data?.summary?.firstTest} onChange={changePeriod}/>;
    if (failed) return <div className="report-page">{picker}<p>{t("connection.report_failed")}</p></div>;
    if (!data) return <div className="report-page">{picker}<p>{t("connection.loading")}</p></div>;

    const {summary, tests} = data;
    const plan = summary.plan;
    const done = tests.filter((test) => !test.error);
    const belowMin = plan.configured ? done.filter((test) =>
        (plan.plan.download && test.download < plan.plan.download * plan.rules.instantMin / 100) ||
        (plan.plan.upload && test.upload < plan.plan.upload * plan.rules.instantMin / 100)) : [];
    const failedTests = tests.filter((test) => test.error);

    return (
        <div className={"report-page connection-details" + (data.loading ? " report-loading" : "")}>
            <div className="report-toolbar">
                <button className="dialog-btn" onClick={() => navigate("/statistics")}>
                    <FontAwesomeIcon icon={faArrowLeft}/> <span>{t("connection.back")}</span>
                </button>
                <button className="dialog-btn" onClick={() => window.print()}>
                    <FontAwesomeIcon icon={faPrint}/> <span>{t("connection.print")}</span>
                </button>
            </div>

            {picker}

            <h1>{t("connection.report_title")}</h1>
            <p className="connection-muted">
                {t("connection.report_period", {from: formatDay(summary.firstTest && summary.firstTest > from ? summary.firstTest : from),
                    to: formatDay(to), interpolation: {escapeValue: false}})}
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
