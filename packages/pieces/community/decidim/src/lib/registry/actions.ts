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
import { oauthIntrospect } from '../domains/oauth/oauth-introspect';
import { apiRoot } from '../domains/api/api-root';
import { usersList } from '../domains/users/users-list';
import { createMagicLink } from '../domains/users/create-magic-link';
import { magicLinkSignin } from '../domains/users/magic-link-signin';
import { meExtendedData } from '../domains/users/me-extended-data';
import { oauthRequestToken } from '../domains/oauth/oauth-request-token';
import { upsertParticipant } from '../domains/users/upsert-participant';

/** Single import surface for createPiece; keep alphabetical-ish by domain */
export const allActions: Action[] = [
  apiRoot,
  blogPosts,
  createMagicLink,
  draftProposals,
  getParticipatorySpace,
  impersonate,
  oauthIntrospect,
  oauthRequestToken,
  organizationExtendedData,
  organizations,
  magicLinkSignin,
  meExtendedData,
  participantCrud,
  proposals,
  roles,
  searchComponent,
  searchParticipatorySpace,
  typedComponents,
  upsertParticipant,
  usersList,
];
