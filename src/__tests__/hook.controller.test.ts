import {afterEach, beforeEach, describe, expect, it, jest} from '@jest/globals';
import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';
import {HookController} from '../controllers/hook.controller.ts';

describe('HookController', () => {
  let controller: HookController;
  let mockRes: Partial<http.ServerResponse>;
  let responseData: string;

  beforeEach(() => {
    jest.clearAllMocks();
    responseData = '';
    controller = new HookController();

    // Mock http.ServerResponse
    mockRes = {
      statusCode: 200,
      setHeader: jest.fn<any>(),
      end: jest.fn<any>().mockImplementation((data: any) => {
        responseData = data;
        return mockRes;
      }),
    } as unknown as Partial<http.ServerResponse>;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // Helper to create a readable stream for request body
  function createMockRequest(headers: Record<string, string>, bodyString: string): http.IncomingMessage {
    return {
      headers,
      [Symbol.asyncIterator]: async function* () {
        yield Buffer.from(bodyString);
      }
    } as unknown as http.IncomingMessage;
  }

  it('should return 400 if Proxy-Hook-To header is missing', async () => {
    const req = createMockRequest({}, '{}');

    await controller.handle(req, mockRes as http.ServerResponse);

    expect(mockRes.statusCode).toBe(400);
    expect(responseData).toContain('Proxy-Hook-To header is required');
  });

  it('should return 400 if JSON body is invalid', async () => {
    const req = createMockRequest({ 'proxy-hook-to': 'http://target-hook' }, 'not-json');

    await controller.handle(req, mockRes as http.ServerResponse);

    expect(mockRes.statusCode).toBe(400);
    expect(responseData).toContain('Invalid JSON body');
  });

  it('should format message, replace newlines in values with dot, send POST to target, and return 200', async () => {
    const payload = {
      monitor: {
        name: 'Prices Alert'
      },
      results: [
        {
          hits: {
            hits: [
              {
                fields: {
                  'error.message': [
                    'Database connection lost\nTimeout of 5000ms exceeded\nPlease try again'
                  ],
                  'status': [
                    'cri`ti`cal'
                  ]
                }
              }
            ]
          }
        }
      ]
    };

    const req = createMockRequest(
      {
        'proxy-hook-to': 'http://my-target-endpoint',
        'host': 'proxy.local',
        'x-forwarded-proto': 'https'
      },
      JSON.stringify(payload)
    );

    // Mock the global fetch
    const mockFetch = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      text: async () => 'Success'
    } as Response);

    await controller.handle(req, mockRes as http.ServerResponse);

    expect(mockRes.statusCode).toBe(200);
    expect(responseData).toBe("OK\n");

    // Check fetch args
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, options] = mockFetch.mock.calls[0];
    
    expect(url).toBe('http://my-target-endpoint');
    expect(options?.method).toBe('POST');
    expect((options?.headers as any)['Content-Type']).toBe('text/html');

    const sentBody = options?.body as string;
    
    // Check monitor name
    expect(sentBody).toContain('#### Prices Alert');
    
    // Check fields list blockquote
    expect(sentBody).toContain('> *error.message*: `Database connection lost.Timeout of 5000ms exceeded.Please try again`');
    expect(sentBody).toContain('> *status*: `critical`');

    // Check links match single slash format
    expect(sentBody).toContain('[Logs](https://proxy.local/?triggerId={{ctx.trigger.id}}&periodStart={{ctx.periodStart}}&periodEnd={{ctx.periodEnd}})');
    expect(sentBody).toContain('[✏️](https://proxy.local/?triggerId={{ctx.trigger.id}}&periodStart={{ctx.periodStart}}&periodEnd={{ctx.periodEnd}}&edit=1)');
  });

  it('should return 502 if target endpoint responds with an error', async () => {
    const payload = { monitor: { name: 'Alert' }, results: [] };
    const req = createMockRequest({ 'proxy-hook-to': 'http://target-hook' }, JSON.stringify(payload));

    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: false,
      status: 403,
      text: async () => 'Forbidden'
    } as Response);

    await controller.handle(req, mockRes as http.ServerResponse);

    expect(mockRes.statusCode).toBe(502);
    expect(responseData).toContain('Target responded with status 403: Forbidden');
  });

  it('should return 500 if global fetch throws an exception', async () => {
    const payload = { monitor: { name: 'Alert' }, results: [] };
    const req = createMockRequest({ 'proxy-hook-to': 'http://target-hook' }, JSON.stringify(payload));

    jest.spyOn(global, 'fetch').mockRejectedValue(new Error('Network error'));

    await controller.handle(req, mockRes as http.ServerResponse);

    expect(mockRes.statusCode).toBe(500);
    expect(responseData).toContain('Failed to deliver hook. Network error');
  });

  it('should return 500 if global fetch times out (Aborted)', async () => {
    const payload = { monitor: { name: 'Alert' }, results: [] };
    const req = createMockRequest({ 'proxy-hook-to': 'http://target-hook' }, JSON.stringify(payload));

    const timeoutError = new Error('The operation was aborted.');
    timeoutError.name = 'TimeoutError';
    jest.spyOn(global, 'fetch').mockRejectedValue(timeoutError);

    await controller.handle(req, mockRes as http.ServerResponse);

    expect(mockRes.statusCode).toBe(500);
    expect(responseData).toContain('Failed to deliver hook. The operation was aborted.');
  });

  it('should skip the hit if fields is missing or empty in a hit', async () => {
    const payload = {
      monitor: { name: 'Prices Alert' },
      results: [
        {
          hits: {
            hits: [
              {
                _id: '123'
                // fields is completely missing here
              },
              {
                fields: {
                  status: ['critical']
                }
              }
            ]
          }
        }
      ]
    };
    const req = createMockRequest({ 'proxy-hook-to': 'http://target-hook' }, JSON.stringify(payload));
    const mockFetch = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      text: async () => 'Success'
    } as Response);

    await controller.handle(req, mockRes as http.ServerResponse);

    expect(mockRes.statusCode).toBe(200);
    expect(responseData).toBe("OK\n");

    const sentBody = mockFetch.mock.calls[0][1]?.body as string;
    expect(sentBody).toContain('> *status*: `critical`');
  });

  it('should skip the hit if fields has no valid populated array values in a hit', async () => {
    const payload = {
      monitor: { name: 'Prices Alert' },
      results: [
        {
          hits: {
            hits: [
              {
                fields: {
                  'error.message': [] // array is empty
                }
              },
              {
                fields: {
                  status: ['critical']
                }
              }
            ]
          }
        }
      ]
    };
    const req = createMockRequest({ 'proxy-hook-to': 'http://target-hook' }, JSON.stringify(payload));
    const mockFetch = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      text: async () => 'Success'
    } as Response);

    await controller.handle(req, mockRes as http.ServerResponse);

    expect(mockRes.statusCode).toBe(200);
    expect(responseData).toBe("OK\n");

    const sentBody = mockFetch.mock.calls[0][1]?.body as string;
    expect(sentBody).toContain('> *status*: `critical`');
    expect(sentBody).not.toContain('error.message');
  });

  it('should successfully process real-world payload from example-hook-request.json', async () => {
    // Read the example-hook-request.json file from its new test directory
    const filePath = path.join(process.cwd(), 'src/__tests__/example-hook-request.json');
    const jsonString = fs.readFileSync(filePath, 'utf-8');

    const req = createMockRequest(
      {
        'proxy-hook-to': 'http://my-target-endpoint',
        'host': 'proxy.local',
        'x-forwarded-proto': 'https'
      },
      jsonString
    );

    // Mock global fetch
    const mockFetch = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      text: async () => 'Success'
    } as Response);

    await controller.handle(req, mockRes as http.ServerResponse);

    expect(mockRes.statusCode).toBe(200);
    expect(responseData).toBe("OK\n");

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, options] = mockFetch.mock.calls[0];
    
    expect(url).toBe('http://my-target-endpoint');
    const sentBody = options?.body as string;

    // Check monitor name from the example-hook-request.json
    expect(sentBody).toContain('#### SiteBack. prices-backend - errors > 1');

    // Check some fields from the example JSON
    expect(sentBody).toContain('> *timestamp*: `2026-08-08T09:01:08.313Z`');
    expect(sentBody).toContain('> *log_processed.message*: `No inhouse payment methods`');

    // Check single newline formatting after hits
    expect(sentBody).toContain('> *log_processed.message*: `No inhouse payment methods`\n');

    // Check Logs and Edit link format
    expect(sentBody).toContain('[Logs](https://proxy.local/?triggerId=Yc6gYYkBiQQ6WAHtJfmE&periodStart=2026-08-08T04:02:51.562Z&periodEnd=2026-08-08T09:02:51.562Z)');
    expect(sentBody).toContain('[✏️](https://proxy.local/?triggerId=Yc6gYYkBiQQ6WAHtJfmE&periodStart=2026-08-08T04:02:51.562Z&periodEnd=2026-08-08T09:02:51.562Z&edit=1)');
  });
});
