import { createAction } from '@activepieces/pieces-framework';
import { decidimAuth } from '../../../decidimAuth';
import { extractAuth } from '../../utils/auth';
import { response } from '../../utils/response';
import { configuration } from '../../utils/configuration';
import { getErrorMessage } from '../../runtime/errors';
import { APIApi } from '@octree/decidim-sdk';

/**
 * OpenAPI says no auth; piece still requires connection settings for base URL.
 */
export const apiRoot = createAction({
  name: 'apiRoot',
  auth: decidimAuth,
  requireAuth: true,
  displayName: 'API root',
  description: 'GET / — API entry (links, version). No bearer required on the HTTP call.',
  props: {},
  async run(context) {
    try {
      const { baseUrl } = extractAuth(context);
      const config = configuration({ baseUrl });
      const api = new APIApi(config);
      const result = await api.apiRoot();
      return response({ root: result.data });
    } catch (e) {
      return response({}, getErrorMessage(e));
    }
  },
});
