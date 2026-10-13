// Dirección interna de las wallets de una cuenta de exchange: Spot es
// `binance:<id>`, Earn `binance:<id>:earn`, Fondos `binance:<id>:funding`.
export const exchangeWalletAddress = (accountId: string) =>
  `binance:${accountId}`;
