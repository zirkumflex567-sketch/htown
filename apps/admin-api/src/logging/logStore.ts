import { LogEntry } from '@htown/admin-shared';

export type LogFilter = {
  level?: string;
  q?: string;
};

export type LogListener = {
  id: string;
  filter: LogFilter;
  send: (entry: LogEntry) => void;
  close: () => void;
};

export class LogStore {
  private buffer: LogEntry[] = [];
  private listeners = new Map<string, LogListener>();
  private maxSize = 2000;

  add(entry: LogEntry) {
    this.buffer.push(entry);
    if (this.buffer.length > this.maxSize) {
      this.buffer.shift();
    }
    for (const listener of this.listeners.values()) {
      if (this.matches(entry, listener.filter)) {
        listener.send(entry);
      }
    }
  }

  list(filter?: LogFilter) {
    if (!filter || (!filter.level && !filter.q)) return [...this.buffer];
    return this.buffer.filter((entry) => this.matches(entry, filter));
  }

  subscribe(listener: LogListener) {
    this.listeners.set(listener.id, listener);
  }

  unsubscribe(id: string) {
    const listener = this.listeners.get(id);
    if (listener) {
      listener.close();
      this.listeners.delete(id);
    }
  }

  private matches(entry: LogEntry, filter: LogFilter) {
    if (filter.level && entry.level !== filter.level) return false;
    if (filter.q) {
      const haystack = `${entry.message} ${JSON.stringify(entry.context ?? {})}`.toLowerCase();
      if (!haystack.includes(filter.q.toLowerCase())) return false;
    }
    return true;
  }
}
