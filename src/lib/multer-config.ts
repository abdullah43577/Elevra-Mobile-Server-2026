import type { NextFunction, Request, Response } from "express";
import multer from "multer";
import { BadRequestError } from "./errors";
import { handleErrors } from "./handle-errors";

const storage = multer.memoryStorage();

export const upload = multer({ storage });

export const MAX_PDF_BYTES = 5 * 1024 * 1024;

// The mimetype is whatever the client claims; the service also checks the
// file's own signature before parsing it.
const pdfMulter = multer({
  storage,
  limits: { fileSize: MAX_PDF_BYTES, files: 1 },
  fileFilter: (_req, file, callback) => {
    if (file.mimetype === "application/pdf") return callback(null, true);
    callback(new BadRequestError("Choose a PDF file."));
  },
});

// Multer rejects through Express's error pipeline, which skips the controller's try/catch
// and has no error middleware, so route it through handleErrors.
export const acceptPdf = function (field: string) {
  const middleware = pdfMulter.single(field);
  return function (req: Request, res: Response, next: NextFunction) {
    middleware(req, res, (error?: unknown) => (error ? handleErrors({ res, error }) : next()));
  };
};
