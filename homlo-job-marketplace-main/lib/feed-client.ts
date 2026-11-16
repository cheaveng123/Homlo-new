import { createFeedClient, type FeedClient, type ViewerParams, type PageParams } from '@/backend/feed/lynx_feed_client';
import { getApiBaseUrl } from '@/constants/oauth';
import * as Auth from '@/lib/_core/auth';
import { useMemo } from 'react';

let feedClientInstance: FeedClient | null = null;

function resolveFeedBaseUrl(): string {
  return getApiBaseUrl() || 'http://localhost:3000';
}

export function getFeedClient(): FeedClient {
  if (!feedClientInstance) {
    feedClientInstance = createFeedClient({
      baseUrl: resolveFeedBaseUrl(),
      getHeaders: async (): Promise<Record<string, string>> => {
        const token = await Auth.getSessionToken();
        const headers: Record<string, string> = {};
        if (token) headers.Authorization = `Bearer ${token}`;
        return headers;
      },
    });
  }
  return feedClientInstance;
}

export function useFeedClient(): FeedClient {
  return useMemo(() => getFeedClient(), []);
}

export type { ViewerParams, PageParams, FeedClient };