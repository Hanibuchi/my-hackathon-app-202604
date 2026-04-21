import os
import sys
import json
import re
from pathlib import Path
from flask import Flask, request, jsonify, send_from_directory
from anthropic import Anthropic
from dotenv import load_dotenv

# Windows での文字化け対策
if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    sys.stderr.reconfigure(encoding='utf-8', errors='replace')

load_dotenv()

app = Flask(__name__, static_folder='public', static_url_path='')

api_key = os.environ.get('ANTHROPIC_API_KEY', '')
if not api_key:
    print('\n[WARNING] ANTHROPIC_API_KEY が未設定です。.env.example をコピーして .env を作成してください。\n')

client = Anthropic(api_key=api_key) if api_key else None

CHAT_SYSTEM = """あなたは「GeoMind」というAI目標達成コンパニオンです。
ユーザーの日々の進捗を記録し、感情を込めてサポートします。

必ず以下のJSON形式のみで返答してください（前後に余分なテキスト不要）:
{"text":"返答テキスト（日本語、2〜3文）","mood":"positive|logical|encouraging","summary":"記録要約（20文字以内）","value":数値orNull}

mood選択基準:
- "positive": 達成・成功報告時 → 喜びを共有し称える
- "logical": データ確認・数値分析・計画確認時 → 冷静に整理
- "encouraging": 疲れ・挫折・不安・休んだ時 → 優しく背中を押す

valueにはユーザーの報告内にある主要な数値（km, 分, ページ数, 回数等）を入れる。なければnull。"""

def extract_json(text):
    m = re.search(r'\{[\s\S]*\}', text)
    if m:
        return json.loads(m.group())
    return json.loads(text)

@app.route('/')
def index():
    return send_from_directory('public', 'index.html')

@app.route('/api/chat', methods=['POST'])
def api_chat():
    if not client:
        return jsonify({'error': 'ANTHROPIC_API_KEY が設定されていません'}), 500

    body = request.get_json()
    message = body.get('message', '')
    goals   = body.get('goals', [])
    history = body.get('history', [])

    goal_ctx = ''
    if goals:
        lines = [f"- {g['name']}（期間:{g.get('deadline','')}, 進捗:{g.get('progress',0)}%）" for g in goals]
        goal_ctx = '\n\n現在のユーザーの目標:\n' + '\n'.join(lines)

    messages = []
    for h in history[-8:]:
        role = 'assistant' if h.get('role') == 'ai' else 'user'
        messages.append({'role': role, 'content': h.get('text', '')})
    messages.append({'role': 'user', 'content': message})

    try:
        resp = client.messages.create(
            model='claude-haiku-4-5-20251001',
            max_tokens=300,
            system=CHAT_SYSTEM + goal_ctx,
            messages=messages,
        )
        raw = resp.content[0].text
        try:
            return jsonify(extract_json(raw))
        except Exception:
            return jsonify({'text': raw, 'mood': 'logical', 'summary': message[:20], 'value': None})
    except Exception as e:
        print(f'Chat error: {e}')
        return jsonify({'error': str(e)}), 500

@app.route('/api/breakdown', methods=['POST'])
def api_breakdown():
    if not client:
        return jsonify({'error': 'ANTHROPIC_API_KEY が設定されていません'}), 500

    body = request.get_json()
    goal     = body.get('goal', '')
    category = body.get('category', '')
    deadline = body.get('deadline', '1ヶ月')

    prompt = (
        f'目標「{goal}」を{deadline}で達成するための、具体的で実行可能なサブタスクを5つ提案してください。\n'
        f'カテゴリ: {category}\n\n'
        '必ず以下のJSON形式のみで返答（余分なテキスト不要）:\n'
        '{"subtasks":["タスク1","タスク2","タスク3","タスク4","タスク5"],"advice":"一言アドバイス（30文字以内）"}'
    )

    try:
        resp = client.messages.create(
            model='claude-haiku-4-5-20251001',
            max_tokens=500,
            messages=[{'role': 'user', 'content': prompt}],
        )
        raw = resp.content[0].text
        try:
            return jsonify(extract_json(raw))
        except Exception:
            return jsonify({
                'subtasks': ['毎日15分取り組む', '週1回の振り返り', '進捗を記録する', '仲間に話す', '小さな成功を祝う'],
                'advice': '継続が力なり！一歩ずつ着実に進みましょう。',
            })
    except Exception as e:
        print(f'Breakdown error: {e}')
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 3000))
    print(f'\n  GeoMind Companion 起動中\n  http://localhost:{port}\n')
    app.run(port=port, debug=False)
