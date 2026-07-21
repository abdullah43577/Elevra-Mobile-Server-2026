import express from "express";
import { configureApp } from "./config";

const { PORT } = process.env;

if (!PORT) {
  console.error("❌ PORT environment variable is not set!");
  process.exit(1);
}

const app = express();

configureApp(app);

const server = app.listen(PORT, async () => {
  try {
    console.log(`✅ Server started on http://localhost:${PORT}`);

    // // Initialize email system first
    // try {
    //   await initializeEmailSystem();
    // } catch (emailError) {
    //   console.error("❌ Email system initialization error:", emailError);
    //   console.warn("⚠️  Continuing without email functionality. Server will still work for non-email endpoints.");
    // }

    // // Initialize cron jobs
    // try {
    //   await initializeCronJobs();
    // } catch (cronError) {
    //   console.error("❌ Cron jobs initialization error:", cronError);
    //   console.warn("⚠️  Continuing without cron jobs. Server is still running.");
    // }

    console.log("✅ Server initialization complete!");
  } catch (error) {
    console.error("❌ Error starting server:", error);
    console.error("Stack trace:", error instanceof Error ? error.stack : "No stack trace");
    process.exit(1);
  }
});

// Graceful shutdown
process.on("SIGTERM", async () => {
  console.log("🛑 SIGTERM received, shutting down gracefully");
  server.close(() => {
    console.log("✅ HTTP server closed");
    process.exit(0);
  });
});

process.on("SIGINT", async () => {
  console.log("🛑 SIGINT received, shutting down gracefully");
  server.close(() => {
    console.log("✅ HTTP server closed");
    process.exit(0);
  });
});
