import ChartWrapper from "@/common/components/ChartWrapper";
import { useMemo, useContext, memo } from "react";
import { t } from "i18next";
import { describeError } from "@/common/utils/ConnectionUtil";
import { ThemeContext } from "@/common/contexts/Theme";
import { PreferencesContext } from "@/common/contexts/Preferences";
import { convertSpeed, getSpeedUnit, TIME_FORMAT_12H } from "@/common/utils/FormatUtil";
import "./SpeedChart/styles.sass";

// Same colors as the separate charts, so each line is recognized at once. Ping and jitter are dashed: they are on
// the right scale (ms), download and upload on the left one (speed).
const COLORS = {
    download: "hsl(187, 94%, 43%)",
    upload: "hsl(258, 90%, 66%)",
    ping: "hsl(38, 92%, 50%)",
    jitter: "hsl(320, 75%, 65%)",
    failed: "hsl(0, 72%, 51%)"
};

// Download, upload, ping and jitter in one chart, to see at a glance whether they change together
const CombinedChart = memo(({ labels, data, failed, errors, onClick, compact = false }) => {
    const [isDarkMode] = useContext(ThemeContext);
    const [preferences] = useContext(PreferencesContext);
    const speedUnit = getSpeedUnit(preferences);
    const msUnit = t("latest.ping_unit");
    const use12h = preferences?.timeFormat === TIME_FORMAT_12H;

    const series = useMemo(() => {
        if (!labels || !data) return { labels: [], download: [], upload: [], ping: [], jitter: [], failed: [], errors: [], isSingleDay: false };
        const pick = (key, convert) => labels.map((_, index) => {
            const value = data[key]?.[index];
            return value === null || value === undefined ? null : convert ? convert(value) : value;
        });
        return {
            labels,
            download: pick("download", (value) => convertSpeed(value, preferences)),
            upload: pick("upload", (value) => convertSpeed(value, preferences)),
            ping: pick("ping"),
            jitter: pick("jitter"),
            failed: labels.map((_, index) => failed?.[index] || false),
            errors: labels.map((_, index) => errors?.[index] || null),
            isSingleDay: new Set(labels.map((label) => new Date(label).toDateString())).size === 1
        };
    }, [labels, data, failed, errors, preferences]);

    const hasJitter = useMemo(() => series.jitter.some((value) => value !== null), [series.jitter]);
    const failedMarkers = useMemo(() => series.failed.map((isFailed) => isFailed ? 0 : null), [series.failed]);
    const hasFailed = useMemo(() => failedMarkers.some((value) => value !== null), [failedMarkers]);

    const themeColors = useMemo(() => ({
        gridColor: isDarkMode ? 'rgba(42, 52, 65, 0.6)' : 'rgba(203, 213, 225, 0.8)',
        tickColor: isDarkMode ? 'hsl(215, 20%, 50%)' : 'hsl(215, 25%, 40%)',
        tooltipBg: isDarkMode ? 'hsl(215, 28%, 10%)' : 'hsl(0, 0%, 100%)',
        tooltipTitle: isDarkMode ? 'hsl(210, 40%, 96%)' : 'hsl(215, 25%, 20%)',
        tooltipBody: isDarkMode ? 'hsl(215, 20%, 65%)' : 'hsl(215, 15%, 40%)',
        tooltipBorder: isDarkMode ? 'hsl(215, 25%, 22%)' : 'hsl(215, 20%, 85%)'
    }), [isDarkMode]);

    const failedLabel = t("statistics.failed_test");

    const chartOptions = useMemo(() => ({
        responsive: true,
        maintainAspectRatio: false,
        resizeDelay: 100,
        animation: { duration: 250, easing: 'easeOutQuart' },
        animations: { colors: false, x: false },
        transitions: { active: { animation: { duration: 100 } }, resize: { animation: { duration: 0 } } },
        plugins: {
            tooltip: {
                backgroundColor: themeColors.tooltipBg,
                titleColor: themeColors.tooltipTitle,
                bodyColor: themeColors.tooltipBody,
                borderColor: themeColors.tooltipBorder,
                borderWidth: 1,
                padding: 14,
                cornerRadius: 10,
                displayColors: true,
                boxPadding: 8,
                filter: (item) => item.dataset.label !== failedLabel,
                callbacks: {
                    title: (items) => {
                        if (!items.length) return '';
                        const date = new Date(series.labels[items[0].dataIndex]);
                        return date.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }) +
                            ' ' + date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: use12h });
                    },
                    label: (item) => `${item.dataset.label}: ${item.formattedValue} ${item.dataset.unit}`,
                    afterBody: (items) => {
                        if (!items.length) return '';
                        const index = items[0].dataIndex;
                        if (!series.failed[index]) return '';
                        const error = series.errors[index];
                        return error ? `\n⚠ ${failedLabel}: ${describeError(error)}` : `\n⚠ ${failedLabel}`;
                    }
                }
            },
            legend: {
                position: "bottom",
                labels: {
                    usePointStyle: true,
                    pointStyle: 'circle',
                    padding: compact ? 12 : 20,
                    color: themeColors.tickColor,
                    font: { size: 12, weight: 500 },
                    filter: (item) => item.text !== failedLabel
                },
                // On the dashboard a click opens the chart; in the modal a click on the legend hides or shows a line
                onClick: compact ? () => {} : undefined
            }
        },
        scales: {
            x: {
                grid: { color: themeColors.gridColor, drawBorder: false },
                border: { display: false },
                ticks: {
                    color: themeColors.tickColor,
                    maxTicksLimit: series.isSingleDay ? 12 : 5,
                    // Small cards: fewer dates, lying flat, instead of a slanted pile
                    maxRotation: 0,
                    autoSkipPadding: 16,
                    callback: (value, index) => {
                        const date = new Date(series.labels[index]);
                        if (series.isSingleDay) return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: use12h });
                        return date.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ' ' +
                            date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: use12h });
                    }
                }
            },
            y: {
                position: 'left',
                beginAtZero: true,
                grid: { color: themeColors.gridColor, drawBorder: false },
                border: { display: false },
                title: { display: !compact, text: speedUnit, color: themeColors.tickColor },
                ticks: { color: themeColors.tickColor }
            },
            y1: {
                position: 'right',
                beginAtZero: true,
                grid: { drawOnChartArea: false },
                border: { display: false },
                title: { display: !compact, text: msUnit, color: themeColors.tickColor },
                ticks: { color: themeColors.tickColor }
            }
        },
        interaction: { intersect: false, mode: 'index' },
        elements: {
            line: { tension: 0.35, borderWidth: 2.5 },
            point: { radius: 0, hoverRadius: compact ? 0 : 5, hoverBorderWidth: 2 }
        }
    }), [themeColors, series, compact, use12h, speedUnit, msUnit, failedLabel]);

    const chartData = useMemo(() => {
        const line = (key, label, unit, axis, extra = {}) => ({
            label, unit, yAxisID: axis,
            data: series[key],
            borderColor: COLORS[key],
            backgroundColor: COLORS[key],
            pointBackgroundColor: COLORS[key],
            pointBorderColor: COLORS[key],
            fill: false,
            spanGaps: true,
            ...extra
        });
        return {
            labels: series.labels,
            datasets: [
                line("download", t("latest.down"), speedUnit, "y", { order: 1 }),
                line("upload", t("latest.up"), speedUnit, "y", { order: 2 }),
                line("ping", t("latest.ping"), msUnit, "y1", { borderDash: [6, 4], borderWidth: 2, order: 3 }),
                ...(hasJitter ? [line("jitter", t("latest.jitter"), msUnit, "y1", { borderDash: [2, 3], borderWidth: 2, order: 4 })] : []),
                ...(hasFailed ? [{
                    label: failedLabel,
                    unit: "",
                    yAxisID: "y",
                    data: failedMarkers,
                    borderColor: 'transparent',
                    backgroundColor: COLORS.failed,
                    pointBackgroundColor: COLORS.failed,
                    pointBorderColor: 'hsl(0, 84%, 60%)',
                    pointBorderWidth: compact ? 1 : 2,
                    pointRadius: compact ? 3 : 6,
                    pointHoverRadius: compact ? 4 : 8,
                    pointStyle: 'crossRot',
                    showLine: false,
                    fill: false,
                    order: 0
                }] : [])
            ]
        };
    }, [series, speedUnit, msUnit, hasJitter, hasFailed, failedMarkers, failedLabel, compact]);

    return (
        <div className="chart-container combined-chart" onClick={onClick}>
            <div className="chart-header">
                <h3 className="chart-title">{t("dashboard.cards.combined")}</h3>
            </div>
            <div className="chart-body">
                <ChartWrapper type="line" data={chartData} options={chartOptions} />
            </div>
        </div>
    );
});

export default CombinedChart;
