import {
    ArcElement, BarElement,
    CategoryScale,
    Chart as ChartJS,
    Legend,
    LinearScale,
    LineElement,
    PointElement,
    RadialLinearScale,
    Title,
    Tooltip,
    Filler
} from "chart.js";
import {useContext, useEffect, useState, useCallback, startTransition, useDeferredValue} from "react";
import {jsonRequest} from "@/common/utils/RequestUtil";
import {StatisticsRangeContext} from "@/common/contexts/StatisticsRange";
import ChartModal from "@/common/components/ChartModal";
import SpeedChart from "@/pages/Statistics/charts/SpeedChart";
import LatestTestChart from "@/pages/Statistics/charts/LatestTestChart";
import PingChart from "@/pages/Statistics/charts/PingChart";
import OverviewChart from "@/pages/Statistics/charts/OverviewChart";
import AverageChart from "@/pages/Statistics/charts/AverageChart";
import HourlyChart from "@/pages/Statistics/charts/HourlyChart.jsx";
import ConsistencyChart from "@/pages/Statistics/charts/ConsistencyChart";
import ConnectionChart from "@/pages/Statistics/charts/ConnectionChart";
import {ConnectionDetails} from "@/pages/Statistics/charts/ConnectionChart/ConnectionDetails";
import PlanDialog from "@/common/components/PlanDialog";
import DashboardCard from "@/pages/Statistics/components/DashboardCard";
import {DEFAULT_LAYOUT, isDefaultLayout, moveCard, parseLayout} from "@/pages/Statistics/layout";
import {ConfigContext} from "@/common/contexts/Config";
import {ToastNotificationContext} from "@/common/contexts/ToastNotification";
import {patchRequest} from "@/common/utils/RequestUtil";
import {FontAwesomeIcon} from "@fortawesome/react-fontawesome";
import {faCheck, faExclamationTriangle, faRotateLeft} from "@fortawesome/free-solid-svg-icons";
import i18n, {t} from "i18next";
import "./styles.sass";

ChartJS.register(ArcElement, Tooltip, CategoryScale, LinearScale, PointElement, LineElement, Title, Legend, BarElement, RadialLinearScale, Filler);

const crosshairPlugin = {
    id: 'crosshair',
    afterDraw: (chart) => {
        if (chart.tooltip?._active?.length) {
            const ctx = chart.ctx;
            const activePoint = chart.tooltip._active[0];
            const x = activePoint.element.x;
            const topY = chart.scales.y.top;
            const bottomY = chart.scales.y.bottom;

            ctx.save();
            ctx.beginPath();
            ctx.setLineDash([5, 5]);
            ctx.moveTo(x, topY);
            ctx.lineTo(x, bottomY);
            ctx.lineWidth = 1;
            ctx.strokeStyle = 'hsla(215, 20%, 65%, 0.6)';
            ctx.stroke();
            ctx.restore();
        }
    }
};

if (!ChartJS.registry.plugins.get('crosshair')) ChartJS.register(crosshairPlugin);

ChartJS.defaults.color = "hsl(215, 20%, 55%)";
ChartJS.defaults.font.color = "hsl(215, 20%, 55%)";
ChartJS.defaults.font.family = "Inter, sans-serif";
ChartJS.defaults.font.weight = 500;
ChartJS.defaults.font.size = 11;
ChartJS.defaults.elements.line.tension = 0.35;
ChartJS.defaults.elements.line.borderWidth = 2.5;
ChartJS.defaults.elements.point.radius = 0;
ChartJS.defaults.elements.point.hoverRadius = 5;
ChartJS.defaults.elements.point.hoverBorderWidth = 2;
ChartJS.defaults.elements.arc.borderWidth = 0;
ChartJS.defaults.plugins.legend.labels.usePointStyle = true;
ChartJS.defaults.plugins.legend.labels.pointStyle = 'circle';
ChartJS.defaults.plugins.legend.labels.padding = 16;
ChartJS.defaults.plugins.legend.labels.boxWidth = 8;
ChartJS.defaults.plugins.legend.labels.boxHeight = 8;


