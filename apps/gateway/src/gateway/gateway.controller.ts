import {
  Body,
  Controller,
  Post,
  Headers,
  HttpException,
  HttpCode
} from '@nestjs/common';
import { GatewayService } from './gateway.service';
import { eventSchema } from '@repo/shared';

@Controller()
export class GatewayController {
  constructor(private readonly gatewayService: GatewayService) {}

  @Post('webhook')
  @HttpCode(200)
  async handleWebhook(
    @Body() body: unknown,
    @Headers('x-correlation-id') correlationId?: string
  ) {
    if (!Array.isArray(body)) {
      throw new HttpException('Webhook body must be an array of events', 400);
    }

    const events = body;

    if (events.length > 100) {
      const indexesToCheck = [0, events.length - 1];
      for (const i of indexesToCheck) {
        const parsed = eventSchema.safeParse(events[i]);
        if (!parsed.success) {
          throw new HttpException(parsed.error.issues, 400);
        }
      }
    } else {
      for (const event of events) {
        const parsed = eventSchema.safeParse(event);
        if (!parsed.success) {
          throw new HttpException(parsed.error.issues, 400);
        }
      }
    }

    await this.gatewayService.publishEvents(events, correlationId);

    return { status: 'ok', received: events.length };
  }
}
