import {useEffect, useMemo, useState} from "react";
import {useNavigate} from "react-router-dom";
import {t} from "i18next";
import {FontAwesomeIcon} from "@fortawesome/react-fontawesome";
import {faArrowLeft, faGlobe, faShieldHalved} from "@fortawesome/free-solid-svg-icons";
import {jsonRequest} from "@/common/utils/RequestUtil";
import {countryName, describeLocation, formatMs, pingColor, placeName, stateColor} from "@/common/utils/ServiceUtil";
import Globe from "@/common/components/Globe";
import "./styles.sass";

const REFRESH = 2 * 60 * 1000;
const ATTACKS_REFRESH = 60 * 60 * 1000;
const ATTACKS_KEY = "mapAttacks";

const readToggle = () => {
    try {
        return localStorage.getItem(ATTACKS_KEY) === "true";
    } catch {
        return false;
    }
};

const place = placeName;

// Where the internet of this server goes: the services it checks, the speed test servers and the other servers
export const Map = () => {
    const navigate = useNavigate();
    const [data, setData] = useState(null);
    const [failed, setFailed] = useState(false);
    // The attacks layer is remembered in this browser
    const [showAttacks, setShowAttacks] = useState(readToggle);
    const [attacks, setAttacks] = useState(null);

    useEffect(() => {
        try {
            localStorage.setItem(ATTACKS_KEY, String(showAttacks));
        } catch {}
        if (!showAttacks) return;
        const load = () => jsonRequest("/map/attacks").then(setAttacks).catch(() => setAttacks({error: true, sources: []}));
        load();
        const timer = setInterval(load, ATTACKS_REFRESH);
        return () => clearInterval(timer);
    }, [showAttacks]);

    // While the server is still placing addresses on their cities, asks again a little later to show them
    useEffect(() => {
        // (a handful that can never be located is not worth waiting for)
        if (!showAttacks || !(attacks?.pending >= 20)) return;
        const timer = setTimeout(() => jsonRequest("/map/attacks").then(setAttacks).catch(() => {}), 70 * 1000);
        return () => clearTimeout(timer);
    }, [showAttacks, attacks]);

    const attackSpots = useMemo(() => showAttacks ? [...attacks?.countrySpots || [], ...attacks?.sources || []] : null,
        [showAttacks, attacks]);

    useEffect(() => {
        const load = () => jsonRequest("/map").then((result) => {
            setData(result);
            setFailed(false);
        }).catch(() => setFailed(true));
        load();
        const timer = setInterval(load, REFRESH);
        return () => clearInterval(timer);
    }, []);

    const services = data?.services || [];
    const servers = (data?.servers || []).filter((server) => server.lat !== undefined);
    const nodes = data?.nodes || [];

    return (
        <div className="map-page">
            <div className="map-toolbar">
                <button className="dialog-btn" onClick={() => navigate("/statistics")}>
                    <FontAwesomeIcon icon={faArrowLeft}/> {t("map.back")}
                </button>
                {/* Two maps, each on its own: this connection, or the attacks around the world */}
                <div className="map-modes" role="tablist">
                    <button role="tab" aria-selected={!showAttacks} className={"map-mode" + (showAttacks ? "" : " map-mode-active")}
                            onClick={() => setShowAttacks(false)}>
                        <FontAwesomeIcon icon={faGlobe}/> {t("map.modes.connection")}
                    </button>
                    <button role="tab" aria-selected={showAttacks} className={"map-mode map-attacks-toggle" + (showAttacks ? " map-mode-active map-mode-attacks" : "")}
                            onClick={() => setShowAttacks(true)}>
                        <FontAwesomeIcon icon={faShieldHalved}/> {t("map.attacks.toggle")}
                    </button>
                </div>
            </div>
            <div className="map-intro">
                <h1>{showAttacks ? t("map.attacks.title") : t("map.title")}</h1>
                <p>{showAttacks ? t("map.attacks.description")
                    : data?.home ? t("map.description", {city: data.home.city}) : t("map.description_unknown")}</p>
            </div>

            {failed && !data && <p className="map-empty">{t("map.failed")}</p>}
            {!failed && !data && <p className="map-empty">{t("map.loading")}</p>}

            {data && (
                <div className="map-layout">
                    <div className="map-globe">
                        <Globe data={data} showConnection={!showAttacks}
                               attacks={attackSpots}/>
                        {showAttacks ? (
                            <div className="map-legend">
                                <span><i className="map-legend-attack"/>{t("map.legend.attack_city")}</span>
                                <span><i className="map-legend-attack map-legend-attack-country"/>{t("map.legend.attack_country")}</span>
                            </div>
                        ) : (
                            <div className="map-legend">
                                <span><i className="map-legend-home"/>{t("map.legend.home")}</span>
                                <span><i style={{background: "var(--accent-primary)"}}/>{t("map.legend.ok")}</span>
                                <span><i style={{background: "var(--accent-warning)"}}/>{t("map.legend.slow")}</span>
                                <span><i style={{background: "var(--accent-danger)"}}/>{t("map.legend.down")}</span>
                                <span><i className="map-legend-estimate"/>{t("map.legend.estimate")}</span>
                                <span><i className="map-legend-node"/>{t("map.legend.node")}</span>
                            </div>
                        )}
                    </div>

                    <div className="map-lists">
                        {showAttacks && (
                            <section className="map-attacks">
                                <h2>{t("map.attacks.summary")}</h2>
                                {attacks?.total && <p className="map-attacks-total">
                                    {t("map.attacks.total", {addresses: attacks.total.addresses.toLocaleString(), countries: attacks.total.countries})}
                                </p>}
                                {attacks?.pending >= 20 && <p className="map-note">{t("map.attacks.pending", {count: attacks.pending})}</p>}
                                {!attacks && <p className="map-none">{t("map.loading")}</p>}
                                {attacks?.error && !attacks.sources?.length && <p className="map-none">{t("map.attacks.failed")}</p>}
                                {attacks?.countries?.length > 0 && <>
                                    <h3>{t("map.attacks.countries")}</h3>
                                    {attacks.countries.slice(0, 8).map((country) => (
                                        <div className="map-row" key={country.cc}>
                                            <span className="map-dot map-dot-attack"/>
                                            <div className="map-row-text">
                                                <strong>{countryName(country.cc, country.country)}</strong>
                                                <span>{t("map.attacks.addresses", {count: country.addresses})}</span>
                                            </div>
                                            <span className="map-row-value">{country.attacks.toLocaleString()}</span>
                                        </div>
                                    ))}
                                </>}
                                {attacks?.ports?.length > 0 && <>
                                    <h3>{t("map.attacks.ports")}</h3>
                                    <div className="map-ports">
                                        {attacks.ports.slice(0, 8).map((port) => (
                                            <span key={port.port} className="map-port">
                                                <strong>{port.port}</strong>{port.name && ` ${port.name}`}
                                                <small>{port.records.toLocaleString()}</small>
                                            </span>
                                        ))}
                                    </div>
                                </>}
                                <p className="map-note">{t("map.attacks.source")}</p>
                            </section>
                        )}
                        {!showAttacks && <>
                        <section>
                            <h2>{t("map.services")}</h2>
                            {services.length === 0 && <p className="map-none">{t("map.no_services")}</p>}
                            {services.map((service) => (
                                <div className="map-row" key={service.id}>
                                    <span className="map-dot" style={{background: stateColor(service.state)}}/>
                                    <div className="map-row-text">
                                        <strong>{service.name}</strong>
                                        <span>{describeLocation(service)}</span>
                                    </div>
                                    <span className="map-row-value" style={service.state === "down" ? {color: stateColor("down")} : undefined}>
                                        {service.state === "down" ? t("map.legend.down") : formatMs(service.ms)}</span>
                                </div>
                            ))}
                        </section>

                        <section>
                            <h2>{t("map.servers")}</h2>
                            {servers.length === 0 && <p className="map-none">{t("map.no_servers")}</p>}
                            {servers.map((server) => (
                                <div className="map-row" key={server.host}>
                                    <span className="map-dot" style={{background: pingColor(server.ping)}}/>
                                    <div className="map-row-text">
                                        <strong>{server.name}</strong>
                                        <span>{place(server)} · {t("map.tests", {count: server.tests})}</span>
                                    </div>
                                    <span className="map-row-value">{server.ping ?? "–"} ms</span>
                                </div>
                            ))}
                        </section>

                        {nodes.length > 0 && <section>
                            <h2>{t("map.nodes")}</h2>
                            {nodes.map((node) => (
                                <div className="map-row" key={node.id}>
                                    <span className="map-dot map-dot-node"/>
                                    <div className="map-row-text">
                                        <strong>{node.name}</strong>
                                        <span>{node.lat !== undefined ? place(node) : t("map.node_unknown")}</span>
                                    </div>
                                </div>
                            ))}
                        </section>}

                        <p className="map-note">{t("map.note")}</p>
                        </>}
                    </div>
                </div>
            )}
        </div>
    );
};

export default Map;
