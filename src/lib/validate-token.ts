import { type NextFunction, type Request, type Response } from "express";
const { ACCESS_TOKEN_SECRET, REFRESH_TOKEN_SECRET } = getEnv(["ACCESS_TOKEN_SECRET", "REFRESH_TOKEN_SECRET"]);
import jwt, { type Secret } from "jsonwebtoken";
import type { CustomJwtPayload, IUserRequest } from "../interface";
import { handleErrors } from "./handle-errors";
import { getEnv } from "./get-env";
import { UnauthorizedError } from "./errors";

const validateAccessToken = function (req: IUserRequest, res: Response, next: NextFunction) {
  let token = req.headers["authorization"]?.split(" ")[1];

  // If token is not found in headers, try to find it in cookies
  if (!token && req.cookies) {
    token = req.cookies["session_id"];
  }

  if (!token) throw new UnauthorizedError("Access Denied, No token provided!");

  try {
    const { id, role } = jwt.verify(token, ACCESS_TOKEN_SECRET as Secret) as CustomJwtPayload;
    req.userId = id;
    // req.role = role;
    next();
  } catch (error) {
    handleErrors({ res, error });
  }
};

const validateRefreshToken = function (req: IUserRequest, res: Response, next: NextFunction) {
  try {
    let refreshToken = req.body.refreshToken;

    // if refreshToken is not sent in the body
    if (!refreshToken) {
      refreshToken = req.cookies["session_id_ref"];
    }

    if (!refreshToken) throw new UnauthorizedError("Access Denied, Refresh token not provided!");

    const { id, role } = jwt.verify(refreshToken, REFRESH_TOKEN_SECRET as Secret) as CustomJwtPayload;
    req.userId = id;
    // req.role = role;
    next();
  } catch (error) {
    handleErrors({ res, error });
  }
};

export { validateAccessToken, validateRefreshToken };
