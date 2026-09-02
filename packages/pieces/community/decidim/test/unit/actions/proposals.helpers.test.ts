import {
  buildProposalReadRequest,
  buildProposalsListRequest,
  buildVoteProposalRequest,
} from '../../../src/lib/domains/proposals/proposals.helpers';

describe('buildProposalsListRequest', () => {
  it('maps component_id', () => {
    const { request, effectivePerPage } = buildProposalsListRequest({
      accessToken: 'tok',
      searchOptions: { componentId: 9 },
    });
    expect(effectivePerPage).toBe(50);
    expect(request).toMatchObject({
      authorization: 'Bearer tok',
      page: 1,
      perPage: 50,
      componentId: 9,
    });
  });

  it('requires componentId', () => {
    expect(() =>
      buildProposalsListRequest({
        accessToken: 't',
        searchOptions: {},
      })
    ).toThrow('Component ID is required');
  });
});

describe('buildProposalReadRequest', () => {
  it('requires positive proposalId', () => {
    expect(() =>
      buildProposalReadRequest({
        accessToken: 't',
        readOptions: { proposalId: 0 },
      })
    ).toThrow();
  });

  it('builds a read request by id', () => {
    const req = buildProposalReadRequest({
      accessToken: 'raw',
      readOptions: { proposalId: 7 },
    });
    expect(req).toMatchObject({
      id: 7,
      authorization: 'Bearer raw',
    });
  });
});

describe('buildVoteProposalRequest', () => {
  it('builds vote payload', () => {
    const req = buildVoteProposalRequest({
      accessToken: 't',
      voteOptions: { proposalId: 5, voteWeight: 2 },
    });
    expect(req).toEqual({
      authorization: 'Bearer t',
      voteProposalCreateBody: {
        proposal_id: 5,
        data: { weight: 2 },
      },
    });
  });

  it('requires proposalId and voteWeight', () => {
    expect(() =>
      buildVoteProposalRequest({
        accessToken: 't',
        voteOptions: { proposalId: 1 },
      })
    ).toThrow();
  });
});
