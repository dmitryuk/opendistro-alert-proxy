import * as http from 'http';
import { URL } from 'url';
import { OpendistroProcessor } from '../open-distro/processor.ts';

export class RedirectController {
    private processor: OpendistroProcessor;

    constructor(processor: OpendistroProcessor) {
        this.processor = processor;
    }

    public async handle(req: http.IncomingMessage, res: http.ServerResponse, requestUrl: URL): Promise<void> {
        const triggerId = requestUrl.searchParams.get('triggerId');
        const periodStart = requestUrl.searchParams.get('periodStart');
        const periodEnd = requestUrl.searchParams.get('periodEnd');
        const isEditMode = requestUrl.searchParams.has('edit');

        if (!triggerId) {
            this.sendErrorResponse(res, 'triggerId query parameter is required.');
            return;
        }

        if (!periodStart) {
            this.sendErrorResponse(res, 'periodStart query parameter is required.');
            return;
        }

        if (!periodEnd) {
            this.sendErrorResponse(res, 'periodEnd query parameter is required.');
            return;
        }

        try {
            let responseUrl: string;
            if (isEditMode === false) {
                responseUrl = await this.processor.findDashboardQuery(triggerId, periodStart, periodEnd);
            } else {
                responseUrl = await this.processor.findMonitorEditQuery(triggerId);
            }
            res.statusCode = 200;
            res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
            res.setHeader('Pragma', 'no-cache');
            res.setHeader('Expires', '0');
            res.setHeader('Content-Type', 'text/html');
            res.end(`<!DOCTYPE html><html lang="en"><head><meta http-equiv="refresh" content="0; url=${responseUrl}"></head><body><script>window.location.replace("${responseUrl}");</script></body></html>`);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            res.statusCode = 500;
            res.setHeader('Content-Type', 'text/plain');
            res.end(errorMessage);
        }
    }

    private sendErrorResponse(res: http.ServerResponse, message: string): void {
        res.statusCode = 400;
        res.setHeader('Content-Type', 'text/plain');
        res.end(`Error: ${message}\n`);
    }
}
