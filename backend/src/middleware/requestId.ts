import { randomUUID } from "node:crypto";
import type { RequestHandler } from "express";

// Accept a caller-supplied id only when it is short and boring (prevents log injection).
const SAFE_REQUEST_ID = /^[A-Za-z0-9._-]{8,128}$/;

export const requestId: RequestHandler = (req, res, next) => {
  const incoming = req.header("x-request-id");
  const id = incoming && SAFE_REQUEST_ID.test(incoming) ? incoming : randomUUID();
  req.id = id;
  res.setHeader("X-Request-Id", id);
  next();
};
