import type { ThreadData, ThreadReply } from "@/types";

const TWITTER_API_BASE = "https://api.twitter.com/2";

interface TweetResponse {
  data: {
    id: string;
    text: string;
    author_id: string;
    created_at: string;
    public_metrics: {
      like_count: number;
      retweet_count: number;
      reply_count: number;
      quote_count: number;
    };
    entities?: {
      urls?: { expanded_url: string }[];
    };
  };
  includes?: {
    users?: { id: string; name: string; username: string }[];
  };
}

interface SearchResponse {
  data?: {
    id: string;
    text: string;
    author_id: string;
    created_at: string;
    entities?: {
      urls?: { expanded_url: string }[];
    };
  }[];
  includes?: {
    users?: { id: string; name: string; username: string }[];
  };
  meta?: {
    next_token?: string;
    result_count: number;
  };
}

export async function scrapeThread(postId: string): Promise<ThreadData> {
  const bearerToken = process.env.TWITTER_BEARER_TOKEN;
  if (!bearerToken) {
    throw new Error("TWITTER_BEARER_TOKEN is not configured");
  }

  const headers = {
    Authorization: `Bearer ${bearerToken}`,
  };

  const tweetUrl = `${TWITTER_API_BASE}/tweets/${postId}?tweet.fields=created_at,public_metrics,entities&expansions=author_id&user.fields=name,username`;

  const tweetRes = await fetch(tweetUrl, { headers });
  if (!tweetRes.ok) {
    const errorBody = await tweetRes.text();
    throw new Error(`Twitter API error (${tweetRes.status}): ${errorBody}`);
  }

  const tweetData: TweetResponse = await tweetRes.json();
  const author = tweetData.includes?.users?.[0];

  const allReplies: ThreadReply[] = [];
  let nextToken: string | undefined;
  let pageCount = 0;
  const MAX_PAGES = 5;

  do {
    const searchParams = new URLSearchParams({
      query: `conversation_id:${postId} -is:retweet`,
      "tweet.fields": "created_at,entities",
      expansions: "author_id",
      "user.fields": "name,username",
      max_results: "100",
    });

    if (nextToken) {
      searchParams.set("next_token", nextToken);
    }

    const searchUrl = `${TWITTER_API_BASE}/tweets/search/recent?${searchParams}`;
    const searchRes = await fetch(searchUrl, { headers });

    if (!searchRes.ok) {
      if (searchRes.status === 429) {
        break;
      }
      const errorBody = await searchRes.text();
      throw new Error(
        `Twitter search API error (${searchRes.status}): ${errorBody}`
      );
    }

    const searchData: SearchResponse = await searchRes.json();

    if (searchData.data) {
      const userMap = new Map<string, { name: string; username: string }>();
      searchData.includes?.users?.forEach((u) =>
        userMap.set(u.id, { name: u.name, username: u.username })
      );

      for (const tweet of searchData.data) {
        const replyAuthor = userMap.get(tweet.author_id);
        const urls =
          tweet.entities?.urls?.map((u) => u.expanded_url) ?? [];

        allReplies.push({
          id: tweet.id,
          text: tweet.text,
          author: replyAuthor?.name ?? "Unknown",
          authorHandle: replyAuthor?.username ?? "unknown",
          createdAt: tweet.created_at,
          urls,
        });
      }
    }

    nextToken = searchData.meta?.next_token;
    pageCount++;
  } while (nextToken && pageCount < MAX_PAGES);

  return {
    originalPost: {
      id: tweetData.data.id,
      text: tweetData.data.text,
      author: author?.name ?? "Unknown",
      authorHandle: author?.username ?? "unknown",
      createdAt: tweetData.data.created_at,
      metrics: {
        likes: tweetData.data.public_metrics.like_count,
        retweets: tweetData.data.public_metrics.retweet_count,
        replies: tweetData.data.public_metrics.reply_count,
      },
    },
    replies: allReplies,
  };
}
