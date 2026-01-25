import { Configuration } from '@octree/decidim-sdk';
type AdditionalConfig = {
  baseUrl: string;
} & Record<string, any>;
export function configuration(
  additionalConfig: AdditionalConfig
): Configuration {
  const { baseUrl, ...rest } = additionalConfig;
  return {
    basePath: `${baseUrl}/api/rest_full/v0.2`,
    isJsonMime: () => true,
    ...rest,
  };
}
