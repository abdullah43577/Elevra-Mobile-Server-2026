import "dotenv/config";
// import cors from "cors";
import express, { type Application } from "express";
import helmet from "helmet";
import morgan from "morgan";

export const configureApp = (app: Application) => {
  app.use(morgan("dev"));
  //   app.use(cors({ origin: ALLOWED_ORIGINS, credentials: true }));
  app.use(
    express.json({
      limit: "10mb",
      // verify: (req, _res, buf) => {
      //   (req as any).rawBody = buf.toString("utf8");
      // },
    }),
  );
  app.use(express.urlencoded({ extended: false, limit: "10mb" }));
  app.use(helmet());
};
