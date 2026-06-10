import { Module } from '@nestjs/common';
import { VaultService } from './vault.service.js';
import { CatalogController, VaultController } from './vault.controller.js';
import { MetadataController } from './metadata.controller.js';
import { BubblegumMinter } from './bubblegum.minter.js';
import { CNFT_MINTER } from './cnft-minter.js';

/**
 * Vault module: state machine, admin intake/grading, public token metadata, and
 * the real Bubblegum cNFT minter (the only minter wired into the system).
 */
@Module({
  controllers: [CatalogController, VaultController, MetadataController],
  providers: [VaultService, { provide: CNFT_MINTER, useClass: BubblegumMinter }],
  exports: [VaultService],
})
export class VaultModule {}
