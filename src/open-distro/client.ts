process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

import pMemoize from 'p-memoize';

export type MonitorResponse = {
    id: string,
    indexId: string,
    query: object,
}
export class OpendistroClient {
    private readonly username: string;
    private readonly password: string;
    private readonly dashboardPrivateUrl: string;

    // Cache TTL: 1 day in milliseconds (Step 1)
    private static readonly INDEX_PATTERN_CACHE_TTL = 24 * 60 * 60 * 1000;

    // Memoized function for index pattern lookup (created per-instance, Step 3)
    private readonly getIndexPatternMemoized: (indexName: string) => Promise<string>;

    constructor(
        dashboardPrivateUrl: string,
        username: string,
        password: string
    ) {
        this.dashboardPrivateUrl = dashboardPrivateUrl;
        this.username = username;
        this.password = password;

        // Create memoized version of the helper (Step 3)
        this.getIndexPatternMemoized = pMemoize(
            this._getIndexPatternIdByIndexName.bind(this),
            { maxAge: OpendistroClient.INDEX_PATTERN_CACHE_TTL }
        );
    }


    public async findMonitorByTriggerId(triggerId: string): Promise<MonitorResponse>
    {
        const perpageMaximum = 2000;
        // @see https://docs.opensearch.org/latest/observing-your-data/alerting/api/

        // don't put triggerId to search, since it not working with some chars (hyphen for example)
        const res = await fetch(this.dashboardPrivateUrl + '/api/alerting/monitors?from=0&size=' + perpageMaximum + '&search=&sortField=name&sortDirection=desc&state=all', {
            headers: this.getAuthHeaders(),
        });
        if (!res.ok) {
            const errorBody = await res.text();
            throw new Error(`HTTP error! Status: ${res.status}, Body: ${errorBody}`);
        }
        const json = await res.json();

        for (const monitorData of json.monitors) {
            for (const triggerData of monitorData.monitor.triggers) {
                if (triggerData.query_level_trigger?.id === triggerId) {
                    return {
                        id: monitorData.id,
                        indexId: monitorData.monitor.inputs[0].search.indices[0],
                        query: monitorData.monitor.inputs[0].search.query,
                    };
                }
            }
        }
        throw new Error(`Monitor ${triggerId} not found.`);
    }

    public async getIndexPatternIdByIndexName(indexName: string): Promise<string>
    {
        return this.getIndexPatternMemoized(indexName);
    }

    private async _getIndexPatternIdByIndexName(indexName: string): Promise<string>
    {
        const base = indexName.split('-');
        if (base[base.length - 1] === '*') {
            base.pop()
        }
        while (true) {
            const indexNameIteration = base.join('-') + '-*';

            const url = this.dashboardPrivateUrl + '/api/saved_objects/_find?fields=title&per_page=10000&type=index-pattern&search=' + indexNameIteration;
            const res = await fetch(url, {
                headers: this.getAuthHeaders()
            });
            if (!res.ok) {
                const errorBody = await res.text();
                throw new Error(`HTTP error! Status: ${res.status}, Body: ${errorBody}`);
            }
            const json = await res.json();
            if (json?.total !== 0) {
                for (const indexPattern of json.saved_objects) {
                    if (indexPattern.attributes.title === indexNameIteration) {
                        return indexPattern.id;
                    }
                }
            }

            base.pop();
            if (base.length === 0) {
                break;
            }
        }
        throw new Error(`Index pattern for ${indexName} not found.`);
    }

    private getAuthHeaders(): HeadersInit
    {
        const authHeader = 'Basic ' + Buffer.from(this.username + ':' + this.password).toString('base64');
        return {
            'Authorization': authHeader
        };
    }
}