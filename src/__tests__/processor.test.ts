import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { OpendistroProcessor } from '../open-distro/processor';
import { OpendistroClient } from '../open-distro/client';

describe('OpendistroProcessor', () => {
  let client: OpendistroClient;
  let processor: OpendistroProcessor;

  beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks();
    
    // Instantiate real OpendistroClient and we will spy on its methods
    client = new OpendistroClient('http://localhost:5601', 'user', 'pass');
    processor = new OpendistroProcessor(client, 'http://localhost:5601');
  });

  it('should be defined', () => {
    expect(processor).toBeDefined();
  });

  describe('findMonitorEditQuery', () => {
    it('should return the correct monitor edit URL', async () => {
      jest.spyOn(client, 'findMonitorByTriggerId').mockResolvedValue({
        id: 'monitor-abc-123',
        indexId: 'logs-*',
        query: {},
      });

      const url = await processor.findMonitorEditQuery('trigger-999');

      expect(client.findMonitorByTriggerId).toHaveBeenCalledWith('trigger-999');
      expect(url).toBe('http://localhost:5601/app/alerting#/monitors/monitor-abc-123');
    });
  });

  describe('findDashboardQuery', () => {
    it('should generate discovery dashboard URL with cleaned timestamp filters and extracted fields', async () => {
      // Mock monitor response containing fields and a nested timestamp filter
      jest.spyOn(client, 'findMonitorByTriggerId').mockResolvedValue({
        id: 'monitor-abc-123',
        indexId: 'logs-*',
        query: {
          fields: [{ field: 'level' }, { field: 'message' }],
          bool: {
            must: [
              { term: { level: 'error' } },
              { range: { '@timestamp': { gte: 'now-24h' } } }
            ]
          }
        },
      });

      jest.spyOn(client, 'getIndexPatternIdByIndexName').mockResolvedValue('pattern-id-xyz');

      const url = await processor.findDashboardQuery('trigger-999', 'now-15m', 'now');

      expect(client.findMonitorByTriggerId).toHaveBeenCalledWith('trigger-999');
      expect(client.getIndexPatternIdByIndexName).toHaveBeenCalledWith('logs-*');

      // The returned URL should have:
      // 1. The public host
      // 2. Discover path
      // 3. Time bounds: now-15m and now
      // 4. Decoded or encoded RISON with cleaned filters (excluding @timestamp filter) and columns
      expect(url).toContain('http://localhost:5601/app/discover#?');
      expect(url).toContain("time:(from:'now-15m',to:'now')");
      
      // Let's decode the _a parameter to verify its contents
      const match = url.match(/_a=([^&]+)/);
      expect(match).not.toBeNull();
      if (match) {
        const decodedRison = decodeURIComponent(match[1]);
        
        // Ensure columns match the fields extracted
        expect(decodedRison).toContain("columns:!(level,message)");
        
        // Ensure index matches mock
        expect(decodedRison).toContain("index:pattern-id-xyz");
        
        // Ensure the level term filter is kept, but @timestamp range filter is removed
        expect(decodedRison).toContain("level:error");
        expect(decodedRison).not.toContain("@timestamp");
      }
    });

    it('should default to _source column when no fields are present', async () => {
      jest.spyOn(client, 'findMonitorByTriggerId').mockResolvedValue({
        id: 'monitor-abc-123',
        indexId: 'logs-*',
        query: {
          term: { service: 'auth' }
        },
      });

      jest.spyOn(client, 'getIndexPatternIdByIndexName').mockResolvedValue('pattern-id-xyz');

      const url = await processor.findDashboardQuery('trigger-999', 'now-15m', 'now');

      const match = url.match(/_a=([^&]+)/);
      expect(match).not.toBeNull();
      if (match) {
        const decodedRison = decodeURIComponent(match[1]);
        expect(decodedRison).toContain("columns:!(_source)");
      }
    });

    it('should support fields in simple string array format like fields: ["level", "message"]', async () => {
      jest.spyOn(client, 'findMonitorByTriggerId').mockResolvedValue({
        id: 'monitor-abc-123',
        indexId: 'logs-*',
        query: {
          fields: ['level', 'message'],
          term: { service: 'auth' }
        },
      });

      jest.spyOn(client, 'getIndexPatternIdByIndexName').mockResolvedValue('pattern-id-xyz');

      const url = await processor.findDashboardQuery('trigger-999', 'now-15m', 'now');

      const match = url.match(/_a=([^&]+)/);
      expect(match).not.toBeNull();
      if (match) {
        const decodedRison = decodeURIComponent(match[1]);
        expect(decodedRison).toContain("columns:!(level,message)");
      }
    });
  });
});
