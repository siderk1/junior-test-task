import { Injectable, OnModuleDestroy } from "@nestjs/common";
import {
  connect,
  NatsConnection,
  JetStreamClient,
  JetStreamManager,
  JSONCodec,
  headers as natsHeaders,
  JetStreamPublishOptions,
  JsMsg,
  AckPolicy,
  RetentionPolicy,
  StorageType,
  DiscardPolicy,
  ConsumerOptsBuilder,
} from "nats";

@Injectable()
export class NatsService implements OnModuleDestroy {
  private _client: NatsConnection | null = null;
  private _js: JetStreamClient | null = null;
  private _jsm: JetStreamManager | null = null;
  private readonly jc = JSONCodec();
  private isShuttingDown = false;

  get client(): NatsConnection {
    if (!this._client) throw new Error("NATS not connected");
    return this._client;
  }
  get js(): JetStreamClient {
    if (!this._js) throw new Error("JetStream not initialized");
    return this._js;
  }
  get jsm(): JetStreamManager {
    if (!this._jsm) throw new Error("JetStreamManager not initialized");
    return this._jsm;
  }

  async connect(servers: string | string[], name = "default-nats-client") {
    this._client = await connect({ servers, name });
    this._js = this._client.jetstream();
    this._jsm = await this._client.jetstreamManager();

    this._client.closed().catch(() => {});
  }

  async onModuleDestroy() {
    if (this._client) {
      this.isShuttingDown = true;
      await this._client.drain();
      await this._client.close();
    }
  }

  async publish<T>(
      subject: string,
      data: T,
      correlationId?: string,
      opts?: JetStreamPublishOptions,
  ) {
    const h = natsHeaders();
    if (correlationId) h.set("x-correlation-id", correlationId);

    await this.js.publish(subject, this.jc.encode(data), {
      headers: h,
      ...opts,
    });
  }

  // Старая push-based подписка для совместимости
  async subscribe<T = any>(
      stream: string,
      subject: string,
      durable: string,
      handler: (
          data: T,
          msg: JsMsg,
          correlationId?: string,
      ) => Promise<void> | void,
  ) {
    try {
      await this.jsm.consumers.info(stream, durable);
    } catch {
      await this.jsm.consumers.add(stream, {
        durable_name: durable,
        ack_policy: AckPolicy.Explicit,
        filter_subject: subject,
      });
    }

    const jsConsumer = await this.js.consumers.get(stream, durable);
    const messages = await jsConsumer.consume();

    (async () => {
      for await (const msg of messages) {
        try {
          const data = this.jc.decode(msg.data) as T;
          const correlationId = msg.headers?.get("x-correlation-id");
          await handler(data, msg, correlationId);
        } catch (err) {
          // TODO Logging
        }
      }
    })().catch(() => {});
  }

  async pullSubscribeBatch<T = any>(
      stream: string,
      subject: string,
      durable: string,
      batchSize: number,
      handler: (
          batch: { data: T; msg: JsMsg; correlationId?: string }[]
      ) => Promise<void> | void,
      opts?: { expires?: number }
  ) {
    try {
      await this.jsm.consumers.info(stream, durable);
    } catch {
      await this.jsm.consumers.add(stream, {
        durable_name: durable,
        ack_policy: AckPolicy.Explicit,
        filter_subject: subject,
      });
    }

    const consumer = await this.js.consumers.get(stream, durable);
    const expires = opts?.expires ?? 5000;

    while (!this.isShuttingDown) {
      const messages = await consumer.fetch({ max_messages: batchSize, expires });

      const batch: { data: T; msg: JsMsg; correlationId?: string }[] = [];
      for await (const msg of messages) {
        try {
          const data = this.jc.decode(msg.data) as T;
          const correlationId = msg.headers?.get("x-correlation-id");
          batch.push({ data, msg, correlationId });
        } catch (err) {
          // TODO logging
        }
      }
      if (batch.length > 0) {
        try {
          await handler(batch);
        } catch (err) {
          // TODO logging & dont ack
        }
      }
    }
  }

  async ensureStream({
                       name,
                       subjects,
                       retention = RetentionPolicy.Limits,
                       max_msgs = 1_000_000,
                       max_bytes = 1_000_000_000,
                       storage = StorageType.File,
                       discard = DiscardPolicy.Old,
                     }: {
    name: string;
    subjects: string[];
    retention?: RetentionPolicy;
    max_msgs?: number;
    max_bytes?: number;
    storage?: StorageType;
    discard?: DiscardPolicy;
  }) {
    try {
      await this.jsm.streams.info(name);
    } catch {
      await this.jsm.streams.add({
        name,
        subjects,
        retention,
        max_msgs,
        max_bytes,
        storage,
        discard,
      });
    }
  }

  isReady(): boolean {
    return !!(this._client && this._js && this._jsm);
  }
}
