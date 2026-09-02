import type { Action } from '@activepieces/pieces-framework';
import { blogPosts } from '../domains/blogs/blog-posts';
import { participantCrud } from '../domains/users/participant-crud';
import { proposals } from '../domains/proposals/proposals';
import { draftProposals } from '../domains/proposals/draft-proposals';
import { searchComponent } from '../domains/components/search-component';
import { searchParticipatorySpace } from '../domains/spaces/search-participatory-space';
import { impersonate } from '../domains/users/impersonate';
import { getParticipatorySpace } from '../domains/spaces/get-participatory-space';
import { typedComponents } from '../domains/components/typed-components';
import { organizations } from '../domains/organizations/organizations';
import { organizationExtendedData } from '../domains/organizations/organization-extended-data';
import { roles } from '../domains/roles/roles';
import { searchUsers } from '../domains/users/search-users';
import { createMagicLink } from '../domains/users/create-magic-link';
import { customApiCallAction } from '../actions/custom-api-call';
import { meExtendedData } from '../domains/users/me-extended-data';
import { upsertParticipant } from '../domains/users/upsert-participant';

/** Single import surface for createPiece; keep alphabetical-ish by domain */
export const allActions: Action[] = [
  blogPosts,
  createMagicLink,
  customApiCallAction,
  draftProposals,
  getParticipatorySpace,
  impersonate,
  organizationExtendedData,
  organizations,
  meExtendedData,
  participantCrud,
  proposals,
  roles,
  searchComponent,
  searchParticipatorySpace,
  typedComponents,
  upsertParticipant,
  searchUsers,
];
