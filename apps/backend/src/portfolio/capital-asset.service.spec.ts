import { BadRequestException } from '@nestjs/common';
import { CapitalAssetService } from './capital-asset.service';
import type { PortfolioPrismaService } from '../prisma/portfolio-prisma.service';
import type { MarketService } from '../market/market.service';

// Los servicios reales importan el cliente generado de Prisma (ESM), que
// Jest no carga; acá se pasan dobles por constructor.
jest.mock('../prisma/portfolio-prisma.service', () => ({
  PortfolioPrismaService: class {},
}));
jest.mock('../market/market.service', () => ({ MarketService: class {} }));

function setup() {
  const prisma = {
    capitalAsset: {
      deleteMany: jest.fn((args: unknown) => ({ op: 'deleteMany', args })),
      createMany: jest.fn((args: unknown) => ({ op: 'createMany', args })),
    },
    $transaction: jest.fn(() => Promise.resolve([])),
  };
  const market = {
    getAssets: jest.fn().mockResolvedValue([
      { id: 'id-usdt', symbol: 'USDT' },
      { id: 'id-usdc', symbol: 'USDC' },
      { id: 'id-btc', symbol: 'BTC' },
    ]),
  };
  const service = new CapitalAssetService(
    prisma as unknown as PortfolioPrismaService,
    market as unknown as MarketService,
  );
  return { service, prisma };
}

describe('CapitalAssetService.replace', () => {
  it('reemplaza la lista completa, sin duplicados ni importar mayúsculas', async () => {
    const { service, prisma } = setup();
    const result = await service.replace('u-1', ['usdt', 'USDC', ' USDT ']);
    expect(result).toEqual(['USDC', 'USDT']);
    expect(prisma.capitalAsset.deleteMany).toHaveBeenCalledWith({
      where: { userId: 'u-1' },
    });
    expect(prisma.capitalAsset.createMany).toHaveBeenCalledWith({
      data: [
        { userId: 'u-1', assetId: 'id-usdt' },
        { userId: 'u-1', assetId: 'id-usdc' },
      ],
    });
  });

  it('una lista vacía quita todas las monedas capital', async () => {
    const { service, prisma } = setup();
    await expect(service.replace('u-1', [])).resolves.toEqual([]);
    expect(prisma.capitalAsset.createMany).toHaveBeenCalledWith({ data: [] });
  });

  it('rechaza monedas que no están en el catálogo y no guarda nada', async () => {
    const { service, prisma } = setup();
    await expect(
      service.replace('u-1', ['USDT', 'XYZ']),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
