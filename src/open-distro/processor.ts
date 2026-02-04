import {OpendistroClient} from "./client.ts";
import { RISON } from 'rison2'

export class OpendistroProcessor
{
    private client: OpendistroClient;
    private dashboardPublicHost: string;

    constructor(client: OpendistroClient, dashboardPublicHost: string) {
        this.client = client;
        this.dashboardPublicHost = dashboardPublicHost;
    }

    public async findDashboardQuery(monitorId: string, periodStart: string, periodEnd: string): Promise<string>
    {
        let response = await this.client.findMonitor(monitorId);
        response.replace('{{period_end}}', periodEnd)
            .replace('{{period_start}}', periodStart);
        const data = JSON.parse(response);
        console.log(response);

        const indexId = data.monitor.inputs[0].search.indices[0];

        const indexPatternId = await this.client.getIndexPatternIdByIndexName(indexId);

        const filters = data.monitor.inputs[0].search.query.query;

        const rison = RISON.stringify({
            "filters": [{
                "$state": {"store": "appState"},
                "query": filters,
                // "size": 0
            }],
            "index": indexPatternId,
            "interval": "auto",
            "query": {"language": "kuery", "query": ""}
        })
        return this.dashboardPublicHost + '/app/discover#?'
        + `_g=(filters:!(),refreshInterval:(pause:!t,value:0),time:(from:${periodStart},to:${periodEnd}`
        + `_a=${rison}`;

    }
}