/**
 * This is a API server
 */

import express, { type Request, type Response, type NextFunction }  from 'express';
import cors from 'cors';
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import authRoutes from './routes/auth.js';
import departmentsRoutes from './routes/departments.js';
import employeesRoutes from './routes/employees.js';
import desksRoutes from './routes/desks.js';
import statusRoutes from './routes/status.js';
import overviewRoutes from './routes/overview.js';
import serverMonitorRoutes from './routes/server-monitor.js';
import searchRoutes from './routes/search.js';

// for esm mode
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// load env
dotenv.config();


const app: express.Application = express();

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

/**
 * API Routes
 */
app.use('/api/auth', authRoutes);
app.use('/api/departments', departmentsRoutes);
app.use('/api/employees', employeesRoutes);
app.use('/api/desks', desksRoutes);
app.use('/api/status', statusRoutes);
app.use('/api/overview', overviewRoutes);
app.use('/api/server-monitor', serverMonitorRoutes);
app.use('/api/search', searchRoutes);

/**
 * Health Check
 */
app.get('/api/health', (req: Request, res: Response): void => {
  res.status(200).json({
    success: true,
    data: {
      status: 'ok',
      timestamp: new Date().toISOString(),
      version: '1.1.0-M1',
      uptime: process.uptime()
    },
    message: 'API server is healthy'
  });
});

/**
 * error handler middleware
 */
app.use((error: Error, req: Request, res: Response, next: NextFunction) => {
  res.status(500).json({
    success: false,
    error: 'Server internal error'
  });
});

/**
 * 404 handler
 */
app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: 'API not found'
  });
});

export default app;