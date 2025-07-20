import { Injectable } from '@nestjs/common';
import { Counter, Registry, collectDefaultMetrics, Gauge } from 'prom-client';

@Injectable()
export class MetricsService {
  public readonly registry = new Registry();

  public readonly acceptedEvents = new Counter({
    name: 'ttk_collector_events_accepted_total',
    help: 'Total events accepted by the Tiktok collector',
    registers: [this.registry]
  });

  public readonly processedEvents = new Counter({
    name: 'ttk_collector_events_processed_total',
    help: 'Total events successfully processed by the Tiktok collector',
    registers: [this.registry]
  });

  public readonly failedEvents = new Counter({
    name: 'ttk_collector_events_failed_total',
    help: 'Total events failed in the Tiktok collector',
    registers: [this.registry]
  });

  constructor() {
    collectDefaultMetrics({ register: this.registry });
  }

  incAccepted(count = 1) {
    this.acceptedEvents.inc(count);
  }

  incProcessed(count = 1) {
    this.processedEvents.inc(count);
  }

  incFailed(count = 1) {
    this.failedEvents.inc(count);
  }

  async getMetrics(): Promise<string> {
    return this.registry.metrics();
  }
}
