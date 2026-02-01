type RequestSample = { timestamp: number; isError: boolean };

const samples: RequestSample[] = [];
let totalRequests = 0;
let totalErrors = 0;

export const metrics = {
  record(isError: boolean) {
    const now = Date.now();
    samples.push({ timestamp: now, isError });
    totalRequests += 1;
    if (isError) totalErrors += 1;
    const cutoff = now - 60_000;
    while (samples.length && samples[0].timestamp < cutoff) {
      samples.shift();
    }
  },
  snapshot() {
    const now = Date.now();
    const cutoff = now - 60_000;
    const recent = samples.filter((sample) => sample.timestamp >= cutoff);
    const recentErrors = recent.filter((sample) => sample.isError).length;
    const rps = recent.length / 60;
    const errorRate = recent.length ? recentErrors / recent.length : 0;
    return { rps, errorRate, totalRequests, totalErrors };
  }
};
