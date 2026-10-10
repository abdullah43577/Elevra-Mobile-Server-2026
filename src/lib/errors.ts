export class AppError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    /*
      Optional stable identifier for the one case where the client must *act*
      on an error rather than display it. Matching on the message text instead
      would break the moment anyone rewords a string.
    */
    public readonly code?: string,
  ) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Resource not found") {
    super(message, 404);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "Access denied") {
    super(message, 403);
  }
}

export class BadRequestError extends AppError {
  constructor(message = "Bad request") {
    super(message, 400);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Unauthorized") {
    super(message, 401);
  }
}

export class ConflictError extends AppError {
  constructor(message = "Conflict") {
    super(message, 409);
  }
}

export class PaymentRequiredError extends AppError {
  constructor(message = "This feature requires an Elevra Pro subscription") {
    super(message, 402);
  }
}

/*
  The account exists and the password was correct, but the address has never
  been verified. 403 rather than 401 deliberately: the client's axios
  interceptor treats every 401 as an expired session and drives it into the
  refresh-then-sign-out path, which would swallow this entirely.
*/
export class EmailNotVerifiedError extends AppError {
  constructor(message: string) {
    super(message, 403, "EMAIL_NOT_VERIFIED");
  }
}

// Every provider in the chain failed. A normal, temporary state the client
// presents as "try again shortly" rather than as an error.
export class AiUnavailableError extends AppError {
  constructor(message = "AI is busy right now. Please try again in a moment.") {
    super(message, 503, "AI_UNAVAILABLE");
  }
}

export class AiQuotaExceededError extends AppError {
  constructor(message = "You've reached today's AI limit. It resets tomorrow.") {
    super(message, 429, "AI_QUOTA_EXCEEDED");
  }
}

// The PDF has no text layer — almost always a scan or a photo. 422: the file
// arrived fine, there is just nothing in it to read.
export class PdfNoTextError extends AppError {
  constructor(message = "This PDF looks like a scan, so there's no text to read. Fill your profile in by hand instead.") {
    super(message, 422, "PDF_NO_TEXT");
  }
}

export class PdfUnreadableError extends AppError {
  constructor(message = "That file couldn't be opened as a PDF. Try exporting your resume to PDF again.") {
    super(message, 422, "PDF_UNREADABLE");
  }
}
