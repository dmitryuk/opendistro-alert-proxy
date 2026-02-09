process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

export type MonitorResponse = {
    id: string,
    indexId: string,
    query: object,
}
export class OpendistroClient {
    private readonly username: string;
    private readonly password: string;
    private readonly dashboardPrivateUrl: string;

    constructor(
        dashboardPrivateUrl: string,
        username: string,
        password: string
    ) {
        this.dashboardPrivateUrl = dashboardPrivateUrl;
        this.username = username;
        this.password = password;
    }


    public async findMonitorByName(monitorName: string): Promise<MonitorResponse>
    {
        const perpageMaximum = 2000;
        // @see https://docs.opensearch.org/latest/observing-your-data/alerting/api/

        // don't put monitorName to search, since it not working with some chars (hyphen for example)
        const res = await fetch(this.dashboardPrivateUrl + '/api/alerting/monitors?from=0&size=' + perpageMaximum + '&search=&sortField=name&sortDirection=desc&state=all', {
            headers: this.getAuthHeaders(),
        });
        if (!res.ok) {
            const errorBody = await res.text();
            throw new Error(`HTTP error! Status: ${res.status}, Body: ${errorBody}`);
        }
        const json = await res.json();

        for (const monitorData of json.monitors) {
            if (monitorData?.name === monitorName) {
                return {
                    id: monitorData.id,
                    indexId: monitorData.monitor.inputs[0].search.indices[0],
                    query: monitorData.monitor.inputs[0].search.query,
                };
            }
        }
        throw new Error(`Monitor ${monitorName} not found.`);
    }

    public async getIndexPatternIdByIndexName(indexName: string): Promise<string>
    {
        const url = this.dashboardPrivateUrl + '/api/saved_objects/_find?fields=title&per_page=10000&type=index-pattern&search='  + indexName;
        const res = await fetch(url, {
            headers: this.getAuthHeaders()
        });
        if (!res.ok) {
            const errorBody = await res.text();
            throw new Error(`HTTP error! Status: ${res.status}, Body: ${errorBody}`);
        }
        const json = await res.json();
        if (json?.total  === 0) {
            throw new Error(`Index pattern for ${indexName} not found.`);
        }

        return json.saved_objects[0].id;
    }

    private getAuthHeaders(): HeadersInit
    {
        const authHeader = 'Basic ' + Buffer.from(this.username + ':' + this.password).toString('base64');
        return {
            'Authorization': authHeader
        };
    }
}