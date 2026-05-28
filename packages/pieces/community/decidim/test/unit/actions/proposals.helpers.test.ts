import {
  buildProposalReadRequest,
  buildProposalsListRequest,
  buildVoteProposalRequest,
} from '../../../src/lib/domains/proposals/proposals.helpers';

describe('buildProposalsListRequest', () => {
  it('defaults pagination like the action', () => {
    const { request, effectivePerPage } = buildProposalsListRequest({
      accessToken: 't',
      searchOptions: {},
    });
    expect(effectivePerPage).toBe(50);
    expect(request).toMatchObject({
      authorization: 'Bearer t',
      page: 1,
      perPage: 50,
    });
  });

  it('maps filters and locales', () => {
    const { request, effectivePerPage } = buildProposalsListRequest({
      accessToken: 'tok',
      searchOptions: {
        page: 2,
        perPage: 10,
        locales: [{ value: 'en' }],
        spaceManifest: 'participatory_processes',
        spaceId: 3,
        componentId: 9,
        order: 'published_at',
        orderDirection: 'desc',
      },
    });
    expect(effectivePerPage).toBe(10);
    expect(request).toMatchObject({
      authorization: 'Bearer tok',
      page: 2,
      perPage: 10,
      locales: ['en'],
      spaceManifest: 'participatory_processes',
      spaceId: 3,
      componentId: 9,
      order: 'published_at',
      orderDirection: 'desc',
    });
  });

  it('rejects perPage > 100', () => {
    expect(() =>
      buildProposalsListRequest({
        accessToken: 't',
        searchOptions: { perPage: 101 },
      })
    ).toThrow();
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

  it('includes optional scope fields', () => {
    const req = buildProposalReadRequest({
      accessToken: 'raw',
      readOptions: {
        proposalId: 7,
        componentId: 2,
        order: 'published_at',
        orderDirection: 'asc',
      },
    });
    expect(req).toMatchObject({
      id: 7,
      authorization: 'Bearer raw',
      componentId: 2,
      order: 'published_at',
      orderDirection: 'asc',
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
