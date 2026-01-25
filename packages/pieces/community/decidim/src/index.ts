import { createPiece, PieceAuth } from "@activepieces/pieces-framework";
import { decidimAuth } from "./decidimAuth";
import { createMagicLink } from "./lib/actions/create-magic-link";
import { blogCrud } from "./lib/actions/blog-crud";
import { participantCrud } from "./lib/actions/participant-crud";
import { proposalCrud } from "./lib/actions/proposal-crud";
import { searchComponent } from "./lib/actions/search-component";
import { searchParticipatorySpace } from "./lib/actions/search-participatory-space";
import { impersonate } from "./lib/actions/impersonate";
import { meetingsReminder } from "./lib/triggers/meetings-reminder";
import { proposalPublished } from "./lib/triggers/proposal-published";
import { logoUrl } from "./logo";

export const decidim = createPiece({
  displayName: "Decidim",
  description: "Decidim is a free open-source participatory democracy framework",
  auth: decidimAuth,
  minimumSupportedRelease: '0.36.1',
  logoUrl,
  authors: [],
  actions: [createMagicLink, blogCrud, participantCrud, proposalCrud, searchComponent, searchParticipatorySpace, impersonate
  ],
  triggers: [meetingsReminder, proposalPublished],
});
