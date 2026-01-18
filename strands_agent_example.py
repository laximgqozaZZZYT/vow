"""
Strands Agent Example with OpenAI
"""
import os
from strands import Agent
from strands.models.openai import OpenAIModel
from strands_tools import calculator

# OpenAI モデルの設定
model = OpenAIModel(
    client_args={"api_key": os.environ.get("OPENAI_API_KEY")},
    model_id="gpt-4o-mini",  # コスト効率の良いモデル
)

# エージェントを作成
agent = Agent(
    model=model,
    tools=[calculator],
    system_prompt="あなたは親切な日本語アシスタントです。計算が必要な場合はcalculatorツールを使ってください。"
)

# テスト実行
print("=== Strands Agent with OpenAI ===\n")

# 簡単な質問
response = agent("こんにちは！今日の調子はどうですか？")
print(f"応答1: {response}\n")

# 計算を含む質問（ツールを使用）
response = agent("123 × 456 + 789 を計算してください")
print(f"応答2: {response}\n")

# 会話の継続（コンテキストを記憶）
agent("私の名前は太郎です")
response = agent("私の名前を覚えていますか？")
print(f"応答3: {response}\n")

print("=== 完了 ===")
