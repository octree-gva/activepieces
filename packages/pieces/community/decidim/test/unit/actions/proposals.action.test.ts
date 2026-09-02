import { vi } from 'vitest';
import { proposals } from '../../../src/lib/domains/proposals/proposals';
import {
  createMockActionContext,
  loadDynamicProps,
} from '../../helpers/create-mock-action-context';
import { decidimCustomAuth } from '../../helpers/decidim-test-fixtures';

const { listProposals, getProposal, castProposalVote } = vi.hoisted(() => ({
  listProposals: vi.fn(),
  getProposal: vi.fn(),
  castProposalVote: vi.fn(),
}));

vi.mock('../../../src/lib/runtime/authMode', () => ({
  resolveAuthContext: vi.fn().mockResolvedValue({
    mode: 'user',
    rawAccessToken: 'token',
    baseConfiguration: {},
  }),
  bearerAuthorization: vi.fn().mockReturnValue('Bearer token'),
}));

vi.mock('../../../src/lib/runtime/clients', () => ({
  createProposalsApi: vi.fn().mockReturnValue({
    listProposals,
    getProposal,
    castProposalVote,
  }),
}));

function run(props: Record<string, unknown>) {
  return proposals.run(
    createMockActionContext({
      auth: decidimCustomAuth,
      propsValue: props,
    }) as Parameters<typeof proposals.run>[0]
  );
}

describe('proposals action', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listProposals.mockReset();
    getProposal.mockReset();
    castProposalVote.mockReset();
  });

  it('search lists by component_id', async () => {
    listProposals.mockResolvedValueOnce({ data: { data: [{ id: '1' }] } });
    const out = await run({
      action: 'search',
      searchOptions: { componentId: 9 },
    });
    expect(out.ok).toBe(true);
    if (!out.ok) throw new Error('expected success');
    expect(out.proposals).toEqual([{ id: '1' }]);
    expect(listProposals).toHaveBeenCalledWith(
      expect.objectContaining({ componentId: 9 })
    );
  });

  it('search requires componentId', async () => {
    const out = await run({ action: 'search' });
    expect(out.ok).toBe(false);
  });

  it('search treats missing data as empty', async () => {
    listProposals.mockResolvedValueOnce({ data: {} });
    const out = await run({
      action: 'search',
      searchOptions: { componentId: 1 },
    });
    expect(out.ok).toBe(true);
    if (!out.ok) throw new Error('expected success');
    expect(out.proposals).toEqual([]);
  });

  it('read requires proposalId', async () => {
    const out = await run({ action: 'read' });
    expect(out.ok).toBe(false);
  });

  it('search treats non-array payload as empty', async () => {
    listProposals.mockResolvedValueOnce({ data: { data: 'bad' } });
    const out = await run({
      action: 'search',
      searchOptions: { componentId: 1 },
    });
    expect(out.ok).toBe(true);
    if (!out.ok) throw new Error('expected success');
    expect(out.proposals).toEqual([]);
  });

  it('read loads one proposal by id', async () => {
    getProposal.mockResolvedValueOnce({ data: { data: { id: '7' } } });
    const out = await run({
      action: 'read',
      readOptions: { proposalId: 7 },
    });
    expect(out.ok).toBe(true);
    if (!out.ok) throw new Error('expected success');
    expect(out.proposal_id).toBe('7');
  });

  it('read omits proposal_id when payload has no id', async () => {
    getProposal.mockResolvedValueOnce({ data: { data: 'x' } });
    const out = await run({
      action: 'read',
      readOptions: { proposalId: 7 },
    });
    expect(out.ok).toBe(true);
    if (!out.ok) throw new Error('expected success');
    expect(out.proposal_id).toBeUndefined();
  });

  it('vote casts a vote', async () => {
    castProposalVote.mockResolvedValueOnce({ data: { ok: true } });
    const out = await run({
      action: 'vote',
      voteOptions: { proposalId: 5, voteWeight: 1 },
    });
    expect(out.ok).toBe(true);
    if (!out.ok) throw new Error('expected success');
    expect(out.proposal_id).toBe('5');
  });

  it('returns error for unknown action', async () => {
    const out = await run({ action: 'delete' });
    expect(out.ok).toBe(false);
  });

  it('returns error when the API throws', async () => {
    listProposals.mockRejectedValueOnce(new Error('boom'));
    const out = await run({
      action: 'search',
      searchOptions: { componentId: 1 },
    });
    expect(out.ok).toBe(false);
  });

  it('exposes one search field', async () => {
    const search = await loadDynamicProps(proposals.props.searchOptions, {
      action: 'search',
    });
    expect(Object.keys(search)).toEqual(['componentId']);
    expect(await loadDynamicProps(proposals.props.searchOptions, { action: 'read' })).toEqual({});
    expect(
      Object.keys(await loadDynamicProps(proposals.props.readOptions, { action: 'read' }))
    ).toEqual(['proposalId']);
    expect(await loadDynamicProps(proposals.props.readOptions, { action: 'search' })).toEqual({});
    const vote = await loadDynamicProps(proposals.props.voteOptions, { action: 'vote' });
    expect(vote).toHaveProperty('proposalId');
    expect(vote).toHaveProperty('voteWeight');
    expect(await loadDynamicProps(proposals.props.voteOptions, { action: 'search' })).toEqual({});
  });
});
