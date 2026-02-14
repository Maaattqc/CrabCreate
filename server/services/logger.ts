import fs from 'fs';
import path from 'path';
import config from '../config';

const LOG_DIR = path.join(path.dirname(config.dbPath), '..', 'logs');

// Ensure log directory exists
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

function getLogFile(level: string): string {
  const date = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  return path.join(LOG_DIR, `${level}-${date}.log`);
}

function formatMessage(level: string, ...args: unknown[]): string {
  const timestamp = new Date().toISOString();
  const message = args.map(a =>
    typeof a === 'string' ? a : a instanceof Error ? `${a.message}\n${a.stack}` : JSON.stringify(a)
  ).join(' ');
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
};

export default logger;
export { LOG_DIR };
