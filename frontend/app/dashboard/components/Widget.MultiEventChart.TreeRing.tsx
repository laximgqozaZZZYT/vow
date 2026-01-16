"use client"

import React from 'react'

type Habit = {
  id: string
  name: string
  workloadUnit?: string | null
  workloadTotal?: number | null
  must?: number | null
}

type EventPoint = {
  habitId: string
  ts: number
  iso: string
  kind: 'pause' | 'complete'
  workloadDelta: number
  workloadCumulative: number
  workloadTotal: number | null
  progressDelta: number
  progressCumulative: number
  workloadUnit: string
}

// 極座標からデカルト座標への変換
function polarToCartesian(centerX: number, centerY: number, radius: number, angleInDegrees: number) {
  const angleInRadians = (angleInDegrees - 90) * Math.PI / 180.0
  return {
    x: centerX + (radius * Math.cos(angleInRadians)),
    y: centerY + (radius * Math.sin(angleInRadians))
  }
}

// SVG弧パスを生成
function describeArc(
  x: number,
  y: number,
  radius: number,
  startAngle: number,
  endAngle: number
) {
  const start = polarToCartesian(x, y, radius, endAngle)
  const end = polarToCartesian(x, y, radius, startAngle)
  const largeArcFlag = endAngle - startAngle <= 180 ? '0' : '1'
  
  return [
    'M', start.x, start.y,
    'A', radius, radius, 0, largeArcFlag, 0, end.x, end.y
  ].join(' ')
}

// カラーパレット
function palette(i: number) {
  const colors = ['#2563eb', '#16a34a', '#dc2626', '#7c3aed', '#ea580c', '#0891b2', '#db2777', '#4b5563']
  return colors[i % colors.length]
}

