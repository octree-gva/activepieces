/** Shape of OAuth token JSON returned by Decidim (client or password grants). */
export type DecidimAccessToken = {
  access_token: string;
  token_type: 'Bearer';
  expires_in: number;
  scope: string;
  created_at: number;
};
