import { Configuration } from '@octree/decidim-sdk';
type AdditionalConfig = {
  baseUrl: string;
} & Record<string, unknown>;
export function configuration(
  additionalConfig: AdditionalConfig
): Configuration {
  const { baseUrl, ...rest } = additionalConfig;
  const normalizedBaseUrl = baseUrl.replace(/\/$/, '');
  return {
    basePath: `${normalizedBaseUrl}/api/rest_full/v0.3`,
    isJsonMime: () => true,
    ...rest,
  };
}
