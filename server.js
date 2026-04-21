require('dotenv').config();
const express = require('express');
const Anthropic = require('@anthropic-ai/sdk');
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

if (!process.env.ANTHROPIC_API_KEY) {
  console.warn('\n⚠  ANTHROPIC_API_KEY が未設定です。.env.example をコピーして .env を作成してください。\n');
}

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || 'dummy' });

const CHAT_SYSTEM = `あなたは「GeoMind」というAI目標達成コンパニオンです。
ユーザーの日々の進捗を記録し、感情を込めてサポートします。

必ず以下のJSON形式のみで返答してください（前後に余分なテキスト不要）:
{"text":"返答テキスト（日本語、2〜3文）","mood":"positive|logical|encouraging","summary":"記録要約（20文字以内）","value":数値orNull}

mood選択基準:
- "positive": 達成・成功報告時 → 喜びを共有し称える
- "logical": データ確認・数値分析・計画確認時 → 冷静に整理
- "encouraging": 疲れ・挫折・不安・休んだ時 → 優しく背中を押す

valueにはユーザーの報告内にある主要な数値（km, 分, ページ数, 回数等）を入れる。なければnull。`;

app.post('/api/chat', async (req, res) => {
  try {
    const { message, goals = [], history = [] } = req.body;
    const goalCtx = goals.length
      ? '\n\n現在のユーザーの目標:\n' + goals.map(g => `- ${g.name}（期間:${g.days}, 進捗:${g.progress}%）`).join('\n')
      : '';

    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 300,
      system: CHAT_SYSTEM + goalCtx,
      messages: [
        ...history.slice(-8).map(h => ({
          role: h.role === 'ai' ? 'assistant' : 'user',
          content: h.text,
        })),
        { role: 'user', content: message },
      ],
    });

    const raw = response.content[0].text;
    try {
      const m = raw.match(/\{[\s\S]*\}/);
      res.json(JSON.parse(m ? m[0] : raw));
    } catch {
      res.json({ text: raw, mood: 'logical', summary: message.slice(0, 20), value: null });
    }
  } catch (err) {
    console.error('Chat error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/breakdown', async (req, res) => {
  try {
    const { goal, category, deadline } = req.body;

    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 500,
      messages: [{
        role: 'user',
        content: `目標「${goal}」を${deadline}で達成するための、具体的で実行可能なサブタスクを5つ提案してください。\nカテゴリ: ${category}\n\n必ず以下のJSON形式のみで返答（余分なテキスト不要）:\n{"subtasks":["タスク1","タスク2","タスク3","タスク4","タスク5"],"advice":"一言アドバイス（30文字以内）"}`,
      }],
    });

    const raw = response.content[0].text;
    try {
      const m = raw.match(/\{[\s\S]*\}/);
      res.json(JSON.parse(m ? m[0] : raw));
    } catch {
      res.json({
        subtasks: ['毎日15分取り組む', '週1回の振り返りノート', '進捗を記録する', '仲間に話す', '小さな成功を祝う'],
        advice: '継続が力なり！一歩ずつ進もう。',
      });
    }
  } catch (err) {
    console.error('Breakdown error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n  ✦ GeoMind Companion 起動中\n  → http://localhost:${PORT}\n`);
});
