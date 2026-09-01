import { webhookDelivery } from '../../../src/lib/bridge/webhook-delivery';

describe('webhookDelivery', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.useRealTimers();
  });

  it('succeeds on first attempt without delay', async () => {
    const fetchMock = jest.fn().mockResolvedValue({ ok: true });
    global.fetch = fetchMock;

    await webhookDelivery.deliverWithRetries({
      url: 'http://localhost/hook',
      payload: '{"x":1}',
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('retries with 2s, 4s, 8s, 16s delays then logs failure', async () => {
    jest.useFakeTimers();
    const fetchMock = jest
      .fn()
      .mockRejectedValue(new Error('connection refused'));
    global.fetch = fetchMock;
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);

    const delivery = webhookDelivery.deliverWithRetries({
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
      url: 'http://localhost/hook',
      payload: '{}',
    });

    await jest.runAllTimersAsync();
    await delivery;

    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});
