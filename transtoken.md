
✅ 整体流程概述
mermaid

graph TD
收到前端，信息，项目编号，文件，提示词 AI 类型
A[1. 从 MongoDB 提取待翻译段落] --> B[2. 生成带 SEG 标记的提交文本]
C --> D[4. 调用 AI 接口进行翻译]
D --> E[5. 解析返回的译文段落]
E --> F[6. 按 index 回填 translation 字段到 MongoDB]
✅ 第 1 步：从 MongoDB 提取段落
你 MongoDB 的结构已具备如下字段：

ts

{
  fileId: ObjectId,     // 同一文档的标识
  index: Number,        // 每个段落的序号
  sourceText: String,   // 原文
  translation: String,  // 译文（待填充）
  status: "pending" | "translated",
  ...
}
提取段落代码：
ts

const segments = await db.collection('segments')
  .find({ fileId, status: 'pending' })
  .sort({ index: 1 }) // 保证顺序
  .toArray();
✅ 第 2 步：生成带段落标记的翻译文本
构造提交内容（用于 user prompt）：
ts

function buildSegmentedPrompt(segments) {
  return segments.map(s => `[SEG${s.index}]\n${s.sourceText}`).join('\n\n');
}
✅ 第 3 步：构建提示词（system message）
ts

function buildSystemPrompt(sourceLang = "Chinese", targetLang = "English") {
  return `
You are a professional translator. Translate the following text from ${sourceLang} to ${targetLang}.
Each segment is marked with [SEG#].

Important rules:
- Do not merge, remove, or reorder segments.
- Do not change the [SEG#] tags.
- Format output exactly as: [SEG#]\\nTranslated text
- Only translate.

Example:

[SEG1]
产品名称

[SEG2]
注册证编号

Expected output:

[SEG1]
Product Name

[SEG2]
Registration Certificate Number
`.trim();
}
✅ 第 4 步：调用 AI 翻译接口（以 Grok 为例）
ts

const response = await axios.post(process.env.GROK_API_URL, {
  model: process.env.MODEL,
  messages: [
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt }
  ]
}, {
  headers: {
    Authorization: `Bearer ${process.env.GROK_API_KEY}`,
    'Content-Type': 'application/json'
  }
});
✅ 第 5 步：解析返回的多段翻译内容
ts

function parseTranslatedSegments(outputText) {
  const result = {};
  const regex = /\[SEG(\d+)\]\s*([\s\S]*?)(?=\n\[SEG|\n*$)/g;
  let match;
  while ((match = regex.exec(outputText)) !== null) {
    const index = parseInt(match[1], 10);
    const translation = match[2].trim();
    result[index] = translation;
  }
  return result;
}
✅ 第 6 步：按 index 回填 MongoDB 中的译文字段
ts

for (const seg of segments) {
  const translated = parsedMap[seg.index];
  if (translated) {
    await db.collection('segments').updateOne(
      { _id: seg._id },
      {
        $set: {
          translation: translated,
          translatedLength: translated.length,
          status: 'translated',
          updatedAt: new Date()
        }
      }
    );
  }
}
✅ 可选：自动拆分段落超 token 限制
如果段落太多导致 prompt 超出 token 限制，可以用以下方式拆批处理：

ts

function chunkArray(arr, maxPerBatch = 50) {
  const result = [];
  for (let i = 0; i < arr.length; i += maxPerBatch) {
    result.push(arr.slice(i, i + maxPerBatch));
  }
  return result;
}
✅ 封装为完整函数（可直接调用）
ts

async function translateSegmentsByFileId(fileId, db) {
  const segments = await db.collection('segments')
    .find({ fileId, status: 'pending' })
    .sort({ index: 1 })
    .toArray();

  if (!segments.length) return;

  const systemPrompt = buildSystemPrompt();
  const userPrompt = buildSegmentedPrompt(segments);

  const response = await axios.post(process.env.GROK_API_URL, {
    model: process.env.MODEL,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ]
  }, {
    headers: {
      Authorization: `Bearer ${process.env.GROK_API_KEY}`,
      'Content-Type': 'application/json'
    }
  });

  const translatedMap = parseTranslatedSegments(response.data.choices?.[0]?.message?.content || '');

  for (const seg of segments) {
    const translation = translatedMap[seg.index];
    if (translation) {
      await db.collection('segments').updateOne(
        { _id: seg._id },
        {
          $set: {
            translation,
            translatedLength: translation.length,
            status: 'translated',
            updatedAt: new Date()
          }
        }
      );
    }
  }
}
✅ 结果效果示意

index	sourceText	translation
18	更改人	Changed by
19	确认人	Confirmed by
20	版本号	Version No.
