import { ImageResponse } from 'next/og';

// Image metadata
export const alt = 'VOW - Your Personal Habit & Goal Tracker';
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = 'image/png';

// Image generation
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
            padding: '80px',
            margin: '40px',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          }}
        >
          <div
            style={{
              fontSize: 120,
              fontWeight: 'bold',
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              backgroundClip: 'text',
              color: 'transparent',
              marginBottom: '20px',
            }}
          >
            VOW
          </div>
          <div
            style={{
              fontSize: 36,
              color: '#64748b',
              textAlign: 'center',
              maxWidth: '800px',
              lineHeight: 1.4,
            }}
          >
            Your Personal Habit & Goal Tracker
          </div>
          <div
            style={{
              fontSize: 24,
              color: '#94a3b8',
              textAlign: 'center',
              marginTop: '20px',
            }}
          >
            Track progress • Build habits • Achieve goals
          </div>
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}