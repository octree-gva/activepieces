import {
  draftProposalsUserTokenError,
  parseDraftProposalId,
  parseDraftUpdateBody,
  buildCreateDraftProposalPayload,
  parseRequiredComponentId,
  unpublishedDrafts,
} from '../../../src/lib/domains/proposals/draft-proposals.helpers';

describe('draftProposalsUserTokenError', () => {
  it('returns stable message', () => {
    expect(draftProposalsUserTokenError()).toContain('user access token');
  });
});

describe('parseDraftProposalId', () => {
  it('parses positive int', () => {
    expect(parseDraftProposalId(3)).toBe(3);
  });

  it('throws for invalid', () => {
    expect(() => parseDraftProposalId(0)).toThrow();
    expect(() => parseDraftProposalId(undefined)).toThrow();
  });
});

describe('parseDraftUpdateBody', () => {
  it('allows optional title, body, locale and passthrough', async () => {
    const body = await parseDraftUpdateBody({
      title: 'T',
      body: 'B',
      locale: 'en',
      extra: 1,
    });
    expect(body).toMatchObject({
      title: 'T',
      body: 'B',
      locale: 'en',
      extra: 1,
    });
  });

  it('rejects non-object', async () => {
    await expect(parseDraftUpdateBody(null)).rejects.toThrow();
  });
});

describe('buildCreateDraftProposalPayload', () => {
  it('wraps component_id', () => {
    expect(buildCreateDraftProposalPayload(9)).toEqual({
      data: { component_id: 9 },
    });
  });
});

describe('parseRequiredComponentId', () => {
  it('parses a positive id', () => {
    expect(parseRequiredComponentId(4)).toBe(4);
  });

  it('throws when missing', () => {
    expect(() => parseRequiredComponentId(undefined)).toThrow();
  });
});

describe('unpublishedDrafts', () => {
  it('keeps only unpublished items', () => {
    expect(
      unpublishedDrafts([
        { id: '1', meta: { published: false } },
        { id: '2', meta: { published: true } },
        { id: '3' },
        null,
      ])
    ).toEqual([{ id: '1', meta: { published: false } }]);
  });
});
