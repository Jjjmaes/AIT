总体策略：构建前先预估 token 数，按需切分提交
✅ 一、token 限制构成说明
以 Grok 3 Mini 为例：

最大 token 总数：131072 tokens

包括：

✅ systemPrompt（系统提示词）

✅ userPrompt（你拼接好的 [SEG#]\n... 内容）

✅ AI 回复（即译文输出）

🧠 推荐安全限额（为 AI 回复预留空间）：

模型	最大 tokens	推荐 maxInputTokens（system+user）	留给译文
Grok 3 Mini	131072	✅ 建议控制在 40000 tokens 内	~30,000 tokens
GPT-4o	128,000	✅ 建议控制在 96,000 tokens 内	~32,000 tokens
✅ 二、计算 token 总数（构建阶段）
你可以使用 tiktoken 来评估：

ts
复制
编辑
import { encoding_for_model } from "tiktoken";

const enc = encoding_for_model("gpt-4"); // Grok 目前兼容 GPT tokenizer
const tokenCount = (text) => enc.encode(text).length;

const totalInputTokens = tokenCount(systemPrompt) + tokenCount(userPrompt);
if (totalInputTokens > 100000) {
  // 切段处理
}
✅ 三、自动按 token 拆分（而非固定段数）
你可以这样动态拆批：

ts
复制
编辑
function splitSegmentsByTokenLimit(segments, systemPrompt, maxTokens = 100000) {
  const enc = encoding_for_model("gpt-4");
  const systemTokens = enc.encode(systemPrompt).length;

  let batches = [];
  let currentBatch = [];
  let currentTokens = systemTokens;

  for (let seg of segments) {
    const thisSegText = `[SEG${seg.index}]\n${seg.sourceText}`;
    const thisTokens = enc.encode(thisSegText).length;

    if (currentTokens + thisTokens > maxTokens) {
      batches.push(currentBatch);
      currentBatch = [seg];
      currentTokens = systemTokens + thisTokens;
    } else {
      currentBatch.push(seg);
      currentTokens += thisTokens;
    }
  }

  if (currentBatch.length) {
    batches.push(currentBatch);
  }

  return batches;
}
✅ 四、每一批分别翻译 + 回填
你最终得到：

ts
复制
编辑
const batches = splitSegmentsByTokenLimit(segments, systemPrompt);
for (const batch of batches) {
  const userPrompt = buildSegmentedPrompt(batch);
  const response = await translate(systemPrompt, userPrompt);
  const resultMap = parseTranslatedSegments(response);
  // 回填数据库
}
✅ 总结：构建时如何控制 token 限制？

步骤	操作
✅ 获取系统提示 token 数	tokenCount(systemPrompt)
✅ 拼接用户段落并累加 token	tokenCount([SEG#]\n...)
✅ 控制总 token 不超设定上限	推荐 ≤ 100,000
✅ 自动拆批处理超长内容	保证每批提交都不超限
✅ 为输出预留空间	30,000 ~ 40,000 tokens 安全