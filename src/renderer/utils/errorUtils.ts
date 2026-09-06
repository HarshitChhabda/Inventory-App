/**
 * Safely extract a user-friendly error message from any error type.
 * Never leaks Prisma codes, DB paths, or internal stack traces.
 */
export function getErrorMessage(err: any, fallback = 'An unexpected error occurred'): string {
  if (!err) return fallback;
  const msg = typeof err === 'string' ? err : err?.message || '';
  if (!msg) return fallback;
  // Prisma error codes
  if (/^P\d{4}/.test(msg)) return 'A database error occurred. Please try again.';
  if (msg.includes('PrismaClient')) return 'A database error occurred. Please try again.';
  // Common internal patterns to sanitize
  if (msg.includes('ECONNREFUSED')) return 'Connection failed. Please check if the server is running.';
  if (msg.includes('ENOENT')) return 'File not found. Please check the file path.';
  if (msg.includes('EBUSY')) return 'File is in use. Please close it and try again.';
  if (msg.includes('EPERM') || msg.includes('EACCES')) return 'Permission denied. Please check file permissions.';
  // If it looks like a user-facing message, pass it through
  if (msg.length < 200 && !msg.includes(' at ') && !msg.includes('\\n')) return msg;
  return fallback;
}