export default function TreeRingEventChart({
  habits,
  points,
  visibleHabitIds,
  actualSeriesByHabit,
  plannedSeriesByHabit,
  minTs,
  maxTs,
  onHover,
  onDraggingChange,
}: {
  habits: Habit[]
  points: EventPoint[]
  visibleHabitIds: string[]
  actualSeriesByHabit: Map<string, Array<{ ts: number; ratio: number; cum: number; total: number }>>
  plannedSeriesByHabit: Map<string, Array<{ ts: number; ratio: number; cum: number; total: number }>>
  minTs: number
  maxTs: number
  onHover: (p: EventPoint | null) => void
  onDraggingChange?: (isDragging: boolean) => void
}) {
  // 回転角度の状態
  const [rotation, setRotation] = React.useState(0)
  const [isDragging, setIsDragging] = React.useState(false)
  const [startAngle, setStartAngle] = React.useState(0)
  const svgRef = React.useRef<SVGSVGElement>(null)

  const [tooltip, setTooltip] = React.useState<{
    visible: boolean
    x: number
    y: number
    content: {
      habitName: string
      kind: string
      timestamp: string
      workloadDelta: number
      workloadCumulative: number
      workloadTotal: number | null
      workloadUnit: string
      progressRatio: number
      plannedRatio: number
    }
  } | null>(null)

  const showTooltip = (
    event: React.MouseEvent,
    habitId: string,
    ts: number,
    actualRatio: number,
    plannedRatio: number
  ) => {
    const habit = habits.find(h => h.id === habitId)
    const actualSeries = actualSeriesByHabit.get(habitId) ?? []
    const point = actualSeries.find(p => p.ts === ts)
    
    setTooltip({
      visible: true,
      x: event.clientX,
      y: event.clientY,
      content: {
        habitName: habit?.name ?? habitId,
        kind: 'Progress',
        timestamp: new Date(ts).toLocaleString(),
        workloadDelta: 0,
        workloadCumulative: point?.cum ?? 0,
        workloadTotal: point?.total ?? null,
        workloadUnit: habit?.workloadUnit ?? 'work',
        progressRatio: actualRatio,
        plannedRatio: plannedRatio
      }
    })
  }

  const hideTooltip = () => {
    setTooltip(null)
    onHover(null)
  }

  // タッチ/マウスイベントから中心からの角度を計算
  const getAngleFromEvent = (clientX: number, clientY: number): number => {
    if (!svgRef.current) return 0
    
    const rect = svgRef.current.getBoundingClientRect()
    const centerX = rect.left + rect.width / 2
    const centerY = rect.top + rect.height / 2
    
    const dx = clientX - centerX
    const dy = clientY - centerY
    
    // atan2は-πからπの範囲を返すので、0-360度に変換
    let angle = Math.atan2(dy, dx) * (180 / Math.PI)
    angle = (angle + 90 + 360) % 360 // 上を0度とするように調整
    
    return angle
  }

  // タッチ開始
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length !== 1) return
    
    const touch = e.touches[0]
    const angle = getAngleFromEvent(touch.clientX, touch.clientY)
    
    setIsDragging(true)
    onDraggingChange?.(true)
    setStartAngle(angle - rotation)
  }

  // タッチ移動
  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging || e.touches.length !== 1) return
    
    const touch = e.touches[0]
    const angle = getAngleFromEvent(touch.clientX, touch.clientY)
    
    let newRotation = angle - startAngle
    // -180から180の範囲に正規化
    while (newRotation > 180) newRotation -= 360
    while (newRotation < -180) newRotation += 360
    
    setRotation(newRotation)
  }

  // タッチ終了
  const handleTouchEnd = () => {
    setIsDragging(false)
    onDraggingChange?.(false)
  }

  // マウスイベント（デスクトップでも使えるように）
  const handleMouseDown = (e: React.MouseEvent) => {
    const angle = getAngleFromEvent(e.clientX, e.clientY)
    setIsDragging(true)
    onDraggingChange?.(true)
    setStartAngle(angle - rotation)
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return
    
    const angle = getAngleFromEvent(e.clientX, e.clientY)
    let newRotation = angle - startAngle
    
    // -180から180の範囲に正規化
    while (newRotation > 180) newRotation -= 360
    while (newRotation < -180) newRotation += 360
    
    setRotation(newRotation)
  }

  const handleMouseUp = () => {
    setIsDragging(false)
    onDraggingChange?.(false)
  }

  // グローバルなマウスアップイベントをリッスン
  React.useEffect(() => {
    const handleGlobalMouseUp = () => {
      setIsDragging(false)
      onDraggingChange?.(false)
    }
    
    if (isDragging) {
      window.addEventListener('mouseup', handleGlobalMouseUp)
      window.addEventListener('touchend', handleGlobalMouseUp)
      return () => {
        window.removeEventListener('mouseup', handleGlobalMouseUp)
        window.removeEventListener('touchend', handleGlobalMouseUp)
      }
    }
  }, [isDragging, onDraggingChange])

  // レスポンシブなサイズ設定
  const isMobile = typeof window !== 'undefined' && window.innerWidth <= 768
  const size = isMobile ? 400 : 600
  
  // スマホでは中心を右下に配置して四分円を表示
  const centerX = isMobile ? size * 0.85 : size / 2
  const centerY = isMobile ? size * 0.85 : size / 2
  
  // スマホでは半径を大きくして四分円を画面いっぱいに表示
  const innerRadius = isMobile ? size * 0.1 : size * 0.05   // 中心の空白
  const outerRadius = isMobile ? size * 0.7 : size * 0.35   // 外側の半径
  const labelRingRadius = isMobile ? size * 0.78 : size * 0.42  // ラベルリングの半径
  
  const habitIds = visibleHabitIds.filter(id => habits.find(h => h.id === id))
  
  // 時刻を半径にマッピング
  const radiusOf = (ts: number) => {
    if (!Number.isFinite(minTs) || !Number.isFinite(maxTs) || minTs === maxTs) return innerRadius
    const ratio = (ts - minTs) / (maxTs - minTs)
    return innerRadius + (outerRadius - innerRadius) * ratio
  }

  return (
    <div className="space-y-3 w-full overflow-hidden">
      {/* 凡例 */}
      <div className="flex flex-wrap items-center justify-center gap-4 text-xs text-zinc-600 dark:text-zinc-400">
        <div className="flex items-center gap-2">
          <svg width="32" height="16" viewBox="0 0 32 16" className="text-current">
            <path d="M 16 8 m -7 0 a 7 7 0 0 1 7 -7 l 0 7 z" fill="none" stroke="currentColor" strokeWidth="2" opacity="0.3" />
          </svg>
          <span>100% = Full sector</span>
        </div>
        <div className="flex items-center gap-2">
          <svg width="32" height="16" viewBox="0 0 32 16" className="text-current">
            <path d="M 16 8 m -7 0 a 7 7 0 0 1 3.5 -6.06" fill="none" stroke="currentColor" strokeWidth="2" opacity="0.3" />
          </svg>
          <span>Incomplete = Arc gap</span>
        </div>
        <div className="flex items-center gap-2">
          <svg width="32" height="16" viewBox="0 0 32 16" className="text-current">
            <circle cx="8" cy="8" r="2" fill="none" stroke="currentColor" strokeWidth="0.5" opacity="0.2" />
            <circle cx="16" cy="8" r="5" fill="none" stroke="currentColor" strokeWidth="0.5" opacity="0.2" />
            <circle cx="24" cy="8" r="8" fill="none" stroke="currentColor" strokeWidth="0.5" opacity="0.2" />
          </svg>
          <span>Time (center → outer)</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-lg">🔄</span>
          <span>Swipe to rotate</span>
        </div>
      </div>

      <div className="w-full flex justify-center">
        <svg 
          ref={svgRef}
          viewBox={`0 0 ${size} ${size}`} 
          className={`w-full h-auto ${isMobile ? 'max-w-full' : 'max-w-[600px]'}`}
          preserveAspectRatio="xMidYMid meet"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          style={{ 
            cursor: isDragging ? 'grabbing' : 'grab',
            touchAction: 'none', // タッチスクロールを無効化
            userSelect: 'none'
          }}
        >
          {/* 回転可能なグループ */}
          <g transform={`rotate(${rotation} ${centerX} ${centerY})`}>
          {/* 背景の同心円（時刻の目盛り）と時刻ラベル */}
          {[0.25, 0.5, 0.75, 1].map((ratio) => {
            const r = innerRadius + (outerRadius - innerRadius) * ratio
            const ts = minTs + (maxTs - minTs) * ratio
            const date = new Date(ts)
            
            // 時刻ラベルのフォーマット
            let timeLabel = ''
            if (Number.isFinite(ts)) {
              const hours = date.getHours()
              const minutes = date.getMinutes()
              const month = date.getMonth() + 1
              const day = date.getDate()
              
              // 範囲に応じてラベルを変更
              const rangeMs = maxTs - minTs
              const dayMs = 24 * 60 * 60 * 1000
              
              if (rangeMs <= dayMs) {
                // 24時間以内: 時刻のみ
                timeLabel = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
              } else {
                // それ以上: 日付
                timeLabel = `${month}/${day}`
              }
            }
            
            return (
              <g key={`grid-${ratio}`}>
                <circle
                  cx={centerX}
                  cy={centerY}
                  r={r}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={0.5}
                  opacity={0.1}
                />
                {/* 時刻ラベル（右側に配置） */}
                {timeLabel && (
                  <text
                    x={centerX + r + 5}
                    y={centerY}
                    textAnchor="start"
                    dominantBaseline="middle"
                    fontSize={isMobile ? 8 : 9}
                    fill="currentColor"
                    opacity={0.4}
                    className="pointer-events-none"
                  >
                    {timeLabel}
                  </text>
                )}
              </g>
            )
          })}

          {/* 外側のラベルリング */}
          <circle
            cx={centerX}
            cy={centerY}
            r={labelRingRadius}
            fill="none"
            stroke="currentColor"
            strokeWidth={0.5}
            opacity={0.15}
          />

          {/* 中心円 */}
          <circle
            cx={centerX}
            cy={centerY}
            r={innerRadius}
            fill="none"
            stroke="currentColor"
            strokeWidth={1}
            opacity={0.2}
          />

          {/* 習慣名を外側のリング上に配置（円環に沿って） */}
          </g> {/* 回転可能なグループの一時終了 */}
          
          {/* パス定義（回転状態に応じて再生成） */}
          <defs>
            {habitIds.map((habitId, habitIndex) => {
              const habitCount = habitIds.length
              const anglePerHabit = habitCount > 0 ? 360 / habitCount : 360
              const sectorStartAngle = habitIndex * anglePerHabit
              const sectorEndAngle = (habitIndex + 1) * anglePerHabit
              
              // 各セクターの弧を定義
              const startPos = polarToCartesian(centerX, centerY, labelRingRadius, sectorStartAngle)
              const endPos = polarToCartesian(centerX, centerY, labelRingRadius, sectorEndAngle)
              const largeArcFlag = anglePerHabit > 180 ? 1 : 0
              
              // 回転を考慮した実際の角度を計算
              const midAngle = (sectorStartAngle + sectorEndAngle) / 2
              const rotatedMidAngle = (midAngle + rotation + 360) % 360
              const isBottomHalf = rotatedMidAngle > 90 && rotatedMidAngle < 270
              
              let pathD
              if (isBottomHalf) {
                // 下半分：終点から始点へ（反時計回り）
                pathD = `M ${endPos.x} ${endPos.y} A ${labelRingRadius} ${labelRingRadius} 0 ${largeArcFlag} 0 ${startPos.x} ${startPos.y}`
              } else {
                // 上半分：始点から終点へ（時計回り）
                pathD = `M ${startPos.x} ${startPos.y} A ${labelRingRadius} ${labelRingRadius} 0 ${largeArcFlag} 1 ${endPos.x} ${endPos.y}`
              }
              
              return (
                <path
                  key={`textPath-${habitId}-${rotation.toFixed(0)}`}
                  id={`textPath-${habitId}`}
                  d={pathD}
                  fill="none"
                />
              )
            })}
          </defs>
          
          {/* ラベルは回転グループ内に配置 */}
          <g transform={`rotate(${rotation} ${centerX} ${centerY})`}>
          
          {habitIds.map((habitId, habitIndex) => {
            const habit = habits.find(h => h.id === habitId)
            if (!habit) return null

            const color = palette(habitIndex)
            
            // 長い名前を分割（スマホでは短く、デスクトップでは長く）
            const maxLength = isMobile ? 6 : 12
            let habitName = habit.name
            let lines: string[] = []
            
            if (habitName.length > maxLength) {
              // 文字数で強制的に分割
              for (let i = 0; i < habitName.length; i += maxLength) {
                const line = habitName.slice(i, i + maxLength)
                lines.push(line)
                if (lines.length >= 2) break // 最大2行
              }
              // 2行目が長すぎる場合は省略
              if (lines.length === 2 && lines[1].length > maxLength) {
                lines[1] = lines[1].slice(0, maxLength - 1) + '..'
              }
            } else {
              lines = [habitName]
            }

            // 各習慣のセクター角度範囲を計算
            const habitCount = habitIds.length
            const anglePerHabit = habitCount > 0 ? 360 / habitCount : 360
            const sectorStartAngle = habitIndex * anglePerHabit
            const sectorEndAngle = (habitIndex + 1) * anglePerHabit
            const midAngle = (sectorStartAngle + sectorEndAngle) / 2
            
            // 回転を考慮した実際の角度を計算
            const rotatedMidAngle = (midAngle + rotation + 360) % 360
            const isBottomHalf = rotatedMidAngle > 90 && rotatedMidAngle < 270

            return (
              <g key={`label-${habitId}`}>
                {lines.map((line, lineIndex) => {
                  // 複数行の場合、上下にオフセット
                  const totalLines = lines.length
                  const lineSpacing = isMobile ? 11 : 13
                  const totalHeight = (totalLines - 1) * lineSpacing
                  const yOffset = (lineIndex * lineSpacing) - (totalHeight / 2)
                  
                  return (
                    <text
                      key={`label-${habitId}-line-${lineIndex}`}
                      fontSize={isMobile ? 10 : 11}
                      fill={color}
                      fontWeight="600"
                      className="pointer-events-none"
                    >
                      <textPath
                        href={`#textPath-${habitId}`}
                        startOffset="50%"
                        textAnchor="middle"
                      >
                        <tspan dy={yOffset}>
                          {line}
                        </tspan>
                      </textPath>
                    </text>
                  )
                })}
              </g>
            )
          })}

          {/* 各習慣の樹の年輪（セクター分割版） */}
          {habitIds.map((habitId, habitIndex) => {
            const habit = habits.find(h => h.id === habitId)
            if (!habit) return null

            const color = palette(habitIndex)
            const actualSeries = actualSeriesByHabit.get(habitId) ?? []
            const plannedSeries = plannedSeriesByHabit.get(habitId) ?? []

            // 各習慣のセクター角度範囲を計算
            const habitCount = habitIds.length
            const anglePerHabit = habitCount > 0 ? 360 / habitCount : 360
            const sectorStartAngle = habitIndex * anglePerHabit
            const sectorEndAngle = (habitIndex + 1) * anglePerHabit

            // 各時点での実績と予定の進捗率をマージ
            const timePoints = new Map<number, { actual: number; planned: number }>()
            
            actualSeries.forEach(point => {
              timePoints.set(point.ts, { 
                actual: point.ratio, 
                planned: timePoints.get(point.ts)?.planned ?? 0 
              })
            })
            
            plannedSeries.forEach(point => {
              const existing = timePoints.get(point.ts)
              timePoints.set(point.ts, { 
                actual: existing?.actual ?? 0, 
                planned: point.ratio 
              })
            })

            // 時系列順にソート
            const sortedTimePoints = Array.from(timePoints.entries())
              .sort((a, b) => a[0] - b[0])

            return (
              <g key={habitId}>
                {/* セクター境界線 */}
                <line
                  x1={centerX}
                  y1={centerY}
                  x2={polarToCartesian(centerX, centerY, outerRadius * 1.05, sectorStartAngle).x}
                  y2={polarToCartesian(centerX, centerY, outerRadius * 1.05, sectorStartAngle).y}
                  stroke="currentColor"
                  strokeWidth={0.5}
                  opacity={0.2}
                />

                {/* 各時点での弧を描画（セクター内） */}
                {sortedTimePoints.map(([ts, { actual, planned }], idx) => {
                  const radius = radiusOf(ts)
                  
                  // 予定進捗率を100%としたときの実際の進捗率を計算
                  // planned が 0 の場合は actual をそのまま使用
                  const normalizedRatio = planned > 0 ? Math.min(1, actual / planned) : actual
                  
                  // セクター内での弧の角度を計算（セクターの角度範囲内で0-100%を表現）
                  const startAngle = sectorStartAngle
                  const endAngle = sectorStartAngle + (normalizedRatio * anglePerHabit)
                  
                  // 弧が欠けている場合（100%未満）
                  const isIncomplete = normalizedRatio < 0.99
                  
                  // 完全な弧の場合（セクター全体）
                  if (!isIncomplete) {
                    const arcPath = describeArc(centerX, centerY, radius, startAngle, endAngle)
                    return (
                      <g key={`ring-${habitId}-${ts}`}>
                        {/* ホバーエリア */}
                        <path
                          d={arcPath}
                          fill="none"
                          stroke="transparent"
                          strokeWidth={isMobile ? 12 : 10}
                          onMouseEnter={(e) => showTooltip(e, habitId, ts, actual, planned)}
                          onMouseLeave={hideTooltip}
                          style={{ cursor: 'pointer' }}
                        />
                        {/* 完全な弧 */}
                        <path
                          d={arcPath}
                          fill="none"
                          stroke={color}
                          strokeWidth={isMobile ? 4 : 3}
                          opacity={0.6}
                          strokeLinecap="round"
                          pointerEvents="none"
                        />
                      </g>
                    )
                  }
                  
                  // 不完全な弧の場合
                  const arcPath = describeArc(centerX, centerY, radius, startAngle, endAngle)
                  
                  return (
                    <g key={`arc-${habitId}-${ts}`}>
                      {/* ホバーエリア（太めの透明な弧） */}
                      <path
                        d={arcPath}
                        fill="none"
                        stroke="transparent"
                        strokeWidth={isMobile ? 12 : 10}
                        onMouseEnter={(e) => showTooltip(e, habitId, ts, actual, planned)}
                        onMouseLeave={hideTooltip}
                        style={{ cursor: 'pointer' }}
                      />
                      {/* 表示される弧 */}
                      <path
                        d={arcPath}
                        fill="none"
                        stroke={color}
                        strokeWidth={isMobile ? 4 : 3}
                        opacity={0.6}
                        strokeLinecap="round"
                        pointerEvents="none"
                      />
                    </g>
                  )
                })}
              </g>
            )
          })}
          </g> {/* 回転可能なグループの終了 */}
        </svg>
      </div>

      {/* ツールチップ */}
      {tooltip && (
        <div
          className="fixed z-50 pointer-events-none"
          style={{
            left: tooltip.x + 10,
            top: tooltip.y - 10,
            transform: 'translateY(-100%)'
          }}
        >
          <div className="rounded border border-zinc-100 p-2 text-xs text-zinc-700 dark:border-slate-800 dark:text-zinc-200 bg-white dark:bg-slate-900 shadow-lg max-w-xs">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
              <div>
                <span className="font-medium">{tooltip.content.habitName}</span>
                <span className="ml-2 rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] dark:bg-slate-800">
                  {tooltip.content.kind}
                </span>
              </div>
              <div className="text-zinc-500 text-[10px]">{tooltip.content.timestamp}</div>
            </div>

            <div className="grid grid-cols-1 gap-1">
              <div className="rounded bg-zinc-50 p-1.5 dark:bg-slate-900/40">
                <div className="text-[9px] text-zinc-500">Actual Progress</div>
                <div className="font-semibold text-[11px]">{Math.round(tooltip.content.progressRatio * 100)}%</div>
              </div>
              <div className="rounded bg-zinc-50 p-1.5 dark:bg-slate-900/40">
                <div className="text-[9px] text-zinc-500">Planned Progress</div>
                <div className="font-semibold text-[11px]">{Math.round(tooltip.content.plannedRatio * 100)}%</div>
              </div>
              <div className="rounded bg-zinc-50 p-1.5 dark:bg-slate-900/40">
                <div className="text-[9px] text-zinc-500">Completion Rate</div>
                <div className="font-semibold text-[11px]">
                  {tooltip.content.plannedRatio > 0 
                    ? Math.round((tooltip.content.progressRatio / tooltip.content.plannedRatio) * 100) 
                    : Math.round(tooltip.content.progressRatio * 100)}%
                </div>
              </div>
              <div className="rounded bg-zinc-50 p-1.5 dark:bg-slate-900/40">
                <div className="text-[9px] text-zinc-500">Workload</div>
                <div className="font-semibold text-[11px]">
                  {tooltip.content.workloadCumulative} / {tooltip.content.workloadTotal ?? '-'} {tooltip.content.workloadUnit}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
