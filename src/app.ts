import * as http from 'http';
import { URL } from 'url';

const hostname: string = '0.0.0.0';
const port: number = 80;

// Step 1: Define a helper function for sending error responses
function sendErrorResponse(res: http.ServerResponse, message: string): void {
  res.statusCode = 400;
  res.setHeader('Content-Type', 'text/plain');
  res.end(`Error: ${message}\n`);
}

const server = http.createServer((req: http.IncomingMessage, res: http.ServerResponse) => {
  console.log(req.url)
  const requestUrl = new URL(req.url, `http://${req.headers.host}`);
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

  res.statusCode = 200;
  res.setHeader('Content-Type', 'text/plain');
  res.end(`Hello, World! Monitor ID: ${monitorId}, Period Start: ${periodStart}, Period End: ${periodEnd}\n`);
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

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));