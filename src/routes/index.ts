import type { Application, NextFunction, Request, Response } from "express";
import { handleErrors } from "../lib/handle-errors";
import { authRouter } from "./auth.routes";
import { professionRouter } from "./profession.routes";
import { noteRouter } from "./notes/note.routes";
import { tagRouter } from "./notes/tag.routes";
import { folderRouter } from "./notes/folder.routes";
import { voiceRecordingRouter } from "./voice-recording.routes";
import { resumeRouter } from "./resume.routes";
import { jobApplicationRouter } from "./job-application.routes";
import { notificationRouter } from "./notification.routes";
import { careerProfileRouter } from "./career-profile.routes";
import { coverLetterRouter } from "./cover-letter.routes";
import { interviewPrepRouter } from "./interview-prep.routes";

export const registerRoutes = (app: Application) => {
  app.use("/v1/auth", authRouter);
  app.use("/v1/professions", professionRouter);
  app.use("/v1/notes/folders", folderRouter);
  app.use("/v1/notes/tags", tagRouter);
  app.use("/v1/notes", noteRouter);
  app.use("/v1/voice-notes", voiceRecordingRouter);
  app.use("/v1/resume", resumeRouter);
  app.use("/v1/job-applications", jobApplicationRouter);
  app.use("/v1/notifications", notificationRouter);
  app.use("/v1/career-profile", careerProfileRouter);
  app.use("/v1/cover-letters", coverLetterRouter);
  app.use("/v1/interview-prep", interviewPrepRouter);

  // 404 fallback — must come before the error handler
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

  /*
    Error handler. Registered last, and Express identifies it by its four-arg
    signature — dropping `next` silently turns it into ordinary middleware that
    never runs.

    Without this, anything thrown outside a controller's try/catch fell through
    to Express's default handler, which replies with an HTML error page. The
    no-token branch of validateAccessToken does exactly that, so every expired
    session produced a 401 carrying HTML; the client reads
    `error.response.data.message`, got undefined, and showed "An unexpected
    error occurred" instead of anything useful.
  */
  app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
    handleErrors({ res, error });
  });
};
