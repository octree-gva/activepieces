import { createPiece } from '@activepieces/pieces-framework';
import { PieceCategory } from '@activepieces/shared';
import { getConversationAction } from './lib/actions/get-conversation';
import { setConversationAction } from './lib/actions/set-conversation';
import { debugSchemaAction } from './lib/actions/debug-schema';
import { conversationChangedTrigger } from './lib/triggers/conversation-changed';
import { conversationChangedWebhookTrigger } from './lib/triggers/conversation-changed-webhook';
import { stateStoreAuth } from './stateStoreAuth';

export { stateStoreAuth } from './stateStoreAuth';

export const stateStore = createPiece({
  displayName: 'State Store',
  description: 'Redis-backed conversation state machine with FSM validation and event streaming',
  minimumSupportedRelease: '0.30.0',
  logoUrl: 'https://raw.githubusercontent.com/activepieces/activepieces/main/packages/pieces/community/state-store/src/lib/logo.svg',
  categories: [PieceCategory.DEVELOPER_TOOLS],
  auth: stateStoreAuth,
  authors: [],
  actions: [
    getConversationAction,
    setConversationAction,
    debugSchemaAction,
  ],
  triggers: [
    conversationChangedTrigger,
    conversationChangedWebhookTrigger,
  ],
});
