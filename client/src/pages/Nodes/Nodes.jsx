import "./styles.sass";
import NodeHeader from "@/pages/Nodes/components/NodeHeader";
import NodeContainer from "@/pages/Nodes/components/NodeContainer";
import {useContext, useEffect, useState} from "react";
import {NodeContext} from "@/common/contexts/Node";
import {t} from "i18next";
import CreateNodeDialog from "@/pages/Nodes/components/CreateNodeDialog";
import {ConfigContext} from "@/common/contexts/Config";
import {useAlert} from "@/common/contexts/Alert";
import {FontAwesomeIcon} from "@fortawesome/react-fontawesome";
import {faPlus} from "@fortawesome/free-solid-svg-icons";
import {baseRequest} from "@/common/utils/RequestUtil";

export const Nodes = () => {
    const [config] = useContext(ConfigContext);
    const [nodes, updateNodes] = useContext(NodeContext);
    const alert = useAlert();
    const [createDialogOpen, setCreateDialogOpen] = useState(false);

    const openPreviewInfoDialog = () => {
        alert.openAlert(t("preview.title"), t("nodes.preview_active"), {buttonText: t("dialog.close")});
    }

    // The name this server has in its preferences (the config context may belong to another server being viewed)
    const [ownName, setOwnName] = useState(null);

    useEffect(() => {
        updateNodes();
        baseRequest("/config").then((res) => res.json()).then((own) => {
            if (own.serverName && own.serverName !== "none") setOwnName(own.serverName);
        }).catch(() => {});
    }, []);

    return (
        <div className="node-page">
            <CreateNodeDialog open={createDialogOpen} onClose={() => setCreateDialogOpen(false)}/>
            <NodeHeader/>
            <div className="node-area">
                <NodeContainer name={ownName || t("nodes.this_server")}
                               url={ownName ? `${t("nodes.this_server")} · ${location.host}` : location.host} currentNode={true} id={0}/>

                {nodes.map(node => <NodeContainer {...node} key={node.id} />)}

                <div className={"node-add" + (config.previewMode ? " node-disabled" : "")} onClick={() => config.previewMode
                    ? openPreviewInfoDialog() : setCreateDialogOpen(true)}>
                    <FontAwesomeIcon icon={faPlus}/>
                    <h1>{t("nodes.add")}</h1>
                </div>
            </div>
        </div>
    )
}