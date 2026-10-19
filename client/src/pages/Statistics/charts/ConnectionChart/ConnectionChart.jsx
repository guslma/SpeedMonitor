import {t} from "i18next";
import {FontAwesomeIcon} from "@fortawesome/react-fontawesome";
import {faFileContract, faPlug, faStopwatch} from "@fortawesome/free-solid-svg-icons";
import StatisticContainer from "@/pages/Statistics/components/StatisticContainer";
import {availabilityColor, formatDuration} from "@/common/utils/ConnectionUtil";
import "@/pages/Statistics/charts/ConsistencyChart/styles.sass";
import "./styles.sass";

export const ConnectionChart = ({summary, onClick}) => {
    if (!summary) return null;

    const plan = summary.plan;
    const planResult = plan?.configured ? (plan.download || plan.upload) : null;
    const planColor = planResult ? (plan.ok ? "icon-green" : "icon-red") : "icon-orange";

    const availability = summary.ongoing
        ? {value: t("connection.offline_now"), color: "icon-red"}
        : {value: summary.availability === null ? "-" : `${summary.availability}%`, color: availabilityColor(summary.availability)};

    const items = [
        {
            title: t("connection.availability"),
            value: availability.value,
            color: availability.color,
            detail: summary.count === 0 ? t("connection.no_outages")
                : t("connection.outages_detail", {count: summary.count, duration: formatDuration(summary.downtime)}),
            icon: faPlug
        },
        {
            title: t("connection.longest"),
            value: summary.count === 0 ? "-" : formatDuration(summary.longest),
            color: summary.longest >= 3600 ? "icon-red" : summary.longest > 0 ? "icon-orange" : "icon-green",
            detail: t("connection.longest_detail"),
            icon: faStopwatch
        },
        {
            title: t("connection.plan"),
            value: planResult ? t("connection.plan_percent", {percent: planResult.averagePercent}) : t("connection.plan_missing"),
            color: planColor,
            detail: planResult ? t(plan.ok ? "connection.plan_ok" : "connection.plan_not_ok") : t("connection.plan_missing_detail"),
            icon: faFileContract
        }
    ];

    return (
        <StatisticContainer title={t("connection.title")} size="large" onClick={onClick}>
            <div className="consistency-container connection-container">
                {items.map((item) => (
                    <div className="consistency-item" key={item.title}>
                        <div className="consistency-info">
                            <h2>{item.title}</h2>
                            <p className={item.color}>{item.value}</p>
                            <span className="consistency-detail">{item.detail}</span>
                        </div>
                        <FontAwesomeIcon icon={item.icon} className={item.color}/>
                    </div>
                ))}
            </div>
        </StatisticContainer>
    );
};
