import { createAction, Property } from '@activepieces/pieces-framework';
import { z } from 'zod';
import { decidimAuth } from '../../../decidimAuth';
import { extractAuth } from '../../utils/auth';
import { response } from '../../utils/response';
import { bearerAuthorization, resolveAuthContext } from '../../runtime/authMode';
import { getErrorMessage } from '../../runtime/errors';
import { createSpacesApi } from '../../runtime/clients';
import { localesProp, userAccessTokenProp } from '../../props';
import { parseLocales } from '../../runtime/locales';
import type {
  SpacesApiAssembliesRequest,
  SpacesApiConferencesRequest,
  SpacesApiInitiativesRequest,
  SpacesApiParticipatoryProcessesRequest,
} from '@octree/decidim-sdk';
import type { DecidimSingleResource } from '../../types/decidim-api';

export const getParticipatorySpace = createAction({
  name: 'getParticipatorySpace',
  auth: decidimAuth,
  requireAuth: true,
  displayName: 'Get participatory space',
  description: 'GET one space by type and id (/spaces/{manifest}/{id})',
  props: {
    accessToken: userAccessTokenProp(false),
    spaceType: Property.StaticDropdown({
      displayName: 'Space type',
      required: true,
      options: {
        options: [
          { label: 'Participatory process', value: 'participatory_processes' },
          { label: 'Assembly', value: 'assemblies' },
          { label: 'Conference', value: 'conferences' },
          { label: 'Initiative', value: 'initiatives' },
        ],
      },
    }),
    spaceId: Property.Number({
      displayName: 'Space ID',
      required: true,
      description: 'Participatory space numeric id',
    }),
    locales: localesProp(false),
  },
  async run(context) {
    try {
      const { baseUrl, clientId, clientSecret } = extractAuth(context);
      const resolved = await resolveAuthContext({
        baseUrl,
        clientId,
        clientSecret,
        props: context.propsValue,
      });
      const api = createSpacesApi(resolved.baseConfiguration, resolved.rawAccessToken);
      const auth = bearerAuthorization(resolved.rawAccessToken);
      const id = z.number().int().positive().parse(context.propsValue.spaceId);
      const t = context.propsValue.spaceType as string;
      const loc = parseLocales(context.propsValue.locales);

      const base = { id, authorization: auth, locales: loc };
      let result;
      switch (t) {
        case 'participatory_processes': {
          const req: SpacesApiParticipatoryProcessesRequest = base;
          result = await api.participatoryProcesses(req);
          break;
        }
        case 'assemblies': {
          const req: SpacesApiAssembliesRequest = base;
          result = await api.assemblies(req);
          break;
        }
        case 'conferences': {
          const req: SpacesApiConferencesRequest = base;
          result = await api.conferences(req);
          break;
        }
        case 'initiatives': {
          const req: SpacesApiInitiativesRequest = base;
          result = await api.initiatives(req);
          break;
        }
        default:
          return response({}, `Unknown space type: ${t}`);
      }

      const data = (result.data as DecidimSingleResource<unknown> | undefined)?.data;
      return response({
        space: data,
        space_id: String(id),
        space_type: t,
        auth_mode: resolved.mode,
      });
    } catch (e) {
      return response({}, getErrorMessage(e));
    }
  },
});
