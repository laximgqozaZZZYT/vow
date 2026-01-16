import { useHandedness } from '../contexts/HandednessContext';

export default function HandednessToggle() {
  const { handedness, setHandedness, isLeftHanded } = useHandedness();

  // ハンバーガーメニューの対角位置に配置
  // ハンバーガーメニューは左上（または利き手が左の場合は右上）
  // なので、このボタンは右下（または利き手が左の場合は左下）
  const positionClass = isLeftHanded ? 'left-6' : 'right-6';

  return (
    <button
      onClick={() => setHandedness(handedness === 'left' ? 'right' : 'left')}
      className={`fixed bottom-6 ${positionClass} z-40 group inline-flex items-center justify-center gap-2 rounded-xl border border-border/50 bg-background/95 backdrop-blur-sm shadow-lg hover:shadow-xl px-4 py-3 text-sm font-medium transition-all duration-200 hover:bg-accent hover:border-border hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2`}
      title={`Switch to ${isLeftHanded ? 'right' : 'left'}-handed mode`}
      aria-label={`Switch to ${isLeftHanded ? 'right' : 'left'}-handed mode`}
    >
      <svg 
        className="w-4 h-4 transition-transform group-hover:scale-110" 
        fill="none" 
        stroke="currentColor" 
        viewBox="0 0 24 24"
      >
        {isLeftHanded ? (
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16l-4-4m0 0l4-4m-4 4h18" />
        ) : (
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
        )}
      </svg>
      <span className="hidden sm:inline font-medium">{isLeftHanded ? 'Left' : 'Right'}</span>
      <span className="text-xs text-muted-foreground hidden md:inline">Panel</span>
    </button>
  );
}
