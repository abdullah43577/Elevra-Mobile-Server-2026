import type { Application, Request, Response } from "express";
import { authRouter } from "./auth.routes";
import { professionRouter } from "./profession.routes";
import { noteRouter } from "./notes/note.routes";
import { tagRouter } from "./notes/tag.routes";
import { folderRouter } from "./notes/folder.routes";

export const registerRoutes = (app: Application) => {
  app.use("/v1/auth", authRouter);
  app.use("/v1/professions", professionRouter);
  app.use("/v1/notes/", noteRouter);
  app.use("/v1/notes/tags", tagRouter);
  app.use("/v1/notes/folders", folderRouter);

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
