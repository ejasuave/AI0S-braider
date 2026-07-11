export function isDatabaseUnavailableError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;

  const message = error.message.toLowerCase();
  return (
    error.name === 'PrismaClientInitializationError' ||
    error.name === 'PrismaClientKnownRequestError' ||
    message.includes("can't reach database server") ||
    message.includes('connection refused') ||
    message.includes('econnrefused') ||
    message.includes('database server')
  );
}
