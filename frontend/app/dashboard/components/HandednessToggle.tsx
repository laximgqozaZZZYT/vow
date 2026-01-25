import { useHandedness } from '../contexts/HandednessContext';

export default function HandednessToggle() {
  const { handedness, setHandedness, isLeftHanded } = useHandedness();

  // ハンバーガーメニューの対角位置に配置
  // ハンバーガーメニューは左上（または利き手が左の場合は右上）
  // なので、このボタンは右下（または利き手が左の場合は左下）
  const positionClass = isLeftHanded ? 'left-4' : 'right-4';

  return (
    <button
      onClick={() => setHandedness(handedness === 'left' ? 'right' : 'left')}
      className={`
        hidden md:inline-flex
        fixed bottom-4 ${positionClass} z-40 
        group items-center justify-center gap-1.5
        rounded-lg border border-border/30 
        bg-background/80 backdrop-blur-sm 
        shadow-sm hover:shadow-md 
        px-3 py-2 
        text-xs font-medium 
        transition-all duration-200 
        hover:bg-muted/50 hover:border-border/50
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50
      `}
      title={`Switch to ${isLeftHanded ? 'right' : 'left'}-handed mode`}
      aria-label={`Switch to ${isLeftHanded ? 'right' : 'left'}-handed mode`}
    >
      <svg 
        className="w-3.5 h-3.5 transition-transform group-hover:scale-110" 
        fill="none" 
        stroke="currentColor" 
        strokeWidth={1.5}
        viewBox="0 0 24 24"
      >
        {isLeftHanded ? (
          <path strokeLinecap="round" strokeLinejoin="round" d="M7 16l-4-4m0 0l4-4m-4 4h18" />
        ) : (
          <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
        )}
      </svg>
      <span className="text-muted-foreground">{isLeftHanded ? 'Left' : 'Right'}</span>
    </button>
  );
}
