import { meetingsReminder } from '../../../src/lib/triggers/meetings-reminder';

describe('meetingsReminder trigger', () => {
  it('enables without throwing (manual webhook registration)', async () => {
    await expect(
      meetingsReminder.onEnable({} as Parameters<typeof meetingsReminder.onEnable>[0])
    ).resolves.toBeUndefined();
  });

  it('returns normalized body payload', async () => {
    const items = await meetingsReminder.run({
      payload: {
        body: {
          meeting_id: '99',
          starts_at: '2026-03-26T12:00:00Z',
        },
      },
    } as Parameters<typeof meetingsReminder.run>[0]);

    expect(items).toEqual([
      {
        meeting_id: '99',
        starts_at: '2026-03-26T12:00:00Z',
      },
    ]);
  });
});
