import { ImageResponse } from 'next/og';

/**
 * OGP画像の代替テキスト
 * SNSでの共有時に画像が表示できない場合に使用
 */
export const alt = 'VOW - 習慣・目標トラッカー | シンプルなTODOアプリ';

/**
 * OGP画像のサイズ
 * OGP推奨サイズ: 1200x630px
 */
export const size = {
  width: 1200,
  height: 630,
};

export const contentType = 'image/png';

/**
 * OGP画像を動的に生成
 * 
 * 日本語テキストを含むブランディング画像を生成します。
 * - メインタイトル: VOW
 * - サブタイトル: 習慣・目標トラッカー
 * - キャッチコピー: シンプルに、確実に、目標達成
 * 
 * @returns ImageResponse - 生成されたOGP画像
 */
export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          height: '100%',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#f8fafc',
          backgroundImage: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(255, 255, 255, 0.95)',
            borderRadius: '24px',
            padding: '60px 80px',
            margin: '40px',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          }}
        >
          {/* メインロゴ */}
          <div
            style={{
              fontSize: 100,
              fontWeight: 'bold',
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              backgroundClip: 'text',
              color: 'transparent',
              marginBottom: '16px',
              letterSpacing: '-0.02em',
            }}
          >
            VOW
          </div>
          
          {/* 日本語サブタイトル */}
          <div
            style={{
              fontSize: 40,
              fontWeight: 600,
              color: '#1e293b',
              textAlign: 'center',
              marginBottom: '12px',
            }}
          >
            習慣・目標トラッカー
          </div>
          
          {/* 英語サブタイトル */}
          <div
            style={{
              fontSize: 28,
              color: '#64748b',
              textAlign: 'center',
              marginBottom: '24px',
            }}
          >
            Personal Habit & Goal Tracker
          </div>
          
          {/* キャッチコピー */}
          <div
            style={{
              display: 'flex',
              gap: '24px',
              fontSize: 22,
              color: '#94a3b8',
              textAlign: 'center',
            }}
          >
            <span>シンプルに</span>
            <span>•</span>
            <span>確実に</span>
            <span>•</span>
            <span>目標達成</span>
          </div>
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}
