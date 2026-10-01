import { logger } from "./lib/support/logger";

interface ErrorData {
  code?: string;
  issues?: unknown;
}

const defaultCode = (status: number) =>
  status >= 500
    ? "INTERNAL_ERROR"
    : status === 404
      ? "NOT_FOUND"
      : status === 401
        ? "UNAUTHORIZED"
        : status === 403
          ? "FORBIDDEN"
          : "BAD_REQUEST";

export default defineNitroErrorHandler((error, event) => {
  const status = error.statusCode ?? 500;
  const data = (error.data ?? {}) as ErrorData;

  if (status >= 500) logger.error("unhandled error", { path: event.path, err: error.cause ?? error });

  setResponseStatus(event, status);
  setResponseHeader(event, "content-type", "application/json");

  return send(
    event,
    JSON.stringify({
      code: data.code ?? defaultCode(status),
      message: status >= 500 ? "Internal error" : error.message,
      ...(data.issues ? { issues: data.issues } : {}),
    }),
  );
});
