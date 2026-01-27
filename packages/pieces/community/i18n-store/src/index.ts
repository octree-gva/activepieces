import { PieceAuth, createPiece } from '@activepieces/pieces-framework';
import { PieceCategory } from '@activepieces/shared';
import { configureAction } from './lib/actions/configure';
import { translateAction } from './lib/actions/translate';
import { settingsAction } from './lib/actions/settings';

export const i18nStore = createPiece({
  displayName: 'i18n Store',
  description: 'Manage i18n translations locally using i18next',
  minimumSupportedRelease: '0.30.0',
  logoUrl: "https://raw.githubusercontent.com/octree-gva/activepieces/refs/heads/packages/octree/packages/pieces/community/i18n-store/src/logo.svg",
  categories: [PieceCategory.DEVELOPER_TOOLS],
  auth: PieceAuth.None(),
  authors: [],
  actions: [configureAction, translateAction, settingsAction],
  triggers: [],
});
