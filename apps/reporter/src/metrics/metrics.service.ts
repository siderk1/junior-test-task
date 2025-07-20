import { Injectable } from '@nestjs/common';
import { Histogram, Registry, collectDefaultMetrics } from 'prom-client';

@Injectable()
export class MetricsService {
  public readonly registry = new Registry();

  public readonly reportLatency = new Histogram({
    name: 'reporter_latency_seconds',
    help: 'Reporter request latency by category (seconds)',
    labelNames: ['category'],
    buckets: [0.05, 0.1, 0.3, 0.5, 1, 2, 5, 10],
    registers: [this.registry]
  });

  constructor() {
    collectDefaultMetrics({ register: this.registry });
  }

  startReportTimer(category: string) {
    return this.reportLatency.startTimer({ category });
  }

  async getMetrics(): Promise<string> {
    return this.registry.metrics();
  }
}
