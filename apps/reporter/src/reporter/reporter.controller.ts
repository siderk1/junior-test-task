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
  async getEvents(
    @Query(new ZodValidationPipe(EventsReportQuerySchema))
    query: EventsReportQuery
  ) {
    return this.reporterService.getEventsReport(query);
  }

  @Get('revenue')
  async getRevenue(
    @Query(new ZodValidationPipe(RevenueReportQuerySchema))
    query: RevenueReportQuery
  ) {
    return this.reporterService.getRevenueReport(query);
  }

  @Get('demographics')
  async getDemographics(
    @Query(new ZodValidationPipe(DemographicsReportQuerySchema))
    query: DemographicsReportQuery
  ) {
    return this.reporterService.getDemographicsReport(query);
  }
}
