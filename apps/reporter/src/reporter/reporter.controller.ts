import { Controller, Get, Query, UsePipes } from '@nestjs/common';
import { ReporterService } from './reporter.service';
import {
  EventsReportQuerySchema,
  RevenueReportQuerySchema,
  DemographicsReportQuerySchema,
  EventsReportQuery,
  RevenueReportQuery,
  DemographicsReportQuery
} from './schemas';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';

@Controller('reports')
export class ReporterController {
  constructor(private readonly reporterService: ReporterService) {}

  @Get('events')
  @UsePipes(new ZodValidationPipe(EventsReportQuerySchema))
  async getEvents(@Query() query: EventsReportQuery) {
    return this.reporterService.getEventsReport(query);
  }

  @Get('revenue')
  @UsePipes(new ZodValidationPipe(RevenueReportQuerySchema))
  async getRevenue(@Query() query: RevenueReportQuery) {
    return this.reporterService.getRevenueReport(query);
  }

  @Get('demographics')
  @UsePipes(new ZodValidationPipe(DemographicsReportQuerySchema))
  async getDemographics(@Query() query: DemographicsReportQuery) {
    return this.reporterService.getDemographicsReport(query);
  }
}
