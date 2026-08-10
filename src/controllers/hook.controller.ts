import * as http from 'http';

export class HookController {
    public async handle(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
        // 1. Verify Proxy-Hook-To header exists and is a string
        const targetUrl = req.headers['proxy-hook-to'];
        if (!targetUrl || typeof targetUrl !== 'string') {
            res.statusCode = 400;
            res.setHeader('Content-Type', 'text/plain');
            res.end('Error: Proxy-Hook-To header is required and must be a string.\n');
            return;
        }

        // 2. Parse request JSON body
        let body: any;
        try {
            const buffers: Buffer[] = [];
            for await (const chunk of req) {
                buffers.push(chunk);
            }
            const bodyText = Buffer.concat(buffers).toString('utf-8');
            body = JSON.parse(bodyText);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            res.statusCode = 400;
            res.setHeader('Content-Type', 'text/plain');
            res.end(`Error: Invalid JSON body. ${errorMessage}\n`);
            return;
        }

        // 3. Extract monitor name and build blockquote field lines in a single pass
        const monitorName = body.monitor?.name || '';
        let fieldsText = '';
        if (Array.isArray(body.results)) {
            for (const result of body.results) {
                if (result?.hits?.hits && Array.isArray(result.hits.hits)) {
                    for (const hit of result.hits.hits) {
                        if (!hit.fields || typeof hit.fields !== 'object' || Object.keys(hit.fields).length === 0) {
                            continue;
                        }

                        let hitHasFields = false;
                        for (const [key, valueArray] of Object.entries(hit.fields)) {
                            if (Array.isArray(valueArray) && valueArray.length > 0) {
                                const rawVal = valueArray[0];
                                const cleanVal = String(rawVal).replace(/\r?\n|\r/g, '.').replace(/`/g, '');
                                const cleanKey = key.replace(/@/g, '');
                                fieldsText += `> *${cleanKey}*: \`${cleanVal}\`\n`;
                                hitHasFields = true;
                            }
                        }

                        if (!hitHasFields) {
                            continue;
                        }

                        fieldsText += '\n';
                    }
                }
            }
        }

        // 5. Construct final message
        const proto = (req.headers['x-forwarded-proto'] as string) || 'http';
        const host = req.headers.host || 'localhost';
        const baseUrl = `${proto}://${host}`;

        const payloadTriggerId = body.trigger?.id || '{{ctx.trigger.id}}';
        const payloadPeriodStart = body.periodStart || '{{ctx.periodStart}}';
        const payloadPeriodEnd = body.periodEnd || '{{ctx.periodEnd}}';

        const logsUrl = `${baseUrl}/?triggerId=${payloadTriggerId}&periodStart=${payloadPeriodStart}&periodEnd=${payloadPeriodEnd}`;
        const editUrl = `${logsUrl}&edit=1`;

        const message = `#### ${monitorName}\n\n${fieldsText}[Logs](${logsUrl}) [✏️](${editUrl})`;

        // 6. Send POST request to targetUrl with Content-Type "text/html"
        try {
            const response = await fetch(targetUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'text/html',
                },
                body: message,
                signal: AbortSignal.timeout(5000), // 5 seconds timeout
            });

            if (!response.ok) {
                const errorText = await response.text();
                res.statusCode = 502;
                res.setHeader('Content-Type', 'text/plain');
                res.end(`Error: Failed to deliver hook. Target responded with status ${response.status}: ${errorText}\n`);
                return;
            }

            res.statusCode = 200;
            res.setHeader('Content-Type', 'text/plain');
            res.end('OK\n');
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            res.statusCode = 500;
            res.setHeader('Content-Type', 'text/plain');
            res.end(`Error: Failed to deliver hook. ${errorMessage}\n`);
        }
    }
}
