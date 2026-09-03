import { createAction, Property } from '@activepieces/pieces-framework';
import { z } from 'zod';
import { decidimAuth } from '../../../decidimAuth';
import { extractAuth } from '../../utils/auth';
import { response } from '../../utils/response';
import { bearerAuthorization, resolveAuthContext } from '../../runtime/authMode';
import { getErrorMessage } from '../../runtime/errors';
import { createSpacesApi } from '../../runtime/clients';
import { hostProp, localesProp, userAccessTokenProp } from '../../props';
import { parseLocales } from '../../runtime/locales';
import type {
  SpacesApiShowAssemblyRequest,
  SpacesApiShowConferenceRequest,
  SpacesApiShowInitiativeRequest,
  SpacesApiShowParticipatoryProcessRequest,
} from '@octree/decidim-sdk';
import type { DecidimSingleResource } from '../../types/decidim-api';

export const getParticipatorySpace = createAction({
  name: 'getParticipatorySpace',
  auth: decidimAuth,
  requireAuth: true,
  displayName: 'Get participatory space',
  description: 'GET one space by type and id (/spaces/{manifest}/{id})',
  props: {
    host: hostProp(),
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
          const req: SpacesApiShowParticipatoryProcessRequest = base;
          result = await api.showParticipatoryProcess(req);
          break;
        }
        case 'assemblies': {
          const req: SpacesApiShowAssemblyRequest = base;
          result = await api.showAssembly(req);
          break;
        }
        case 'conferences': {
          const req: SpacesApiShowConferenceRequest = base;
          result = await api.showConference(req);
          break;
        }
        case 'initiatives': {
          const req: SpacesApiShowInitiativeRequest = base;
          result = await api.showInitiative(req);
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
