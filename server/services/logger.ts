import fs from 'fs';
import path from 'path';
import config from '../config';

const LOG_DIR = path.join(path.dirname(config.dbPath), '..', 'logs');
const MAX_LOG_LENGTH = 32_000;
const SECRET_PATTERNS: RegExp[] = [
  /\b(sk_(?:live|test|proj|ant)[a-zA-Z0-9_-]{12,})\b/g,
  /\b(sb_(?:secret|publishable)_[a-zA-Z0-9_-]{12,})\b/g,
  /\b(whsec_[a-zA-Z0-9]{12,})\b/g,
  /\b(eyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9._-]{10,}\.[a-zA-Z0-9._-]{10,})\b/g,
];
const KEY_VALUE_SECRET_RE = /((?:token|secret|password|api[_-]?key|authorization)\s*[:=]\s*['"]?)([^'",\s]+)/ig;
const BEARER_RE = /(Bearer\s+)([a-zA-Z0-9\-._~+/]+=*)/ig;

// Ensure log directory exists
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

function getLogFile(level: string): string {
  const date = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  return path.join(LOG_DIR, `${level}-${date}.log`);
}

function redactSecrets(input: string): string {
  let output = input;
  for (const pattern of SECRET_PATTERNS) {
    output = output.replace(pattern, '[REDACTED]');
  }

  output = output.replace(KEY_VALUE_SECRET_RE, '$1[REDACTED]');
  output = output.replace(BEARER_RE, '$1[REDACTED]');

  if (output.length > MAX_LOG_LENGTH) {
    return `${output.slice(0, MAX_LOG_LENGTH)}...[truncated]`;
  }

  return output;
}

function stringifyArg(arg: unknown): string {
  if (typeof arg === 'string') return arg;
  if (arg instanceof Error) return `${arg.message}\n${arg.stack || ''}`.trim();
  try {
    return JSON.stringify(arg);
  } catch {
    return String(arg);
  }
}

function formatMessage(level: string, ...args: unknown[]): string {
  const timestamp = new Date().toISOString();
  const message = redactSecrets(args.map(stringifyArg).join(' '));
  return `[${timestamp}] [${level.toUpperCase()}] ${message}\n`;
}

function writeToFile(level: string, formatted: string): void {
  try {
    fs.appendFileSync(getLogFile(level), formatted);
  } catch {
    // Fallback: if file write fails, don't crash the app
  }
}

const logger = {
  info(...args: unknown[]): void {
    const formatted = formatMessage('info', ...args);
    process.stdout.write(formatted);
    writeToFile('info', formatted);
  },

  warn(...args: unknown[]): void {
    const formatted = formatMessage('warn', ...args);
    process.stdout.write(formatted);
    writeToFile('warn', formatted);
    writeToFile('info', formatted);
  },

  error(...args: unknown[]): void {
    const formatted = formatMessage('error', ...args);
    process.stderr.write(formatted);
    writeToFile('error', formatted);
    writeToFile('info', formatted);
  },

  security(event: string, details?: Record<string, unknown>): void {
    const formatted = formatMessage('security', event, details || {});
    process.stdout.write(formatted);
    writeToFile('security', formatted);
    writeToFile('warn', formatted);
    writeToFile('info', formatted);
  },
};

export default logger;
export { LOG_DIR };
