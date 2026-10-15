import "dotenv/config";
import cors from "cors";
import express, { type Application } from "express";
import helmet from "helmet";
import morgan from "morgan";
import { getEnv } from "./lib/get-env";

// Only the web dashboard is a browser client; the native app sends no Origin and is unaffected.
const allowedOrigins = (getEnv("CORS_ORIGINS") ?? "")
  .split(",")
  .map(origin => origin.trim())
  .filter(Boolean);

export const configureApp = (app: Application) => {
  app.use(morgan("dev"));
  app.use(cors({ origin: allowedOrigins }));
  app.use(
    express.json({
      limit: "10mb",
    }),
  );
  app.use(express.urlencoded({ extended: false, limit: "10mb" }));
  app.use(helmet());
};
