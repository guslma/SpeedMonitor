import {useEffect, useMemo, useState} from "react";
import {useNavigate} from "react-router-dom";
import {t} from "i18next";
import StatisticContainer from "@/pages/Statistics/components/StatisticContainer";
import {jsonRequest} from "@/common/utils/RequestUtil";
import {countryName} from "@/common/utils/ServiceUtil";
import Globe from "@/common/components/Globe";
import "./styles.sass";

// The globe of attacks around the world, turning; the map page has the details
export const AttacksCard = () => {
    const navigate = useNavigate();
    const [attacks, setAttacks] = useState(null);

    useEffect(() => {
        const load = () => jsonRequest("/map/attacks").then(setAttacks).catch(() => {});
        load();
        const timer = setInterval(load, 60 * 60 * 1000);
        return () => clearInterval(timer);
    }, []);

    // While the server is still placing addresses on their cities, asks again to show them
    useEffect(() => {
        if (!(attacks?.pending >= 20)) return;
        const timer = setTimeout(() => jsonRequest("/map/attacks").then(setAttacks).catch(() => {}), 70 * 1000);
        return () => clearTimeout(timer);
    }, [attacks]);

    const spots = useMemo(() => [...attacks?.countrySpots || [], ...attacks?.sources || []], [attacks]);
    const top = attacks?.countries?.[0];

    const openMap = () => {
        try {
            localStorage.setItem("mapAttacks", "true");
        } catch {}
        navigate("/map");
    };

    return (
        <StatisticContainer title={t("dashboard.cards.attacks")} onClick={openMap}>
            <div className="attacks-card">
                <div className="attacks-card-globe"><Globe data={null} attacks={spots} showConnection={false} compact/></div>
                {attacks?.total && <p>
                    <strong>{t("map.attacks.total", {addresses: attacks.total.addresses.toLocaleString(), countries: attacks.total.countries})}</strong>
                    {top && <span>{t("map.attacks.card_top", {country: countryName(top.cc, top.country)})}</span>}
                </p>}
                {attacks?.error && !attacks?.sources?.length && <p>{t("map.attacks.failed")}</p>}
            </div>
        </StatisticContainer>
    );
};

export default AttacksCard;
