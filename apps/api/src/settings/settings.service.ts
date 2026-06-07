import { Inject, Injectable } from '@nestjs/common';
import type { PrismaClient } from '@boosters/db';
import { PRISMA } from '../prisma/prisma.module.js';

/** Runtime, admin-mutable platform flags/settings (distinct from env config). */
@Injectable()
export class SettingsService {
  constructor(@Inject(PRISMA) private readonly prisma: PrismaClient) {}

  async getBool(key: string, def = false): Promise<boolean> {
    const s = await this.prisma.setting.findUnique({ where: { key } });
    const v = s?.value as { enabled?: boolean } | undefined;
    return typeof v?.enabled === 'boolean' ? v.enabled : def;
  }

  async setBool(key: string, enabled: boolean): Promise<void> {
    await this.prisma.setting.upsert({
      where: { key },
      create: { key, value: { enabled } },
      update: { value: { enabled } },
    });
  }
}

export const SETTING_BUYBACK_PAUSED = 'buyback.paused';
