import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import * as http from 'http';
import { URL } from 'url';
import { RedirectController } from '../controllers/redirect.controller.ts';
import { OpendistroProcessor } from '../open-distro/processor.ts';

describe('RedirectController', () => {
  let processor: jest.Mocked<OpendistroProcessor>;
  let controller: RedirectController;
  let mockRes: Partial<http.ServerResponse>;
  let responseData: string;

  beforeEach(() => {
    jest.clearAllMocks();
    responseData = '';

    // Mock OpendistroProcessor
    processor = {
      findDashboardQuery: jest.fn<any>(),
      findMonitorEditQuery: jest.fn<any>(),
    } as unknown as jest.Mocked<OpendistroProcessor>;

    controller = new RedirectController(processor);

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

  it('should return 400 if triggerId is missing', async () => {
    const mockReq = {} as http.IncomingMessage;
    const url = new URL('http://localhost/?periodStart=now-15m&periodEnd=now');

    await controller.handle(mockReq, mockRes as http.ServerResponse, url);

    expect(mockRes.statusCode).toBe(400);
    expect(responseData).toContain('triggerId query parameter is required');
  });

  it('should return 400 if periodStart is missing', async () => {
    const mockReq = {} as http.IncomingMessage;
    const url = new URL('http://localhost/?triggerId=123&periodEnd=now');

    await controller.handle(mockReq, mockRes as http.ServerResponse, url);

    expect(mockRes.statusCode).toBe(400);
    expect(responseData).toContain('periodStart query parameter is required');
  });

  it('should return 400 if periodEnd is missing', async () => {
    const mockReq = {} as http.IncomingMessage;
    const url = new URL('http://localhost/?triggerId=123&periodStart=now-15m');

    await controller.handle(mockReq, mockRes as http.ServerResponse, url);

    expect(mockRes.statusCode).toBe(400);
    expect(responseData).toContain('periodEnd query parameter is required');
  });

  it('should call findDashboardQuery and render redirect HTML if not in edit mode', async () => {
    const mockReq = {} as http.IncomingMessage;
    const url = new URL('http://localhost/?triggerId=123&periodStart=now-15m&periodEnd=now');
    processor.findDashboardQuery.mockResolvedValue('http://opensearch/dashboard');

    await controller.handle(mockReq, mockRes as http.ServerResponse, url);

    expect(processor.findDashboardQuery).toHaveBeenCalledWith('123', 'now-15m', 'now');
    expect(mockRes.statusCode).toBe(200);
    expect(mockRes.setHeader).toHaveBeenCalledWith('Content-Type', 'text/html');
    expect(responseData).toContain('http://opensearch/dashboard');
  });

  it('should call findMonitorEditQuery and render redirect HTML if in edit mode', async () => {
    const mockReq = {} as http.IncomingMessage;
    const url = new URL('http://localhost/?triggerId=123&periodStart=now-15m&periodEnd=now&edit=true');
    processor.findMonitorEditQuery.mockResolvedValue('http://opensearch/edit');

    await controller.handle(mockReq, mockRes as http.ServerResponse, url);

    expect(processor.findMonitorEditQuery).toHaveBeenCalledWith('123');
    expect(mockRes.statusCode).toBe(200);
    expect(responseData).toContain('http://opensearch/edit');
  });

  it('should return 500 if processor throws an error', async () => {
    const mockReq = {} as http.IncomingMessage;
    const url = new URL('http://localhost/?triggerId=123&periodStart=now-15m&periodEnd=now');
    processor.findDashboardQuery.mockRejectedValue(new Error('Kibana down'));

    await controller.handle(mockReq, mockRes as http.ServerResponse, url);

    expect(mockRes.statusCode).toBe(500);
    expect(responseData).toBe('Kibana down');
  });
});
