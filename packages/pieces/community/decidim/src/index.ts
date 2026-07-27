import { createPiece, PieceCategory } from "@activepieces/pieces-framework";
import { decidimAuth } from "./decidimAuth";
import { allActions } from "./lib/registry/actions";
import { meetingsReminder } from "./lib/triggers/meetings-reminder";
import { proposalPublished } from "./lib/triggers/proposal-published";
import { logoUrl } from "./logo";

export { decidimAuth };

export const decidim = createPiece({
  displayName: "Decidim",
  description: "Decidim is a free open-source participatory democracy framework",
  auth: decidimAuth,
  minimumSupportedRelease: '0.36.1',
  logoUrl,
  categories: [PieceCategory.PRODUCTIVITY],
  authors: ['octree-gva'],
  actions: allActions,
  triggers: [meetingsReminder, proposalPublished],
});
