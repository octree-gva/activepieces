import { propsValidation } from '@activepieces/pieces-common';
import { z } from 'zod';
import type {
  CreateDraftProposalPayload,
  UpdateDraftProposalPayloadData,
} from '@octree/decidim-sdk';

export function draftProposalsUserTokenError(): string {
  return 'Draft proposals require a user access token. Set "User access token" (e.g. output from Impersonate).';
}

export function parseDraftProposalId(value: unknown): number {
  return z.number().int().positive().parse(value);
}

const draftUpdateBodySchema = z
  .object({
    title: z.string().optional(),
    body: z.string().optional(),
    locale: z.string().optional(),
  })
  .passthrough();

export async function parseDraftUpdateBody(
  body: unknown
): Promise<UpdateDraftProposalPayloadData> {
  await propsValidation.validateZod({ body }, { body: draftUpdateBodySchema });
  return draftUpdateBodySchema.parse(body) as UpdateDraftProposalPayloadData;
}

export function buildCreateDraftProposalPayload(
  componentId: number
): CreateDraftProposalPayload {
  return { data: { component_id: componentId } };
}
