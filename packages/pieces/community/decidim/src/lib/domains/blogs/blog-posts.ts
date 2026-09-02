import {
  createAction,
  Property,
  InputPropertyMap,
} from '@activepieces/pieces-framework';
import { propsValidation } from '@activepieces/pieces-common';
import { z } from 'zod';
import { decidimAuth } from '../../../decidimAuth';
import { extractAuth } from '../../utils/auth';
import { response } from '../../utils/response';
import { asBlogsApiBlogRequest, asBlogsApiBlogsRequest } from '../../runtime/sdk-casts';
import { assertProp } from '../../utils/assertProp';
import { resolveAuthContext } from '../../runtime/authMode';
import { getErrorMessage } from '../../runtime/errors';
import { createBlogsApi } from '../../runtime/clients';
import {
  blogPostIdProp,
  decidimComponentIdProp,
  userAccessTokenProp,
} from '../../props';
import { buildBlogReadRequest, buildBlogsListRequest } from './blog-posts.helpers';
import { computeHasMore } from '../components/search-component.helpers';

export const blogPosts = createAction({
  name: 'blogPosts',
  auth: decidimAuth,
  requireAuth: true,
  displayName: 'Blog',
  description: 'Search or read Decidim blog posts',
  props: {
    accessToken: userAccessTokenProp(false),
    action: Property.StaticDropdown({
      displayName: 'Action',
      description: 'The action to perform',
      required: true,
      options: {
        options: [
          { label: 'Search', value: 'search' },
          { label: 'Read', value: 'read' },
        ],
      },
    }),
    searchOptions: Property.DynamicProperties({
      auth: decidimAuth,
      displayName: 'Search Options',
      description: 'Options for searching blog posts',
      required: false,
      refreshers: ['action'],
      props: async ({ action }: Record<string, unknown>): Promise<InputPropertyMap> => {
        if (action !== 'search') return {};
        return {
          componentId: decidimComponentIdProp(true),
        };
      },
    }),
    readOptions: Property.DynamicProperties({
      auth: decidimAuth,
      displayName: 'Read Options',
      description: 'Options for reading a blog post',
      required: false,
      refreshers: ['action'],
      props: async ({ action }: Record<string, unknown>): Promise<InputPropertyMap> => {
        if (action !== 'read') return {};
        return {
          blogPostId: blogPostIdProp(true),
        };
      },
    }),
  },
  async run(context) {
    try {
      const { baseUrl, clientId, clientSecret } = extractAuth(context);
      const action = context.propsValue.action;

      const resolved = await resolveAuthContext({
        baseUrl,
        clientId,
        clientSecret,
        props: context.propsValue,
      });
      const blogsApi = createBlogsApi(
        resolved.baseConfiguration,
        resolved.rawAccessToken
      );
      const accessToken = resolved.rawAccessToken;

      if (action === 'search') {
        const searchOptions =
          (context.propsValue['searchOptions'] as Record<string, unknown>) || {};
        assertProp(searchOptions['componentId'], 'Component ID is required for Search');
        await propsValidation.validateZod(searchOptions, {
          componentId: z.number().int().positive(),
        });

        const { request, effectivePerPage } = buildBlogsListRequest({
          accessToken,
          searchOptions,
        });

        const result = await blogsApi.listBlogPosts(asBlogsApiBlogsRequest(request));
        const posts =
          (result.data as { data?: unknown[] } | undefined)?.data ?? [];
        const list = Array.isArray(posts) ? posts : [];
        const has_more = computeHasMore(list.length, effectivePerPage);
        return response({
          posts: list,
          count: list.length,
          has_more,
        });
      }

      if (action === 'read') {
        const readOptions =
          (context.propsValue['readOptions'] as Record<string, unknown>) || {};
        assertProp(readOptions['blogPostId'], 'Blog post ID is required for Read');
        await propsValidation.validateZod(readOptions, {
          blogPostId: z.number().int().positive(),
        });

        const request = buildBlogReadRequest({
          accessToken,
          readOptions,
        });

        const result = await blogsApi.getBlogPost(asBlogsApiBlogRequest(request));
        const data = (result.data as { data?: unknown } | undefined)?.data;
        return response({ post: data });
      }

      return response({}, `Unknown action: ${String(action)}`);
    } catch (error) {
      return response({}, getErrorMessage(error));
    }
  },
});
