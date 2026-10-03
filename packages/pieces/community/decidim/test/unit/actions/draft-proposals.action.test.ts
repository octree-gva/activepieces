import { vi } from 'vitest';
import { draftProposals } from '../../../src/lib/domains/proposals/draft-proposals';
import {
  createMockActionContext,
  loadDynamicProps,
} from '../../helpers/create-mock-action-context';
import { decidimCustomAuth } from '../../helpers/decidim-test-fixtures';

const {
  listProposals,
  createDraftProposal,
  getDraftProposal,
  updateDraftProposal,
  withdrawDraftProposal,
  publishDraftProposal,
} = vi.hoisted(() => ({
  listProposals: vi.fn(),
  createDraftProposal: vi.fn(),
  getDraftProposal: vi.fn(),
  updateDraftProposal: vi.fn(),
  withdrawDraftProposal: vi.fn(),
  publishDraftProposal: vi.fn(),
}));

const resolveAuthContext = vi.hoisted(() =>
  vi.fn().mockResolvedValue({
    mode: 'user',
    rawAccessToken: 'user-token',
    baseConfiguration: {},
  })
);

vi.mock('../../../src/lib/runtime/authMode', () => ({
  resolveAuthContext,
  bearerAuthorization: vi.fn().mockReturnValue('Bearer user-token'),
}));

vi.mock('../../../src/lib/runtime/clients', () => ({
  createDraftProposalsApi: vi.fn().mockReturnValue({
    createDraftProposal,
    getDraftProposal,
    updateDraftProposal,
    withdrawDraftProposal,
    publishDraftProposal,
  }),
  createProposalsApi: vi.fn().mockReturnValue({
    listProposals,
  }),
}));

function run(props: Record<string, unknown>) {
  return draftProposals.run(
    createMockActionContext({
      auth: decidimCustomAuth,
      propsValue: props,
    }) as Parameters<typeof draftProposals.run>[0]
  );
}

