import {
  BinanceAccountClientService,
  BinanceRateLimitError,
  BinanceTransientError,
} from './binance-account-client.service';

function response(
  status: number,
  body: unknown,
  headers: Record<string, string> = {},
) {
  return new Response(typeof body === 'string' ? body : JSON.stringify(body), {
    status,
    headers,
  });
}

describe('BinanceAccountClientService: límites y errores temporales', () => {
  const fetchMock = jest.fn();
  beforeEach(() => {
    fetchMock.mockReset();
    global.fetch = fetchMock;
  });

  it('con 418 guarda hasta cuándo dura el bloqueo y no vuelve a consultar', async () => {
    const until = Date.now() + 30 * 60_000;
    fetchMock.mockResolvedValue(
      response(418, {
        code: -1003,
        msg: `Way too much request weight used; IP banned until ${until}.`,
      }),
    );
    const client = new BinanceAccountClientService();
    await expect(client.getAccountSnapshot('k', 's')).rejects.toBeInstanceOf(
      BinanceRateLimitError,
    );
    expect(client.isRateLimited()).toBe(true);

    await expect(
      client.getMyTrades('k', 's', 'BTCUSDT'),
    ).rejects.toBeInstanceOf(BinanceRateLimitError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('el mensaje del bloqueo es entendible', async () => {
    fetchMock.mockResolvedValue(response(429, '', { 'retry-after': '120' }));
    const client = new BinanceAccountClientService();
    await expect(client.getAccountSnapshot('k', 's')).rejects.toThrow(
      /Se reintenta solo en unos 2 min/,
    );
  });

  it('si Binance está caído, el historial de trades corta el sync en vez de devolver vacío', async () => {
    fetchMock.mockResolvedValue(response(503, 'down'));
    const client = new BinanceAccountClientService();
    await expect(
      client.getMyTrades('k', 's', 'BTCUSDT'),
    ).rejects.toBeInstanceOf(BinanceTransientError);
  });

  it('un par inexistente sí es "sin historial"', async () => {
    fetchMock.mockResolvedValue(
      response(400, { code: -1121, msg: 'Invalid symbol.' }),
    );
    const client = new BinanceAccountClientService();
    await expect(client.getMyTrades('k', 's', 'XYZUSDT')).resolves.toEqual([]);
  });

  it('sin permiso para leer depósitos, esa fuente se omite', async () => {
    fetchMock.mockResolvedValue(
      response(401, {
        code: -2015,
        msg: 'Invalid API-key, IP, or permissions',
      }),
    );
    const client = new BinanceAccountClientService();
    await expect(
      client.getDeposits('k', 's', Date.now() - 86_400_000),
    ).resolves.toEqual([]);
  });

  it('precio histórico: un límite del espejo público no bloquea la API privada', async () => {
    fetchMock
      .mockResolvedValueOnce(response(429, ''))
      .mockResolvedValueOnce(response(200, [[0, '41000.5']]));
    const client = new BinanceAccountClientService();
    await expect(client.getPriceAt('BTC', 0)).resolves.toBe(41000.5);
    expect(client.isRateLimited()).toBe(false);
  });
});
