import * as http from 'http';
import {URL} from 'url';
import {OpendistroClient} from "./open-distro/client.ts";
import {OpendistroProcessor} from "./open-distro/processor.ts";

const hostname: string = '0.0.0.0';
const port: number = 80;

const openSearchHost = process.env.OPENSEARCH_HOST;
const dashboardPrivateHost = process.env.OPENSEARCH_DASHBOARDS_PRIVATE_HOST;
const dashboardPublicHost = process.env.OPENSEARCH_DASHBOARDS_PUBLIC_HOST;


process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

if (openSearchHost === undefined) {
    throw new Error('OPENSEARCH_HOST is not set in environment variables.');
}
if (dashboardPrivateHost === undefined) {
    throw new Error('OPENSEARCH_DASHBOARDS_PRIVATE_HOST is not set in environment variables.');
}

if (dashboardPublicHost === undefined) {
    throw new Error('OPENSEARCH_DASHBOARDS_PUBLIC_HOST is not set in environment variables.');
}

const opendistroClient = new OpendistroClient(openSearchHost, dashboardPrivateHost, process.env.OPENSEARCH_USERNAME, process.env.OPENSEARCH_PASSWORD);
const opendistroProcessor = new OpendistroProcessor(opendistroClient, dashboardPublicHost);

// TODO: check ping

const server = http.createServer(async (req: http.IncomingMessage, res: http.ServerResponse) => {

    const requestUrl = new URL(req.url, `https://${req.headers.host}`);
    const monitorId = requestUrl.searchParams.get('monitorId');
    const periodStart = requestUrl.searchParams.get('periodStart');
    const periodEnd = requestUrl.searchParams.get('periodEnd');

    // Step 3: Replace repetitive error handling with calls to sendErrorResponse
    if (!monitorId) {
        sendErrorResponse(res, 'monitorId query parameter is required.');
        return;
    }

    if (!periodStart) {
        sendErrorResponse(res, 'periodStart query parameter is required.');
        return;
    }

    if (!periodEnd) {
        sendErrorResponse(res, 'periodEnd query parameter is required.');
        return;
    }

    console.log(`Received request for monitorId: ${monitorId}, periodStart: ${periodStart}, periodEnd: ${periodEnd}`);
    try {
        let response = await opendistroProcessor.findDashboardQuery(monitorId, periodStart, periodEnd);
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        res.end(response);
    } catch (error) {
        res.end(error.message);
        return;
    }
});

server.listen(port, hostname, () => {
    console.log(`Server running at http://${hostname}:${port}/`);
});

const gracefulShutdown = (signal: string) => {
    console.log(`\n${signal} received. Starting graceful shutdown...`);

    server.close((err) => {
        if (err) {
            console.error('Error during server close:', err);
            process.exit(1);
        }
        console.log('Server closed. Exiting process.');
        process.exit(0);
    });

    setTimeout(() => {
        console.error('Forcing shutdown after timeout.');
        process.exit(1);
    }, 10000);
};



// Step 1: Define a helper function for sending error responses
function sendErrorResponse(res: http.ServerResponse, message: string): void {
    res.statusCode = 400;
    res.setHeader('Content-Type', 'text/plain');
    res.end(`Error: ${message}\n`);
}
