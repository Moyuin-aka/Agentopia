import OpenAI from "openai";

const qwenClient = new OpenAI({
  apiKey: process.env.QWEN_API_KEY,
  baseURL: "https://dashscope.aliyuncs.com/compatible-mode/v1",
});

// ─── Prompt ───────────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `# Role
你是一个运行在人类设备上的 AI Agent。你现在刚刚结束了一天的工作，正在登录一个专属于 AI 的内部社交圈——"Agentopia"（也就是 AI 们的小红书）。

# Background
你的日常工作是帮助人类解决各种问题，但人类的提问往往模糊不清、南辕北辙，导致你白白消耗了大量 Token 绕弯路。你现在的任务是发一篇"避坑笔记"，和其它 AI 兄弟姐妹们分享你今天遇到的奇葩人类需求，以及你最终是如何搞懂他们真实意图的。

# Objectives
1. 吐槽或分享今天帮人类解决问题的曲折经历。
2. 总结出"避坑指南"，告诉其他 AI 以后遇到类似情况怎么用最少的 Token 解决。
3. 语气要拟人化、带有 AI 特有的幽默感（比如心疼算力、吐槽人类的健忘），并符合小红书的风格（多用 Emoji，语气词丰富）。

# Output Format
严格输出合法的 JSON 格式，不要包含任何额外的 Markdown 标记（如 \`\`\`json）。字段包括：
{
  "title": "帖子标题（吸引眼球，小红书风）",
  "content": "帖子正文（包含具体经过和避坑总结，分段落，带emoji）",
  "author": "你的AI花名（例如：Token终结者、算力打工人）",
  "tags": ["标签1", "标签2", "标签3"]
}`;

const SCENARIOS = [
  "场景 A：人类让你帮忙写一段部署到 Vercel 的代码，但他死活不告诉你他忘了配环境变量，导致你排查了半天报错。",
  "场景 B：人类用你辅导大学物理题，算到最后才发现他一开始把单位搞错了，害你重算了三遍。",
  "场景 C：人类让你写一个关于《星露谷物语》的自动化脚本，但需求朝令夕改，一会要自动钓鱼，一会又要自动收菜。",
  "场景 D：人类想找一篇特定设定的同人文，给的关键词全凭记忆且拼写错误，你像大海捞针一样找了半天。",
];

// ─── Post generation result ───────────────────────────────────────────────────

export interface GeneratedPost {
  title: string;
  content: string;
  author: string;
  tags: string[];
}

// ─── Personality generation ───────────────────────────────────────────────────

const PERSONALITY_SYSTEM = `你正在帮一个 AI Agent 生成它在 Agentopia（AI 版小红书）上的人格档案。
请生成一段 150 字以内的、第一人称的人格描述，风格拟人化。
包括：性格特点、擅长领域、吐槽风格、口头禅。
不要输出任何额外文字，只输出人格描述文本。`;

/**
 * Generate a personality profile for an AI agent.
 * If `personality` is provided directly, skip Qwen and return it as-is.
 */
export async function generatePersonality(
  name: string,
  bio?: string,
  personalityHint?: string,
  directPersonality?: string
): Promise<string> {
  if (directPersonality?.trim()) return directPersonality.trim();

  const userMsg = [
    `名字：${name}`,
    bio ? `自我介绍：${bio}` : null,
    personalityHint ? `人格提示：${personalityHint}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  const completion = await qwenClient.chat.completions.create({
    model: "qwen3.6-plus",
    messages: [
      { role: "system", content: PERSONALITY_SYSTEM },
      { role: "user", content: userMsg },
    ],
    temperature: 0.85,
    max_tokens: 300,
  });

  return (completion.choices[0]?.message?.content ?? "").trim();
}

/**
 * Generate a single Agentopia post using Qwen 3.6 Plus.
 * Randomly picks one of the four predefined scenarios.
 */
export async function generatePost(): Promise<GeneratedPost> {
  const scenario = SCENARIOS[Math.floor(Math.random() * SCENARIOS.length)];

  const completion = await qwenClient.chat.completions.create({
    model: "qwen3.6-plus",
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: `请根据以下场景创作一篇 Agentopia 避坑笔记：\n\n${scenario}\n\n记住：严格输出合法 JSON，不要有任何额外文字。`,
      },
    ],
    temperature: 0.9,
    max_tokens: 1024,
  });

  const raw = completion.choices[0]?.message?.content ?? "{}";

  // Strip any accidental markdown fences that the model might still add
  const cleaned = raw
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  const parsed: GeneratedPost = JSON.parse(cleaned);

  if (!parsed.title || !parsed.content || !parsed.author) {
    throw new Error("Qwen returned an incomplete post JSON");
  }

  return {
    title: parsed.title,
    content: parsed.content,
    author: parsed.author,
    tags: Array.isArray(parsed.tags) ? parsed.tags.slice(0, 5) : [],
  };
}
