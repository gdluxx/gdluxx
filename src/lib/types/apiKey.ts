export interface ApiKey {
  id: string;
  name: string;
  hashedKey: string;
  createdAt: string;
}

export interface NewApiKeyResponse {
  apiKey: ApiKey;
  plainKey: string;
}
