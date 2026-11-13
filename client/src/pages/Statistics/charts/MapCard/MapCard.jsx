import {useEffect, useState} from "react";
import {t} from "i18next";
import StatisticContainer from "@/pages/Statistics/components/StatisticContainer";
import {jsonRequest} from "@/common/utils/RequestUtil";
import Globe from "@/common/components/Globe";
import "./styles.sass";

// A small turning globe with where the internet goes; the modal has the details
export const MapCard = ({onClick}) => {
    const [data, setData] = useState(null);

    useEffect(() => {
        const load = () => jsonRequest("/map").then(setData).catch(() => {});
        load();
        const timer = setInterval(load, 2 * 60 * 1000);
        return () => clearInterval(timer);
    }, []);

    const located = data ? (data.services || []).filter((service) => service.lat !== undefined).length : 0;

    return (
        <StatisticContainer title={t("dashboard.cards.map")} onClick={onClick}>
            <div className="map-card">
                <div className="map-card-globe"><Globe data={data} compact/></div>
                {data?.home && <p>{t("map.card_summary", {city: data.home.city, count: located})}</p>}
            </div>
        </StatisticContainer>
    );
};

export default MapCard;
