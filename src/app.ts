import * as http from 'http';
import {URL} from 'url';
import {OpendistroClient} from "./open-distro/client.ts";
import {OpendistroProcessor} from "./open-distro/processor.ts";

const hostname: string = '0.0.0.0';
const port: number = 80;

const dashboardPrivateHost = process.env.OPENSEARCH_DASHBOARDS_PRIVATE_HOST;
const dashboardPublicHost = process.env.OPENSEARCH_DASHBOARDS_PUBLIC_HOST;


process.on('SIGTERM', () => gracefulShutdown(/*'SIGTERM'*/));
process.on('SIGINT', () => gracefulShutdown(/*'SIGINT'*/));

if (dashboardPrivateHost === undefined) {
    throw new Error('OPENSEARCH_DASHBOARDS_PRIVATE_HOST is not set in environment variables.');
}

if (dashboardPublicHost === undefined) {
    throw new Error('OPENSEARCH_DASHBOARDS_PUBLIC_HOST is not set in environment variables.');
}

const opendistroClient = new OpendistroClient(dashboardPrivateHost, process.env.OPENSEARCH_USERNAME, process.env.OPENSEARCH_PASSWORD);
const opendistroProcessor = new OpendistroProcessor(opendistroClient, dashboardPublicHost);

// TODO: check ping

const server = http.createServer(async (req: http.IncomingMessage, res: http.ServerResponse) => {

    const requestUrl = new URL(req.url, `https://${req.headers.host}`);
    const triggerId = requestUrl.searchParams.get('triggerId');
    const periodStart = requestUrl.searchParams.get('periodStart');
    const periodEnd = requestUrl.searchParams.get('periodEnd');
    const isEditMode = requestUrl.searchParams.has('edit');

    // Step 3: Replace repetitive error handling with calls to sendErrorResponse
    if (!triggerId) {
        sendErrorResponse(res, 'triggerId query parameter is required.');
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

    // console.log(`Received request for triggerId: ${triggerId}, periodStart: ${periodStart}, periodEnd: ${periodEnd}`);
    try {
        let responseUrl: string;
        if (isEditMode === false) {
            responseUrl = await opendistroProcessor.findDashboardQuery(triggerId, periodStart, periodEnd);
        } else {
            responseUrl = await  opendistroProcessor.findMonitorEditQuery(triggerId);
        }
        res.statusCode = 302;
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
        res.setHeader('Location', responseUrl);
        res.end();
    } catch (error) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'text/plain');
        res.end(error.message);
        return;
    }
});

server.listen(port, hostname, () => {
    // console.log(`Server running at http://${hostname}:${port}/`);
});

const gracefulShutdown = (/*signal: string*/) => {
    // console.log(`\n${signal} received. Starting graceful shutdown...`);

    server.close((err) => {
        if (err) {
            // console.error('Error during server close:', err);
            process.exit(1);
        }
        // console.log('Server closed. Exiting process.');
        process.exit(0);
    });

    setTimeout(() => {
        // console.error('Forcing shutdown after timeout.');
        process.exit(1);
    }, 100);
};



// Step 1: Define a helper function for sending error responses
function sendErrorResponse(res: http.ServerResponse, message: string): void {
    res.statusCode = 400;
    res.setHeader('Content-Type', 'text/plain');
    res.end(`Error: ${message}\n`);
}
