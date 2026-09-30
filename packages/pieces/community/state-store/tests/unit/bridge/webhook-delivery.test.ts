import Redis from 'ioredis';
import { webhookDelivery } from '../../../src/lib/bridge/webhook-delivery';

describe('webhookDelivery', () => {
  const originalFetch = global.fetch;
  const redis = {
    set: jest.fn().mockResolvedValue('OK'),
  } as unknown as Redis;

  beforeEach(() => {
    jest.clearAllMocks();
    webhookDelivery.resetDeliveryStateForTests();
    (redis.set as jest.Mock).mockResolvedValue('OK');
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.useRealTimers();
  });

  it('succeeds on first attempt without delay', async () => {
    const fetchMock = jest.fn().mockResolvedValue({ ok: true });
    global.fetch = fetchMock;

    await webhookDelivery.deliverWithRetries({
      redis,
      subscriberId: 'sub-1',
      streamId: '1-0',
      url: 'http://localhost/hook',
      payload: '{"x":1}',
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(redis.set).toHaveBeenCalled();
  });

  it('skips duplicate stream id for the same subscriber', async () => {
    (redis.set as jest.Mock).mockResolvedValueOnce(null);
    const fetchMock = jest.fn().mockResolvedValue({ ok: true });
    global.fetch = fetchMock;

    await webhookDelivery.deliverWithRetries({
      redis,
      subscriberId: 'sub-1',
      streamId: '1-0',
      url: 'http://localhost/hook',
      payload: '{}',
    });

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('retries with 2s, 4s, 8s, 16s delays then logs failure', async () => {
    jest.useFakeTimers();
    const fetchMock = jest
      .fn()
      .mockRejectedValue(new Error('connection refused'));
    global.fetch = fetchMock;
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);

    const delivery = webhookDelivery.deliverWithRetries({
      redis,
      subscriberId: 'sub-retry',
      streamId: '2-0',
      url: 'http://127.0.0.1/hook',
      payload: '{}',
    });

    await jest.runAllTimersAsync();
    await delivery;

    expect(fetchMock).toHaveBeenCalledTimes(5);
    expect(errorSpy).toHaveBeenCalledWith(
      '[watcher] Webhook POST failed after retries:',
      'http://127.0.0.1/hook',
      expect.any(Error)
    );
    errorSpy.mockRestore();
  });

  it('stops retrying after a successful attempt', async () => {
    jest.useFakeTimers();
    const fetchMock = jest
      .fn()
      .mockRejectedValueOnce(new Error('down'))
      .mockRejectedValueOnce(new Error('down'))
      .mockResolvedValueOnce({ ok: true });
    global.fetch = fetchMock;

    const delivery = webhookDelivery.deliverWithRetries({
      redis,
      subscriberId: 'sub-ok',
      streamId: '3-0',
      url: 'http://localhost/hook',
      payload: '{}',
    });

    await jest.runAllTimersAsync();
    await delivery;

    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('opens circuit after hard address failures', async () => {
    const error = Object.assign(new Error('addr'), { code: 'EADDRNOTAVAIL' });
    webhookDelivery.recordDeliveryFailure('sub-circuit', error);
    expect(webhookDelivery.isCircuitOpen('sub-circuit')).toBe(true);

    const fetchMock = jest.fn().mockResolvedValue({ ok: true });
    global.fetch = fetchMock;
    await webhookDelivery.deliverWithRetries({
      redis,
      subscriberId: 'sub-circuit',
      streamId: '4-0',
      url: 'http://localhost/hook',
      payload: '{}',
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
