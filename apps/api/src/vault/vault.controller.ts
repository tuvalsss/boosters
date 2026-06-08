import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { VaultItemState, type User } from '@boosters/db';
import { CurrentUser, Roles } from '../auth/auth.decorators.js';
import { VaultService } from './vault.service.js';
import { CreateIntakeDto, ManagedCategoryDto, SetGradeDto, UpdateCardDto } from './vault.dto.js';

/**
 * Admin / Ops vault console. Role-gated to staff. Every mutation is audited by
 * VaultService. Minting (vault) is the custody-gate enforcement point.
 */
@Controller('admin/vault')
@Roles('ADMIN', 'OPS')
export class VaultController {
  constructor(private readonly vault: VaultService) {}

  /** Intake/grading queue, optionally filtered by state. */
  @Get('items')
  list(@Query('state') state?: string, @Query('take') take?: string, @Query('skip') skip?: string) {
    const parsed =
      state && (Object.values(VaultItemState) as string[]).includes(state)
        ? (state as VaultItemState)
        : undefined;
    return this.vault.listByState(parsed, Number(take) || 50, Number(skip) || 0);
  }

  @Get('items/:id')
  get(@Param('id') id: string) {
    return this.vault.findItem(id);
  }

  @Get('card-categories')
  categories() {
    return this.vault.listCategories(true);
  }

  @Post('card-categories')
  createCategory(@CurrentUser() actor: User, @Body() dto: ManagedCategoryDto) {
    return this.vault.createCategory(actor, dto);
  }

  @Patch('card-categories/:id')
  updateCategory(
    @CurrentUser() actor: User,
    @Param('id') id: string,
    @Body() dto: ManagedCategoryDto,
  ) {
    return this.vault.updateCategory(actor, id, dto);
  }

  @Post('intake')
  createIntake(@CurrentUser() actor: User, @Body() dto: CreateIntakeDto) {
    return this.vault.createIntake(actor, dto);
  }

  @Post('items/:id/authenticate')
  authenticate(@CurrentUser() actor: User, @Param('id') id: string) {
    return this.vault.startAuthentication(actor, id);
  }

  @Post('items/:id/grade')
  grade(@CurrentUser() actor: User, @Param('id') id: string, @Body() dto: SetGradeDto) {
    return this.vault.setGrade(actor, id, dto.grade);
  }

  @Patch('items/:id/card')
  updateCard(@CurrentUser() actor: User, @Param('id') id: string, @Body() dto: UpdateCardDto) {
    return this.vault.updateCard(actor, id, dto);
  }

  /** GRADED → VAULTED: mints the backing cNFT (custody gate). */
  @Post('items/:id/vault')
  vault_(@CurrentUser() actor: User, @Param('id') id: string) {
    return this.vault.vault(actor, id);
  }
}
