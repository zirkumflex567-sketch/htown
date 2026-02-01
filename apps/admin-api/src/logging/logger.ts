import fs from 'fs';
import path from 'path';
import { nanoid } from 'nanoid';
import { LogEntry } from '@htown/admin-shared';
import { env } from '../env';
import { LogStore } from './logStore';

const ensureDir = (dir: string) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
};

const logStore = new LogStore();
let currentDate = '';
let stream: fs.WriteStream | null = null;
const levelWeight: Record<LogEntry['level'], number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3
};
const minLevel = (env.logLevel as LogEntry['level']) ?? 'info';

const getLogFilePath = () => {
  const date = new Date().toISOString().slice(0, 10);
  return path.join(env.logDir, `admin-api-${date}.log`);
};

const rotateIfNeeded = () => {
  const date = new Date().toISOString().slice(0, 10);
  if (date !== currentDate || !stream) {
    currentDate = date;
    ensureDir(env.logDir);
    if (stream) stream.end();
    stream = fs.createWriteStream(getLogFilePath(), { flags: 'a' });
  }
};

export const logger = {
  store: logStore,
  log(level: LogEntry['level'], message: string, context?: Record<string, unknown>) {
    if (levelWeight[level] < levelWeight[minLevel]) {
      return {
        id: '',
        ts: new Date().toISOString(),
        level,
        message,
        context
      } as LogEntry;
    }
    const entry: LogEntry = {
      id: nanoid(),
      ts: new Date().toISOString(),
      level,
      message,
      context
    };
    rotateIfNeeded();
    const line = JSON.stringify(entry);
    stream?.write(`${line}\n`);
    if (level === 'error') {
      // eslint-disable-next-line no-console
      console.error(line);
    } else if (level === 'warn') {
      // eslint-disable-next-line no-console
      console.warn(line);
    } else {
      // eslint-disable-next-line no-console
      console.log(line);
    }
    logStore.add(entry);
    return entry;
  }
};

export const logLevels: LogEntry['level'][] = ['debug', 'info', 'warn', 'error'];

export const readLogFile = async () => {
  const filePath = getLogFilePath();
  if (!fs.existsSync(filePath)) return [] as LogEntry[];
  const content = await fs.promises.readFile(filePath, 'utf-8');
  return content
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      try {
        return JSON.parse(line) as LogEntry;
      } catch {
        return null;
      }
    })
    .filter((entry): entry is LogEntry => Boolean(entry));
};
