import type { Application, Request, Response } from "express";
import { authRouter } from "./auth.routes";

export const registerRoutes = (app: Application) => {
  app.use("/v1/auth", authRouter);

  // 404 fallback
  app.use((req: Request, res: Response) => {
    res.status(404).json({
      error: "Not Found",
      message: "The requested endpoint does not exist!",
      explorableSolutions: {
        solution1: 'ensure the "METHOD" used to call the endpoint is correct!',
        solution2: "ensure the relative paths to the server url is defined correctly",
      },
    });
  });
};
