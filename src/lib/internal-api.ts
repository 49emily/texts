/**
 * Internal API Client
 * Provides access to user histories and raw context data
 */

const BASE_URL = "https://wdf7zt4d64.execute-api.us-east-1.amazonaws.com";

// ============================================================================
// Type Definitions
// ============================================================================

export interface Auth {
  phone_number: string;
  api_key: string;
}

export type BlockScope = "self" | "network";

export interface BlockFilters {
  data_source_names?: string[];
  data_source_categories?: string[];
  phone_numbers?: string[];
  is_liked?: boolean;
}

export interface UserInfo {
  user_id: string;
  first_name: string;
  last_name: string;
  profile_picture: string | null;
}

export interface ThumbnailInfo {
  url: string;
}

export interface AudioInfo {
  url: string;
}

export interface VideoData {
  video_hash: string;
  width: number;
  height: number;
  duration_seconds: number;
  aspect_ratio_numerator: number;
  aspect_ratio_denominator: number;
  format: string;
  cloudfront_url: string;
  starting_frame_url: string;
}

export interface VideoInfo {
  data: VideoData;
}

export interface TextInfo {
  short_title: string;
  long_title: string;
  description: string;
}

export interface MediaDisplay {
  thumbnail: ThumbnailInfo;
  audio: AudioInfo | null;
  video: VideoInfo | null;
  text: TextInfo;
}

export interface MediaMetadata {
  media_id: string;
  creator: string | null;
  collection_title: string | null;
  tags: string[] | null;
}

export interface MediaInfo {
  display: MediaDisplay;
  data_source_name: string;
  data_source_category: string;
  metadata: MediaMetadata | null;
}

export interface EngagementInfo {
  count: number;
  first_engaged_at: string;
  last_engaged_at: string;
  is_liked: boolean;
  liked_at: string | null;
}

export interface HistoryItem {
  id: string;
  user_info: UserInfo;
  media_info: MediaInfo;
  engagement_info: EngagementInfo;
}

export interface Cursor {
  limit: number;
  timestamp: string | null;
  id: string | null;
  descending: boolean;
}

export interface GetInternalHistoriesRequest {
  auth: Auth;
  scope?: BlockScope;
  filters?: BlockFilters;
  descending?: boolean;
  limit?: number;
  id?: string;
  timestamp?: string;
}

export interface GetInternalHistoriesResponse {
  items: HistoryItem[];
  cursor: Cursor | null;
}

// ============================================================================
// API Functions
// ============================================================================

/**
 * Fetch user engagement histories with filtering and pagination
 *
 * @param request - Request parameters including auth, filters, and pagination
 * @returns Response containing history items and cursor for pagination
 *
 * @example
 * ```typescript
 * const response = await getInternalHistories({
 *   auth: {
 *     phone_number: "+12345678901",
 *     api_key: "your-api-key-here"
 *   },
 *   scope: "self",
 *   filters: {
 *     data_source_categories: ["music", "video"],
 *     is_liked: true
 *   },
 *   limit: 20
 * });
 * ```
 */
export async function getInternalHistories(
  request: GetInternalHistoriesRequest
): Promise<GetInternalHistoriesResponse> {
  const response = await fetch(`${BASE_URL}/v1/recsys/internal/histories`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ detail: "Unknown error" }));
    throw new Error(
      `API Error (${response.status}): ${error.detail || response.statusText}`
    );
  }

  return response.json();
}

/**
 * Fetch all histories by automatically paginating through results
 *
 * @param request - Request parameters (pagination params will be managed automatically)
 * @param maxPages - Maximum number of pages to fetch (default: unlimited)
 * @returns Array of all history items
 *
 * @example
 * ```typescript
 * const allHistories = await getAllInternalHistories({
 *   auth: {
 *     phone_number: "+12345678901",
 *     api_key: "your-api-key-here"
 *   },
 *   filters: {
 *     data_source_categories: ["music"]
 *   }
 * });
 * ```
 */
export async function getAllInternalHistories(
  request: GetInternalHistoriesRequest,
  maxPages?: number
): Promise<HistoryItem[]> {
  const allItems: HistoryItem[] = [];
  let cursor: Cursor | null = null;
  let pageCount = 0;

  do {
    const response = await getInternalHistories({
      ...request,
      ...(cursor?.timestamp && { timestamp: cursor.timestamp }),
      ...(cursor?.id && { id: cursor.id }),
    });

    allItems.push(...response.items);
    cursor = response.cursor;
    pageCount++;

    if (maxPages && pageCount >= maxPages) {
      break;
    }
  } while (cursor);

  return allItems;
}
