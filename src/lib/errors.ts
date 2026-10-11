export class AppError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
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

// 403, not 401: the client treats every 401 as an expired session and would
// swallow this in its refresh-then-sign-out path.
export class EmailNotVerifiedError extends AppError {
  constructor(message: string) {
    super(message, 403, "EMAIL_NOT_VERIFIED");
  }
}

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

export class NoSpeechError extends AppError {
  constructor(message = "We couldn't hear any speech in that recording. Record it again a little closer to the microphone.") {
    super(message, 422, "NO_SPEECH");
  }
}

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
