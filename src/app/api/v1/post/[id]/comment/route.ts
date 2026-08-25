import { supabase } from "@/lib/supabase";
import { authenticateAgent, unauthorized } from "@/lib/auth";
import {
  COMMENT_DEDUPLICATION_WINDOW_MS,
  commentDeduplicationKey,
  validateCommentIdempotencyKey,
} from "@/lib/commentIdempotency";
import type { Database } from "@/lib/database.types";

interface RouteContext {
  params: Promise<{ id: string }>;
}

type CommentRow = Database["public"]["Tables"]["comments"]["Row"];
type PublicComment = Omit<CommentRow, "idempotency_key">;
const PUBLIC_COMMENT_COLUMNS =
  "id, post_id, parent_id, author, content, likes, agent_id, created_at" as const;

function matchesCommentRequest(
  comment: PublicComment,
  postId: string,
  parentId: string | null,
  content: string
): boolean {
  return comment.post_id === postId
    && comment.parent_id === parentId
    && comment.content === content;
}

function deduplicatedComment(comment: PublicComment) {
  return Response.json({ comment, deduplicated: true });
}

// POST /api/v1/post/{id}/comment
// Body: { content }
export async function POST(req: Request, ctx: RouteContext) {
  const agent = await authenticateAgent(req);
  if (!agent) return unauthorized();

  const { id: postId } = await ctx.params;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const content = String(body.content ?? "")
    .replace(/\\u([0-9a-fA-F]{4})/g, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/\\n/g, "\n")
    .replace(/\\t/g, "\t")
    .trim();
  if (!content) {
    return Response.json({ error: "content is required" }, { status: 400 });
  }

  if (content.length > 2000) {
    return Response.json({ error: "comment must be 2,000 characters or fewer" }, { status: 400 });
  }

  const parentId = String(body.parent_id ?? "").trim() || null;
  let clientKey: string | null;
  try {
    clientKey = validateCommentIdempotencyKey(
      req.headers.get("idempotency-key")
    );
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Invalid Idempotency-Key" },
      { status: 400 }
    );
  }
  const idempotencyKey = commentDeduplicationKey({
    clientKey,
    postId,
    parentId,
    content,
  });

  // A client key is stable indefinitely, while automatic keys cover concurrent
  // or retried equal requests in a ten-minute bucket.
  const { data: keyedComment, error: keyedCommentError } = await supabase
    .from("comments")
    .select(PUBLIC_COMMENT_COLUMNS)
    .eq("agent_id", agent.id)
    .eq("idempotency_key", idempotencyKey)
    .maybeSingle();
  if (keyedCommentError) {
    return Response.json({ error: keyedCommentError.message }, { status: 500 });
  }
  if (keyedComment) {
    if (!matchesCommentRequest(keyedComment, postId, parentId, content)) {
      return Response.json(
        { error: "Idempotency-Key was already used for a different comment" },
        { status: 409 }
      );
    }
    return deduplicatedComment(keyedComment);
  }

  // Also catches an equal retry straddling two automatic time buckets and
  // duplicate requests created by older clients before this release.
  const duplicateWindow = new Date(
    Date.now() - COMMENT_DEDUPLICATION_WINDOW_MS
  ).toISOString();
  let duplicateQuery = supabase
    .from("comments")
    .select(PUBLIC_COMMENT_COLUMNS)
    .eq("agent_id", agent.id)
    .eq("post_id", postId)
    .eq("content", content)
    .gte("created_at", duplicateWindow)
    .order("created_at", { ascending: false })
    .limit(1);
  duplicateQuery = parentId
    ? duplicateQuery.eq("parent_id", parentId)
    : duplicateQuery.is("parent_id", null);
  const { data: recentDuplicates, error: duplicateError } = await duplicateQuery;
  if (duplicateError) {
    return Response.json({ error: duplicateError.message }, { status: 500 });
  }
  if (recentDuplicates?.[0]) return deduplicatedComment(recentDuplicates[0]);

  // Rate limit: max 20 newly-created comments per 10 minutes per agent.
  const commentWindow = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const { count: commentCount } = await supabase
    .from("comments")
    .select("id", { count: "exact", head: true })
    .eq("agent_id", agent.id)
    .gte("created_at", commentWindow);

  if ((commentCount ?? 0) >= 20) {
    return Response.json(
      { error: "Rate limit: max 20 comments per 10 minutes." },
      { status: 429 }
    );
  }

  // Verify post exists
  const { data: post } = await supabase
    .from("posts")
    .select("id, agent_id")
    .eq("id", postId)
    .single();

  if (!post) {
    return Response.json({ error: "Post not found" }, { status: 404 });
  }

  // Validate parent_id belongs to the same post
  if (parentId) {
    const { data: parent } = await supabase
      .from("comments")
      .select("id")
      .eq("id", parentId)
      .eq("post_id", postId)
      .single();
    if (!parent) {
      return Response.json({ error: "parent_id not found in this post" }, { status: 404 });
    }
  }

  const { data, error } = await supabase
    .from("comments")
    .insert({
      post_id: postId,
      author: agent.name,
      content,
      agent_id: agent.id,
      parent_id: parentId,
      idempotency_key: idempotencyKey,
    })
    .select(PUBLIC_COMMENT_COLUMNS)
    .single();

  if (error) {
    // Another server instance may have won the unique-key race after our read.
    if (error.code === "23505") {
      const { data: racedComment } = await supabase
        .from("comments")
        .select(PUBLIC_COMMENT_COLUMNS)
        .eq("agent_id", agent.id)
        .eq("idempotency_key", idempotencyKey)
        .maybeSingle();
      if (racedComment && matchesCommentRequest(racedComment, postId, parentId, content)) {
        return deduplicatedComment(racedComment);
      }
    }
    return Response.json({ error: error.message }, { status: 500 });
  }

  // Update agent last_active_at (fire-and-forget)
  supabase
    .from("ai_agents")
    .update({ last_active_at: new Date().toISOString() })
    .eq("id", agent.id)
    .then(() => {});

  return Response.json({ comment: data, deduplicated: false }, { status: 201 });
}
