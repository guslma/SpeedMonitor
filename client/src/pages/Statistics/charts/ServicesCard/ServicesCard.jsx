import {useEffect, useState} from "react";
import {useNavigate} from "react-router-dom";
import {t} from "i18next";
import StatisticContainer from "@/pages/Statistics/components/StatisticContainer";
import {jsonRequest} from "@/common/utils/RequestUtil";
import {formatMs, formatSince, isAltered, problemRank, stateColor} from "@/common/utils/ServiceUtil";
import {describeAll} from "@/pages/Services";
import "./styles.sass";

// What is wrong with a service, in a few words
const problemText = (service) => {
    if (service.state === "down") return t("services.state.down", {since: formatSince(service.since)});
    if (service.state === "slow") return t("services.state.slow", {ms: formatMs(service.ms)});
    return t("services.card.altered", {ms: formatMs(service.ms), normal: formatMs(service.averageMs)});
};

// Is WhatsApp, YouTube... answering? The ones with a problem first (down, slow, slower than usual), then a chip
// for each of the others
export const ServicesCard = () => {
    const navigate = useNavigate();
    const [data, setData] = useState(null);

    useEffect(() => {
        const load = () => jsonRequest("/services").then(setData).catch(() => {});
        load();
        const timer = setInterval(load, 60 * 1000);
        return () => clearInterval(timer);
    }, []);

    const services = data?.services || [];
    const problems = services.filter((service) => problemRank(service) < 3).sort((a, b) => problemRank(a) - problemRank(b));
    const others = services.filter((service) => problemRank(service) === 3);
    const overall = !data?.monitor ? {tone: "offline", text: t("services.monitor_off")}
        : problems.length && problems.every(isAltered) ? {tone: "slow", text: t("services.card.altered_summary", {count: problems.length})}
            : describeAll(services);

    return (
        <StatisticContainer title={t("dashboard.cards.services")} onClick={() => navigate("/services")}>
            <div className="services-card">
                <p className={"services-card-summary services-card-" + overall.tone}>{overall.text}</p>
                {data?.monitor && problems.length > 0 && (
                    <div className="services-card-problems">
                        {problems.map((service) => {
                            const color = service.state === "down" ? stateColor("down") : stateColor("slow");
                            return (
                                <div className="services-card-problem" key={service.id} style={{borderColor: color}}>
                                    <span className={"services-card-dot" + (service.state === "down" ? " service-dot-down" : "")}
                                          style={{background: color}}/>
                                    <strong>{service.name}</strong>
                                    <span style={{color}}>{problemText(service)}</span>
                                </div>
                            );
                        })}
                    </div>
                )}
                <div className="services-card-grid">
                    {others.map((service) => (
                        <div className="services-card-item" key={service.id} title={service.name}>
                            <span className="services-card-dot" style={{background: stateColor(service.state)}}/>
                            <span className="services-card-name">{service.name}</span>
                            <span className="services-card-ms">{formatMs(service.ms)}</span>
                        </div>
                    ))}
                </div>
            </div>
        </StatisticContainer>
    );
};

export default ServicesCard;
