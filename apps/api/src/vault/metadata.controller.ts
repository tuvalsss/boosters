import { Controller, Get, Inject, NotFoundException, Param } from '@nestjs/common';
import type { PrismaClient } from '@boosters/db';
import { Public } from '../auth/auth.decorators.js';
import { PRISMA } from '../prisma/prisma.module.js';

/**
 * Public token metadata (Metaplex JSON standard). The minted cNFT's URI points
 * here, so metadata is real and self-hosted — no external pinning required for
 * devnet. (Migrating to Arweave/IPFS is a Phase-10 polish item.)
 */
@Controller('metadata')
@Public()
export class MetadataController {
  constructor(@Inject(PRISMA) private readonly prisma: PrismaClient) {}

  @Get('vault/:id')
  async vaultMetadata(@Param('id') id: string) {
    const item = await this.prisma.vaultItem.findUnique({
      where: { id },
      include: { physicalCard: { include: { photos: true } } },
    });
    if (!item) throw new NotFoundException('Vault item not found');

    const card = item.physicalCard;
    const image = card.photos[0]?.url ?? '';
    const attributes = [
      { trait_type: 'Category', value: card.category },
      { trait_type: 'Grader', value: card.grader },
      ...(card.grade ? [{ trait_type: 'Grade', value: card.grade }] : []),
      ...(card.setName ? [{ trait_type: 'Set', value: card.setName }] : []),
      ...(card.year ? [{ trait_type: 'Year', value: String(card.year) }] : []),
      ...(card.certNumber ? [{ trait_type: 'Cert #', value: card.certNumber }] : []),
      { trait_type: 'Vault Item', value: item.id },
    ];

    return {
      name: card.cardName,
      symbol: 'BOOST',
      description:
        `Phygital trading card vaulted 1:1 by Boosters. Backed by a physical ${card.grader} ${card.grade ?? ''} ${card.cardName}.`.trim(),
      image,
      attributes,
      properties: {
        category: 'image',
        files: image ? [{ uri: image, type: 'image/png' }] : [],
      },
    };
  }
}
