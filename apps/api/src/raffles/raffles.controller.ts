import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { IsInt, IsString, Matches, Min } from 'class-validator';
import type { User } from '@boosters/db';
import { CurrentUser, Public, Roles } from '../auth/auth.decorators.js';
import { RafflesService } from './raffles.service.js';

const MONEY = /^\d+(\.\d{1,6})?$/;

class CreateRaffleDto {
  @IsString()
  vaultItemId!: string;
  @IsInt()
  @Min(2)
  ticketSupply!: number;
  @Matches(MONEY)
  ticketPriceUsdc!: string;
}
class BuyTicketsDto {
  @IsInt()
  @Min(1)
  quantity!: number;
}

@Controller('raffles')
export class RafflesController {
  constructor(private readonly raffles: RafflesService) {}

  @Public()
  @Get()
  list() {
    return this.raffles.listActive();
  }

  @Public()
  @Get(':id')
  get(@Param('id') id: string) {
    return this.raffles.get(id);
  }

  @Post()
  create(@CurrentUser() user: User, @Body() dto: CreateRaffleDto) {
    return this.raffles.create(user, dto.vaultItemId, dto.ticketSupply, dto.ticketPriceUsdc);
  }

  @Post(':id/tickets')
  buy(@CurrentUser() user: User, @Param('id') id: string, @Body() dto: BuyTicketsDto) {
    return this.raffles.buyTickets(user, id, dto.quantity);
  }
}

@Controller('admin/raffles')
@Roles('ADMIN', 'OPS')
export class AdminRafflesController {
  constructor(private readonly raffles: RafflesService) {}

  @Post(':id/draw')
  draw(@CurrentUser() actor: User, @Param('id') id: string) {
    return this.raffles.draw(actor, id);
  }

  @Post(':id/cancel')
  cancel(@CurrentUser() actor: User, @Param('id') id: string) {
    return this.raffles.cancel(actor, id);
  }
}
