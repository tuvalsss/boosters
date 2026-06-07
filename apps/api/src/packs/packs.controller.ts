import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import type { User } from '@boosters/db';
import { CurrentUser, Public, Roles } from '../auth/auth.decorators.js';
// (Get is used by both public and admin controllers below)
import { PacksService } from './packs.service.js';
import { AddPoolItemDto, CreatePackDto, OpenPackDto, RevealDto } from './packs.dto.js';

@Controller('packs')
export class PacksController {
  constructor(private readonly packs: PacksService) {}

  @Public()
  @Get()
  list() {
    return this.packs.listActive();
  }

  @Public()
  @Get('openings/:id')
  opening(@Param('id') id: string) {
    return this.packs.getOpening(id);
  }

  @Public()
  @Get(':id')
  get(@Param('id') id: string) {
    return this.packs.getPack(id);
  }

  /** Commit phase: pay + receive the server-seed commitment. */
  @Post(':id/open')
  open(@CurrentUser() user: User, @Param('id') id: string, @Body() dto: OpenPackDto) {
    return this.packs.commit(user, id, dto.clientSeed);
  }

  /** Reveal phase: draw + settle. */
  @Post('openings/:id/reveal')
  reveal(@CurrentUser() user: User, @Param('id') id: string, @Body() dto: RevealDto) {
    return this.packs.reveal(user, id, dto.clientSeed);
  }
}

@Controller('admin/packs')
@Roles('ADMIN', 'OPS')
export class AdminPacksController {
  constructor(private readonly packs: PacksService) {}

  @Get()
  list() {
    return this.packs.listAll();
  }

  @Post()
  create(@CurrentUser() actor: User, @Body() dto: CreatePackDto) {
    return this.packs.createPack(actor, dto.name, dto.priceUsdc, dto.weights);
  }

  @Post(':id/pool')
  addPool(@CurrentUser() actor: User, @Param('id') id: string, @Body() dto: AddPoolItemDto) {
    return this.packs.addPoolItem(actor, id, dto.vaultItemId, dto.tier);
  }

  @Post(':id/status')
  setStatus(
    @CurrentUser() actor: User,
    @Param('id') id: string,
    @Query('to') to: 'ACTIVE' | 'PAUSED' | 'ARCHIVED',
  ) {
    return this.packs.setStatus(actor, id, to);
  }
}
