import {OpendistroClient} from "./client.ts";
import { RISON } from 'rison2'

export class OpendistroProcessor
{
    private client: OpendistroClient;
    private readonly dashboardPublicHost: string;

    constructor(client: OpendistroClient, dashboardPublicHost: string) {
        this.client = client;
        this.dashboardPublicHost = dashboardPublicHost;
    }

    /**
     * Recursively removes any 'range' entries that contain the '@timestamp' key from the filters object.
     * Works with nested objects and arrays at any depth.
     */
    private removeTimestampRangeFilters(obj: any): any {
        // Handle null/undefined
        if (obj === null || obj === undefined) {
            return obj;
        }

        // Handle arrays - recursively process each element and filter out nulls
        if (Array.isArray(obj)) {
            return obj
                .map(item => this.removeTimestampRangeFilters(item))
                .filter(item => item !== null && item !== undefined);
        }

        // Handle objects
        if (typeof obj === 'object') {
            // Check if this object has a 'range' key with '@timestamp' inside
            if (obj.range && typeof obj.range === 'object' && '@timestamp' in obj.range) {
                // Return null to mark this object for removal
                return null;
            }

            // Recursively process all properties
            const result: any = {};
            for (const [key, value] of Object.entries(obj)) {
                const processedValue = this.removeTimestampRangeFilters(value);

                // Only include the property if the processed value is not null/undefined
                if (processedValue !== null && processedValue !== undefined) {
                    result[key] = processedValue;
                }
            }

            return result;
        }

        // Return primitive values as-is
        return obj;
    }

    public async findMonitorEditQuery(monitorName: string): Promise<string>
    {
        const monitor = await this.client.findMonitorByName(monitorName);

        return this.dashboardPublicHost + '/app/alerting#/monitors/' + monitor.id;
    }

    public async findDashboardQuery(monitorName: string, periodStart: string, periodEnd: string): Promise<string>
    {
        const monitor = await this.client.findMonitorByName(monitorName);

        const indexPatternId = await this.client.getIndexPatternIdByIndexName(monitor.indexId);

        // Remove timestamp range filters before creating the dashboard URL
        const cleanedFilters = this.removeTimestampRangeFilters(monitor.query);

        const rison = RISON.stringify({
            "filters": [Object.assign({
                "$state": {"store": "appState"},
            },cleanedFilters)],
            "index": indexPatternId,
            "interval": "auto",
            "query": {"language": "kuery", "query": ""}
        })
        return this.dashboardPublicHost + '/app/discover#?'
        + `_g=(filters:!(),refreshInterval:(pause:!t,value:0),time:(from:${periodStart},to:${periodEnd}))`
        + `&_a=${rison}`;

    }
}