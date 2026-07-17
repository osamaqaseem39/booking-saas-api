import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { ConsumerAuthGuard } from '../../iam/authz/consumer-auth.guard';
import { PublicRegisterTeamDto } from '../dto/public-register-team.dto';
import { TournamentsService } from '../services/tournaments.service';
import { RegistrationsService } from '../services/registrations.service';

/** No auth — shareable tournament page for anyone with the link. */
@Controller('public/share/tournaments')
export class PublicTournamentShareController {
  constructor(private readonly tournamentsService: TournamentsService) {}

  @Get(':tournamentId')
  get(@Param('tournamentId', ParseUUIDPipe) tournamentId: string) {
    return this.tournamentsService.getSharePublic(tournamentId);
  }
}

@Controller('public/tournaments')
export class PublicTournamentsController {
  constructor(
    private readonly tournamentsService: TournamentsService,
    private readonly registrationsService: RegistrationsService,
  ) {}

  /** Platform-wide catalog — no auth. */
  @Get()
  list(
    @Query('sport') sport?: string,
    @Query('status') status?: string,
    @Query('tenantId') tenantId?: string,
    @Query('page', new ParseIntPipe({ optional: true })) page?: number,
    @Query('limit', new ParseIntPipe({ optional: true })) limit?: number,
  ) {
    return this.tournamentsService.listPublic({
      sport,
      status,
      tenantId,
      page,
      limit,
    });
  }

  @Get(':tournamentId')
  get(@Param('tournamentId', ParseUUIDPipe) tournamentId: string) {
    return this.tournamentsService.getPublic(tournamentId);
  }

  /** Guest team registration — no auth; tenant resolved from tournament. */
  @Post(':tournamentId/register')
  @HttpCode(HttpStatus.CREATED)
  register(
    @Req() req: Request,
    @Param('tournamentId', ParseUUIDPipe) tournamentId: string,
    @Body() dto: PublicRegisterTeamDto,
  ) {
    const key = req.headers['idempotency-key'] as string | undefined;
    return this.registrationsService.registerPublic(
      tournamentId,
      dto,
      undefined,
      key,
    );
  }

  @Get(':tournamentId/matches')
  matches(@Param('tournamentId', ParseUUIDPipe) tournamentId: string) {
    return this.tournamentsService.getPublicMatches(tournamentId);
  }

  @Get(':tournamentId/standings')
  standings(@Param('tournamentId', ParseUUIDPipe) tournamentId: string) {
    return this.tournamentsService.getPublicStandings(tournamentId);
  }

  @Get(':tournamentId/bracket')
  bracket(@Param('tournamentId', ParseUUIDPipe) tournamentId: string) {
    return this.tournamentsService.getPublicBracket(tournamentId);
  }
}

@Controller('tournaments/me')
@UseGuards(ConsumerAuthGuard)
export class MyTournamentRegistrationsController {
  constructor(private readonly registrationsService: RegistrationsService) {}

  private userId(req: Request): string {
    const id = (req as Request & { userId?: string }).userId?.trim();
    if (!id) throw new UnauthorizedException('Missing user');
    return id;
  }

  @Get('registrations')
  myRegistrations(@Req() req: Request) {
    return this.registrationsService.listForUser(this.userId(req));
  }
}
