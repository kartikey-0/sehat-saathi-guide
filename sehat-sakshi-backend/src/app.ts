import express from "express";
import cors from "cors";
import logger from "./config/logger";
import { conditionalRequestLogger } from "./middleware/requestLogger";
import { performanceMonitor } from "./middleware/performanceMonitor";
import authRoutes from "./routes/auth";
import medicalHistoryRoutes from "./routes/medicalHistory";
import symptomsRoutes from "./routes/symptoms";
import remindersRoutes from "./routes/reminders";
import ordersRoutes from "./routes/orders";
import metricsRoutes from "./routes/metrics";

const app = express();

// CORS configuration
app.use(
  cors({
    origin: ["http://localhost:5173", "http://localhost:5000", "http://localhost:8080"],
    credentials: true
  })
);

// Body parser
app.use(express.json());

// Logging middleware (must be before routes)
app.use(conditionalRequestLogger);
app.use(performanceMonitor);

// Health check (simple, no logging)
app.get("/health", (_req, res) => {
  res.status(200).json({
    status: "OK",
    message: "Sehat Saathi backend running",
    timestamp: new Date().toISOString()
  });
});

// API Routes
app.use("/api/auth", authRoutes);
app.use("/api/medical-history", medicalHistoryRoutes);
app.use("/api/symptoms", symptomsRoutes);
app.use("/api/reminders", remindersRoutes);
app.use("/api/orders", ordersRoutes);
app.use("/api/metrics", metricsRoutes);

// 404 handler
app.use((req, res) => {
  logger.warn(`404 - Route not found: ${req.method} ${req.originalUrl}`, {
    requestId: req.id,
    method: req.method,
    url: req.originalUrl,
  });

  res.status(404).json({
    success: false,
    error: "Route not found",
    path: req.originalUrl,
  });
});

// Global error handler
app.use((err: any, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error(`Unhandled error: ${err.message}`, {
    requestId: req.id,
    error: err.message,
    stack: err.stack,
    url: req.originalUrl,
    method: req.method,
  });

  res.status(err.statusCode || 500).json({
    success: false,
    error: process.env.NODE_ENV === 'production'
      ? 'Internal server error'
      : err.message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
});

export default app;