describe('draftProposals action', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resolveAuthContext.mockResolvedValue({
      mode: 'user',
      rawAccessToken: 'user-token',
      baseConfiguration: {},
    });
    listProposals.mockReset();
    createDraftProposal.mockReset();
    getDraftProposal.mockReset();
    updateDraftProposal.mockReset();
    withdrawDraftProposal.mockReset();
    publishDraftProposal.mockReset();
  });

  it('rejects system tokens', async () => {
    resolveAuthContext.mockResolvedValueOnce({
      mode: 'system',
      rawAccessToken: 'sys',
      baseConfiguration: {},
    });
    const out = await run({ action: 'search', searchOptions: { componentId: 1 } });
    expect(out.ok).toBe(false);
  });

  it('search returns listProposals body as-is', async () => {
    listProposals.mockResolvedValueOnce({
      data: {
        data: [
          { id: '1', meta: { published: false } },
          { id: '2', meta: { published: true } },
        ],
      },
    });
    const out = await run({
      action: 'search',
      searchOptions: { componentId: 9 },
    });
    expect(out.ok).toBe(true);
    if (!out.ok) throw new Error('expected success');
    expect(out.data).toEqual([
      { id: '1', meta: { published: false } },
      { id: '2', meta: { published: true } },
    ]);
  });

  it('search passes through empty body', async () => {
    listProposals.mockResolvedValueOnce({ data: {} });
    const out = await run({
      action: 'search',
      searchOptions: { componentId: 9 },
    });
    expect(out.ok).toBe(true);
    if (!out.ok) throw new Error('expected success');
    expect(out.data).toBeUndefined();
  });

  it('search passes through non-array data as-is', async () => {
    listProposals.mockResolvedValueOnce({ data: { data: 'bad' } });
    const out = await run({
      action: 'search',
      searchOptions: { componentId: 9 },
    });
    expect(out.ok).toBe(true);
    if (!out.ok) throw new Error('expected success');
    expect(out.data).toBe('bad');
  });

  it('search requires componentId', async () => {
    const out = await run({ action: 'search', searchOptions: {} });
    expect(out.ok).toBe(false);
  });

  it('create requires componentId', async () => {
    const out = await run({ action: 'create', createOptions: {} });
    expect(out.ok).toBe(false);
  });

  it('id actions require a draft id', async () => {
    const out = await run({ action: 'read' });
    expect(out.ok).toBe(false);
  });

  it('update requires a body', async () => {
    const out = await run({
      action: 'update',
      idOptions: { draftProposalId: 3 },
      updateOptions: {},
    });
    expect(out.ok).toBe(false);
  });

  it('create returns server body as-is', async () => {
    createDraftProposal.mockResolvedValueOnce({ data: { data: { id: 'd1' } } });
    const out = await run({
      action: 'create',
      createOptions: { componentId: 9 },
    });
    expect(out.ok).toBe(true);
    if (!out.ok) throw new Error('expected success');
    expect(out.data).toEqual({ id: 'd1' });
  });

  it('read returns server body as-is', async () => {
    getDraftProposal.mockResolvedValueOnce({ data: { data: { id: 'd1' } } });
    const out = await run({
      action: 'read',
      idOptions: { draftProposalId: 3 },
    });
    expect(out.ok).toBe(true);
    if (!out.ok) throw new Error('expected success');
    expect(out.data).toEqual({ id: 'd1' });
  });

  it('update writes the body', async () => {
    updateDraftProposal.mockResolvedValueOnce({ data: { data: { id: 'd1' } } });
    const out = await run({
      action: 'update',
      idOptions: { draftProposalId: 3 },
      updateOptions: { body: { title: 'T' } },
    });
    expect(out.ok).toBe(true);
    if (!out.ok) throw new Error('expected success');
    expect(out.data).toEqual({ id: 'd1' });
    expect(updateDraftProposal).toHaveBeenCalled();
  });

  it('update rejects on axios HTTP 400', async () => {
    const axiosError = {
      message: 'Request failed with status code 400',
      response: { status: 400, data: { error: 'Invalid' } },
      isAxiosError: true,
    };
    updateDraftProposal.mockRejectedValueOnce(axiosError);
    await expect(
      run({
        action: 'update',
        idOptions: { draftProposalId: 3 },
        updateOptions: { body: { title: 'T' } },
      })
    ).rejects.toBe(axiosError);
  });

  it('withdraw returns empty object when API has no body', async () => {
    withdrawDraftProposal.mockResolvedValueOnce({});
    const out = await run({
      action: 'withdraw',
      idOptions: { draftProposalId: 3 },
    });
    expect(out.ok).toBe(true);
    if (!out.ok) throw new Error('expected success');
    expect(out).toMatchObject({ ok: true, error: null });
  });

  it('publish returns server body as-is', async () => {
    publishDraftProposal.mockResolvedValueOnce({ data: { data: { id: 'p1' } } });
    const out = await run({
      action: 'publish',
      idOptions: { draftProposalId: 3 },
    });
    expect(out.ok).toBe(true);
    if (!out.ok) throw new Error('expected success');
    expect(out.data).toEqual({ id: 'p1' });
  });

  it('returns error for unknown action', async () => {
    const out = await run({
      action: 'explode',
      idOptions: { draftProposalId: 1 },
    });
    expect(out.ok).toBe(false);
  });

  it('exposes search by component_id only', async () => {
    expect(await loadDynamicProps(draftProposals.props.connectionSetup, { auth: {} })).toEqual({});
    const hint = await loadDynamicProps(draftProposals.props.connectionSetup, {});
    expect(hint).toHaveProperty('connectionHint');

    const search = await loadDynamicProps(draftProposals.props.searchOptions, {
      action: 'search',
      auth: {},
    });
    expect(Object.keys(search)).toEqual(['componentId']);
    expect(
      await loadDynamicProps(draftProposals.props.searchOptions, { action: 'create', auth: {} })
    ).toEqual({});
    expect(await loadDynamicProps(draftProposals.props.searchOptions, { action: 'search' })).toEqual(
      {}
    );

    expect(
      Object.keys(
        await loadDynamicProps(draftProposals.props.createOptions, { action: 'create', auth: {} })
      )
    ).toEqual(['componentId']);
    expect(
      await loadDynamicProps(draftProposals.props.createOptions, { action: 'search', auth: {} })
    ).toEqual({});

    expect(
      await loadDynamicProps(draftProposals.props.idOptions, { action: 'search', auth: {} })
    ).toEqual({});
    expect(
      await loadDynamicProps(draftProposals.props.idOptions, { action: 'create', auth: {} })
    ).toEqual({});
    expect(
      Object.keys(await loadDynamicProps(draftProposals.props.idOptions, { action: 'read', auth: {} }))
    ).toEqual(['draftProposalId']);
    expect(await loadDynamicProps(draftProposals.props.idOptions, { action: 'read' })).toEqual({});

    expect(
      Object.keys(
        await loadDynamicProps(draftProposals.props.updateOptions, { action: 'update', auth: {} })
      )
    ).toEqual(['body']);
    expect(
      await loadDynamicProps(draftProposals.props.updateOptions, { action: 'read', auth: {} })
    ).toEqual({});
  });
});