export const Statistics = () => {
    const [statistics, setStatistics] = useState(null);
    const [latestTest, setLatestTest] = useState(null);
    const [connection, setConnection] = useState(null);
    const [showPlanDialog, setShowPlanDialog] = useState(false);
    const [loading, setLoading] = useState(true);
    const [expandedChart, setExpandedChart] = useState(null);
    const [mountPhase, setMountPhase] = useState(0);

    const [dateRange] = useContext(StatisticsRangeContext);
    const [config, reloadConfig] = useContext(ConfigContext);
    const updateToast = useContext(ToastNotificationContext);
    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState(null);
    const [dragIndex, setDragIndex] = useState(null);
    const savedLayout = parseLayout(config.dashboardLayout);
    const layout = editing && draft ? draft : savedLayout;

    // The header button asks to customize the cards
    useEffect(() => {
        const start = () => {
            sessionStorage.removeItem("speedmonitor:customize");
            setDraft(parseLayout(config.dashboardLayout));
            setEditing(true);
        };
        if (config.dashboardLayout !== undefined && sessionStorage.getItem("speedmonitor:customize")) start();
        window.addEventListener("speedmonitor:customize", start);
        return () => window.removeEventListener("speedmonitor:customize", start);
    }, [config.dashboardLayout]);

    const changeCard = (index, changes) => setDraft((cards) => cards.map((card, i) => i === index ? {...card, ...changes} : card));
    const move = (from, to) => setDraft((cards) => moveCard(cards, from, to));

    const onDragStart = (event, index) => {
        setDragIndex(index);
        event.dataTransfer.effectAllowed = "move";
    };
    const onDragOver = (event, index) => {
        event.preventDefault();
        if (dragIndex === null || dragIndex === index) return;
        move(dragIndex, index);
        setDragIndex(index);
    };

    const saveLayout = async () => {
        const value = isDefaultLayout(draft) ? "default" : JSON.stringify(draft);
        try {
            const response = await patchRequest("/config/dashboardLayout", {value});
            if (!response.ok) throw new Error();
            reloadConfig();
            setEditing(false);
            updateToast(t("dropdown.changes_applied"), "green", faCheck);
        } catch {
            updateToast(t("dropdown.changes_unsaved"), "red", faExclamationTriangle);
        }
    };

    const deferredStatistics = useDeferredValue(statistics);
    const isStale = deferredStatistics !== statistics;

    useEffect(() => {
        const timer = setTimeout(() => setMountPhase(1), 50);
        return () => clearTimeout(timer);
    }, []);

    useEffect(() => {
        if (mountPhase === 1) {
            const timer = setTimeout(() => setMountPhase(2), 150);
            return () => clearTimeout(timer);
        }
    }, [mountPhase]);

    const formatDateParam = (date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    const updateStats = useCallback(() => {
        const fromParam = formatDateParam(dateRange.from);
        const toParam = formatDateParam(dateRange.to);
        startTransition(() => setLoading(true));
        Promise.all([
            jsonRequest(`/speedtests/statistics/?from=${fromParam}&to=${toParam}`),
            jsonRequest("/speedtests?limit=1"),
            jsonRequest(`/outages?from=${fromParam}&to=${toParam}`).catch(() => null)
        ]).then(([stats, tests, outages]) => {
            startTransition(() => {
                setStatistics(stats);
                setConnection(outages?.outages ? outages : null);
                setLatestTest(tests.length > 0 ? tests[0] : null);
                setLoading(false);
            });
        }).catch(error => {
            console.error("Failed to load statistics:", error);
            startTransition(() => setLoading(false));
        });
    }, [dateRange]);

    useEffect(() => {
        if (mountPhase >= 2) updateStats();
    }, [mountPhase, updateStats]);

    useEffect(() => {
        const callback = () => updateStats();
        i18n.on("languageChanged", callback);
        return () => i18n.off("languageChanged", callback);
    }, []);

    if (mountPhase === 0) return null;

    if (loading && !deferredStatistics) {
        return (
            <div className="statistic-area statistic-loading">
                <div className="skeleton-chart skeleton-visible"></div>
                <div className="skeleton-chart skeleton-visible"></div>
                <div className="skeleton-chart skeleton-visible"></div>
            </div>
        );
    }

    if (!deferredStatistics) return <></>;
    if (!deferredStatistics.tests || deferredStatistics.tests.total === 0) return (
        <div className="statistic-area">
            <div className="statistics-empty">
                <p>{t("test.not_available")}</p>
            </div>
        </div>
    );

    const renderChart = (chartType) => {
        switch (chartType) {
            case 'overview':
                return <OverviewChart tests={deferredStatistics.tests} time={deferredStatistics.time} dateRange={dateRange}/>;
            case 'connection':
                return connection && <ConnectionDetails summary={connection} dateRange={dateRange}
                                                        onConfigure={() => setShowPlanDialog(true)}/>;
            case 'latest':
                return <LatestTestChart test={latestTest} expanded/>;
            case 'consistency':
                return <ConsistencyChart consistency={deferredStatistics.consistency}/>;
            case 'download':
                return <SpeedChart labels={deferredStatistics.labels} data={deferredStatistics.data} dataKey="download" titleKey="latest.down" color="hsl(187, 94%, 43%)" failed={deferredStatistics.failed} errors={deferredStatistics.errors} />;
            case 'upload':
                return <SpeedChart labels={deferredStatistics.labels} data={deferredStatistics.data} dataKey="upload" titleKey="latest.up" color="hsl(258, 90%, 66%)" failed={deferredStatistics.failed} errors={deferredStatistics.errors} />;
            case 'ping':
                return <PingChart labels={deferredStatistics.labels} data={deferredStatistics.data} failed={deferredStatistics.failed} errors={deferredStatistics.errors}/>;
            case 'hourly':
                return <HourlyChart hourlyAverages={deferredStatistics.hourlyAverages}/>;
            case 'avgDownload':
                return <AverageChart title={t("statistics.values.down")} data={deferredStatistics.download}/>;
            case 'avgUpload':
                return <AverageChart title={t("statistics.values.up")} data={deferredStatistics.upload}/>;
            default:
                return null;
        }
    };

    const cards = {
        overview: <OverviewChart tests={deferredStatistics.tests} time={deferredStatistics.time} dateRange={dateRange} onClick={() => setExpandedChart('overview')}/>,
        latest: <LatestTestChart test={latestTest} onClick={() => setExpandedChart('latest')}/>,
        consistency: <ConsistencyChart consistency={deferredStatistics.consistency} onClick={() => setExpandedChart('consistency')}/>,
        connection: <ConnectionChart summary={connection} onClick={() => setExpandedChart('connection')}/>,
        download: <SpeedChart labels={deferredStatistics.labels} data={deferredStatistics.data} dataKey="download" titleKey="latest.down" color="hsl(187, 94%, 43%)" failed={deferredStatistics.failed} errors={deferredStatistics.errors} onClick={() => setExpandedChart('download')} compact/>,
        upload: <SpeedChart labels={deferredStatistics.labels} data={deferredStatistics.data} dataKey="upload" titleKey="latest.up" color="hsl(258, 90%, 66%)" failed={deferredStatistics.failed} errors={deferredStatistics.errors} onClick={() => setExpandedChart('upload')} compact/>,
        ping: <PingChart labels={deferredStatistics.labels} data={deferredStatistics.data} failed={deferredStatistics.failed} errors={deferredStatistics.errors} onClick={() => setExpandedChart('ping')} compact/>,
        hourly: <HourlyChart hourlyAverages={deferredStatistics.hourlyAverages} onClick={() => setExpandedChart('hourly')}/>,
        avgDownload: <AverageChart title={t("statistics.values.down")} data={deferredStatistics.download} onClick={() => setExpandedChart('avgDownload')}/>,
        avgUpload: <AverageChart title={t("statistics.values.up")} data={deferredStatistics.upload} onClick={() => setExpandedChart('avgUpload')}/>
    };

    return (
        <div className={`statistic-area dash-area${isStale ? ' statistic-stale' : ''}${editing ? ' dash-area-editing' : ''}`}>
            {editing && (
                <div className="dash-toolbar">
                    <p>{t("dashboard.help")}</p>
                    <div className="dash-toolbar-actions">
                        <button className="dialog-btn" onClick={() => setDraft(DEFAULT_LAYOUT.map((card) => ({...card})))}>
                            <FontAwesomeIcon icon={faRotateLeft}/> <span>{t("dashboard.reset")}</span>
                        </button>
                        <button className="dialog-btn" onClick={() => setEditing(false)}>{t("dashboard.cancel")}</button>
                        <button className="dialog-btn dash-save" onClick={saveLayout}>
                            <FontAwesomeIcon icon={faCheck}/> <span>{t("dashboard.save")}</span>
                        </button>
                    </div>
                </div>
            )}

            {layout.map((card, index) => (editing || card.id !== "connection" || connection) && (
                <DashboardCard key={card.id} card={card} index={index} count={layout.length} editing={editing}
                               dragging={editing && dragIndex === index} onChange={changeCard} onMove={move}
                               onDragStart={onDragStart} onDragOver={onDragOver}
                               onDrop={(event) => event.preventDefault()} onDragEnd={() => setDragIndex(null)}>
                    {cards[card.id]}
                </DashboardCard>
            ))}

            <ChartModal 
                isOpen={!!expandedChart} 
                onClose={() => setExpandedChart(null)}
                isChart={['download', 'upload', 'ping', 'hourly'].includes(expandedChart)}
            >
                {expandedChart && renderChart(expandedChart)}
            </ChartModal>
            <PlanDialog open={showPlanDialog} onClose={() => setShowPlanDialog(false)} onSaved={updateStats}/>
        </div>
    );
}