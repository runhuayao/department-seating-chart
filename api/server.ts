/**
 * local server entry file, for local development
 */
import app from './app.js';
import { createServer } from 'http';
import ServerMonitorWebSocket from './websocket/server-monitor.js';

/**
 * start server with port
 */
const PORT = process.env.PORT || 3002;

// Create HTTP server
const server = createServer(app);

// Initialize WebSocket for server monitoring
const serverMonitorWS = new ServerMonitorWebSocket(server);

server.listen(PORT, () => {
  console.log(`Server ready on port ${PORT}`);
  console.log(`WebSocket server monitoring enabled`);
});

/**
 * close server
 */
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received');
  serverMonitorWS.close();
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT signal received');
  serverMonitorWS.close();
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

export default app;