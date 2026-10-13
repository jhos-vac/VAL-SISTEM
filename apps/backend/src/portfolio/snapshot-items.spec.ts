import { snapshotItemsByAsset } from './snapshot-items';

describe('snapshotItemsByAsset', () => {
  it('suma la misma moneda en varias wallets (Spot + Earn) en un solo ítem', () => {
    const items = snapshotItemsByAsset(
      [
        { assetId: 'bnb', quantity: 2, currentValue: 700 },
        { assetId: 'btc', quantity: 0.01, currentValue: 600 },
        { assetId: 'bnb', quantity: 3, currentValue: 1050 },
      ],
      2350,
    );
    expect(items).toHaveLength(2);
    const bnb = items.find((i) => i.assetId === 'bnb')!;
    expect(bnb.quantity).toBe(5);
    expect(bnb.value).toBe(1750);
    expect(bnb.allocation).toBeCloseTo((1750 / 2350) * 100);
  });

  it('con valor total 0 la asignación es 0', () => {
    expect(
      snapshotItemsByAsset([{ assetId: 'x', quantity: 1, currentValue: 0 }], 0),
    ).toEqual([{ assetId: 'x', quantity: 1, value: 0, allocation: 0 }]);
  });
});
