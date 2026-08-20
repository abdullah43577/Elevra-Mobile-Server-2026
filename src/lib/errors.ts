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
