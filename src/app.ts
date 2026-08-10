import * as http from 'http';
import { URL } from 'url';
import { OpendistroClient } from "./open-distro/client.ts";
import { OpendistroProcessor } from "./open-distro/processor.ts";
import { RedirectController } from "./controllers/redirect.controller.ts";
import { HookController } from "./controllers/hook.controller.ts";

const hostname: string = '0.0.0.0';
const port: number = 80;

const dashboardPrivateHost = process.env.OPENSEARCH_DASHBOARDS_PRIVATE_HOST;
const dashboardPublicHost = process.env.OPENSEARCH_DASHBOARDS_PUBLIC_HOST;

process.on('SIGTERM', () => gracefulShutdown());
process.on('SIGINT', () => gracefulShutdown());

if (dashboardPrivateHost === undefined) {
    throw new Error('OPENSEARCH_DASHBOARDS_PRIVATE_HOST is not set in environment variables.');
}

if (dashboardPublicHost === undefined) {
    throw new Error('OPENSEARCH_DASHBOARDS_PUBLIC_HOST is not set in environment variables.');
}

const opendistroClient = new OpendistroClient(dashboardPrivateHost, process.env.OPENSEARCH_USERNAME, process.env.OPENSEARCH_PASSWORD);
const opendistroProcessor = new OpendistroProcessor(opendistroClient, dashboardPublicHost);
const redirectController = new RedirectController(opendistroProcessor);

const hookController = new HookController();

// TODO: check ping

const server = http.createServer(async (req: http.IncomingMessage, res: http.ServerResponse) => {
    const requestUrl = new URL(req.url || '/', `https://${req.headers.host || 'localhost'}`);

    if (req.method === 'GET' && requestUrl.pathname === '/') {
        await redirectController.handle(req, res, requestUrl);
    } else if (req.method === 'POST' && requestUrl.pathname === '/proxy-hook') {
        await hookController.handle(req, res);
    } else {
        res.statusCode = 404;
        res.setHeader('Content-Type', 'text/plain');
        res.end('Not Found\n');
    }
});

server.listen(port, hostname, () => {
    // console.log(`Server running at http://${hostname}:${port}/`);
});

const gracefulShutdown = () => {
    // console.log('Graceful shutdown initiated.');
    server.close((err) => {
        if (err) {
            process.exit(1);
        }
        process.exit(0);
    });

    setTimeout(() => {
        process.exit(1);
    }, 100);
};
