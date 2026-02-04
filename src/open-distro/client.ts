process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

export class OpendistroClient {
    private readonly apiUrl: string;
    private readonly username: string;
    private readonly password: string;
    private readonly dashboardPrivateUrl: string;

    constructor(
        apiUrl: string,
        dashboardPrivateUrl: string,
        username: string,
        password: string
    ) {
        this.dashboardPrivateUrl = dashboardPrivateUrl;
        this.apiUrl = apiUrl;
        this.username = username;
        this.password = password;
    }

    public async findMonitor(monitorId: string): Promise<string>
    {
        // @see https://docs.opensearch.org/latest/observing-your-data/alerting/api/
            const res = await fetch(this.apiUrl + '/_plugins/_alerting/monitors/' + monitorId, {
                headers: this.getAuthHeaders()
            });
            if (!res.ok) {
                const errorBody = await res.text();
                throw new Error(`HTTP error! Status: ${res.status}, Body: ${errorBody}`);
            }
            console.log(res)
            return res.text();
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