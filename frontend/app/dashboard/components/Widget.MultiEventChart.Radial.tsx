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

type RangeKey = 'auto' | '24h' | '7d' | '1mo' | '1y'

// 極座標からデカルト座標への変換
function polarToCartesian(centerX: number, centerY: number, radius: number, angleInDegrees: number) {
  const angleInRadians = (angleInDegrees - 90) * Math.PI / 180.0
  return {
    x: centerX + (radius * Math.cos(angleInRadians)),
    y: centerY + (radius * Math.sin(angleInRadians))
  }
}

// カラーパレット
function palette(i: number) {
  const colors = ['#2563eb', '#16a34a', '#dc2626', '#7c3aed', '#ea580c', '#0891b2', '#db2777', '#4b5563']
  return colors[i % colors.length]
}

export default function RadialEventChart({
  habits,
  points,
  visibleHabitIds,
  actualSeriesByHabit,
  plannedSeriesByHabit,
  minTs,
  maxTs,
  onHover,
}: {
  habits: Habit[]
  points: EventPoint[]
  visibleHabitIds: string[]
  actualSeriesByHabit: Map<string, Array<{ ts: number; ratio: number; cum: number; total: number }>>
  plannedSeriesByHabit: Map<string, Array<{ ts: number; ratio: number; cum: number; total: number }>>
  minTs: number
  maxTs: number
  onHover: (p: EventPoint | null) => void
}) {
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
    }
  } | null>(null)

  const showTooltip = (event: React.MouseEvent, point: EventPoint, progressRatio: number) => {
    const habit = habits.find(h => h.id === point.habitId)
    
    setTooltip({
      visible: true,
      x: event.clientX,
      y: event.clientY,
      content: {
        habitName: habit?.name ?? point.habitId,
        kind: point.kind === 'pause' ? 'Pause' : 'Done',
        timestamp: new Date(point.ts).toLocaleString(),
        workloadDelta: point.workloadDelta,
        workloadCumulative: point.workloadCumulative,
        workloadTotal: point.workloadTotal,
        workloadUnit: point.workloadUnit,
        progressRatio: progressRatio
      }
    })
    
    onHover(point)
  }

  const hideTooltip = () => {
    setTooltip(null)
    onHover(null)
  }

  // レスポンシブなサイズ設定
  const isMobile = typeof window !== 'undefined' && window.innerWidth <= 768
  const size = isMobile ? 400 : 600
  const centerX = size / 2
  const centerY = size / 2
  const innerRadius = size * 0.1   // 中心の空白
  const outerRadius = size * 0.35  // 外側の半径（ラベル用のスペースを確保）
  const labelRingRadius = size * 0.42  // ラベルリングの半径
  
  const habitIds = visibleHabitIds.filter(id => habits.find(h => h.id === id))
  const habitCount = habitIds.length
  
  // 各習慣に割り当てる角度範囲（全体を均等に分割）
  const anglePerHabit = habitCount > 0 ? 360 / habitCount : 0
  
  // 時刻を半径にマッピング
  const radiusOf = (ts: number) => {
    if (!Number.isFinite(minTs) || !Number.isFinite(maxTs) || minTs === maxTs) return innerRadius
    const ratio = (ts - minTs) / (maxTs - minTs)
    return innerRadius + (outerRadius - innerRadius) * ratio
  }
  
  // 進捗率を角度にマッピング（各習慣のセクター内で0-100%を表現）
  const angleOf = (habitIndex: number, progressRatio: number) => {
    const baseAngle = habitIndex * anglePerHabit
    // セクター内で進捗率を角度に変換（0% = セクター開始、100% = セクター終了）
    return baseAngle + (progressRatio * anglePerHabit)
  }

  return (
    <div className="space-y-3 w-full overflow-hidden">
      {/* 凡例 */}
      <div className="flex flex-wrap items-center justify-center gap-4 text-xs text-zinc-600 dark:text-zinc-400">
        <div className="flex items-center gap-2">
          <div className="w-8 h-0.5 bg-current opacity-40" style={{ borderTop: '2px dashed currentColor' }}></div>
          <span>Planned</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-current rounded-full"></div>
          <span>Actual</span>
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
          <svg width="24" height="24" viewBox="0 0 24 24" className="text-current">
            <path d="M 12 2 A 10 10 0 0 1 22 12" fill="none" stroke="currentColor" strokeWidth="2" opacity="0.3" />
            <text x="17" y="8" fontSize="8" fill="currentColor" opacity="0.5">100%</text>
          </svg>
          <span>Progress (angle in sector)</span>
        </div>
      </div>

      <div className="w-full flex justify-center">
        <svg 
          viewBox={`0 0 ${size} ${size}`} 
          className="w-full h-auto max-w-[600px]" 
          preserveAspectRatio="xMidYMid meet"
        >
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
                  opacity={0.15}
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
                    opacity={0.5}
                    className="pointer-events-none"
                  >
                    {timeLabel}
                  </text>
                )}
              </g>
            )
          })}

          {/* 中心円 */}
          <circle
            cx={centerX}
            cy={centerY}
            r={innerRadius}
            fill="none"
            stroke="currentColor"
            strokeWidth={1}
            opacity={0.25}
          />

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

          {/* 習慣名を外側のリング上に配置（円環に沿って） */}
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
              
              // 下半分は逆方向に描画（テキストが上下反転しないように）
              const midAngle = (sectorStartAngle + sectorEndAngle) / 2
              const isBottomHalf = midAngle > 90 && midAngle < 270
              
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
                  key={`textPath-${habitId}`}
                  id={`textPath-radial-${habitId}`}
                  d={pathD}
                  fill="none"
                />
              )
            })}
          </defs>
          
          {habitIds.map((habitId, habitIndex) => {
            const habit = habits.find(h => h.id === habitId)
            if (!habit) return null

            const color = palette(habitIndex)
            const habitName = habit.name.length > 15 ? habit.name.slice(0, 15) + '...' : habit.name

            return (
              <text
                key={`label-${habitId}`}
                fontSize={isMobile ? 9 : 11}
                fill={color}
                fontWeight="600"
                className="pointer-events-none"
              >
                <textPath
                  href={`#textPath-radial-${habitId}`}
                  startOffset="50%"
                  textAnchor="middle"
                >
                  {habitName}
                </textPath>
              </text>
            )
          })}

          {/* 中心のラベル */}
          <text
            x={centerX}
            y={centerY}
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize={isMobile ? 10 : 12}
            fill="currentColor"
            opacity={0.5}
            className="pointer-events-none"
          >
            Start
          </text>

          {/* 各習慣のセクター */}
          {habitIds.map((habitId, habitIndex) => {
            const habit = habits.find(h => h.id === habitId)
            if (!habit) return null

            const startAngle = habitIndex * anglePerHabit
            const endAngle = (habitIndex + 1) * anglePerHabit
            const midAngle = (startAngle + endAngle) / 2
            const color = palette(habitIndex)

            const actualSeries = actualSeriesByHabit.get(habitId) ?? []
            const plannedSeries = plannedSeriesByHabit.get(habitId) ?? []

            return (
              <g key={habitId}>
                {/* セクター境界線 */}
                <line
                  x1={centerX}
                  y1={centerY}
                  x2={polarToCartesian(centerX, centerY, outerRadius * 1.05, startAngle).x}
                  y2={polarToCartesian(centerX, centerY, outerRadius * 1.05, startAngle).y}
                  stroke="currentColor"
                  strokeWidth={0.5}
                  opacity={0.2}
                />

                {/* 進捗率の目盛り線（セクター内） */}
                {[0.25, 0.5, 0.75, 1].map((progressRatio) => {
                  const angle = angleOf(habitIndex, progressRatio)
                  const innerPos = polarToCartesian(centerX, centerY, innerRadius, angle)
                  const outerPos = polarToCartesian(centerX, centerY, outerRadius, angle)
                  const labelPos = polarToCartesian(centerX, centerY, outerRadius * 1.08, angle)
                  
                  return (
                    <g key={`progress-mark-${habitId}-${progressRatio}`}>
                      <line
                        x1={innerPos.x}
                        y1={innerPos.y}
                        x2={outerPos.x}
                        y2={outerPos.y}
                        stroke={color}
                        strokeWidth={0.5}
                        opacity={0.15}
                      />
                      {/* 進捗率ラベル */}
                      <text
                        x={labelPos.x}
                        y={labelPos.y}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        fontSize={isMobile ? 7 : 8}
                        fill={color}
                        opacity={0.4}
                        className="pointer-events-none"
                      >
                        {Math.round(progressRatio * 100)}%
                      </text>
                    </g>
                  )
                })}

                {/* 予定線（破線） */}
                {plannedSeries.length > 0 && (() => {
                  const pathSegments: string[] = []
                  
                  plannedSeries.forEach((point, idx) => {
                    const radius = radiusOf(point.ts)
                    const angle = angleOf(habitIndex, point.ratio)
                    const pos = polarToCartesian(centerX, centerY, radius, angle)
                    
                    if (idx === 0) {
                      pathSegments.push(`M ${pos.x} ${pos.y}`)
                    } else {
                      pathSegments.push(`L ${pos.x} ${pos.y}`)
                    }
                  })
                  
                  const pathD = pathSegments.join(' ')
                  
                  return (
                    <path
                      d={pathD}
                      fill="none"
                      stroke={color}
                      strokeWidth={2}
                      strokeDasharray="4 3"
                      opacity={0.4}
                    />
                  )
                })()}

                {/* 実績線（実線） */}
                {actualSeries.length > 1 && actualSeries.map((point, idx) => {
                  if (idx === 0) return null
                  
                  const prevPoint = actualSeries[idx - 1]
                  const radius = radiusOf(point.ts)
                  const prevRadius = radiusOf(prevPoint.ts)
                  const angle = angleOf(habitIndex, point.ratio)
                  const prevAngle = angleOf(habitIndex, prevPoint.ratio)
                  const pos = polarToCartesian(centerX, centerY, radius, angle)
                  const prevPos = polarToCartesian(centerX, centerY, prevRadius, prevAngle)
                  
                  return (
                    <line
                      key={`actual-line-${habitId}-${idx}`}
                      x1={prevPos.x}
                      y1={prevPos.y}
                      x2={pos.x}
                      y2={pos.y}
                      stroke={color}
                      strokeWidth={3}
                      opacity={0.75}
                      strokeLinecap="round"
                    />
                  )
                })}

                {/* 実績ポイント */}
                {actualSeries.map((point, idx) => {
                  const radius = radiusOf(point.ts)
                  const angle = angleOf(habitIndex, point.ratio)
                  const pos = polarToCartesian(centerX, centerY, radius, angle)
                  
                  // 対応するイベントポイントを探す
                  const eventPoint = points.find(p => 
                    p.habitId === habitId && 
                    Math.abs(p.ts - point.ts) < 1000
                  )
                  
                  return (
                    <g key={`point-${habitId}-${idx}`}>
                      {/* ホバーエリア */}
                      <circle
                        cx={pos.x}
                        cy={pos.y}
                        r={isMobile ? 12 : 10}
                        fill="transparent"
                        onMouseEnter={(e) => {
                          if (eventPoint) {
                            showTooltip(e, eventPoint, point.ratio)
                          }
                        }}
                        onMouseLeave={hideTooltip}
                        style={{ cursor: 'pointer' }}
                      />
                      {/* 表示ポイント */}
                      <circle
                        cx={pos.x}
                        cy={pos.y}
                        r={isMobile ? 4 : 3.5}
                        fill={color}
                        pointerEvents="none"
                      />
                    </g>
                  )
                })}

                {/* 予定ポイント */}
                {plannedSeries.map((point, idx) => {
                  const radius = radiusOf(point.ts)
                  const angle = angleOf(habitIndex, point.ratio)
                  const pos = polarToCartesian(centerX, centerY, radius, angle)
                  
                  return (
                    <circle
                      key={`planned-point-${habitId}-${idx}`}
                      cx={pos.x}
                      cy={pos.y}
                      r={3}
                      fill="none"
                      stroke={color}
                      strokeWidth={1.5}
                      strokeDasharray="2 2"
                      opacity={0.7}
                    />
                  )
                })}
              </g>
            )
          })}
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
                <div className="text-[9px] text-zinc-500">Progress</div>
                <div className="font-semibold text-[11px]">{Math.round(tooltip.content.progressRatio * 100)}%</div>
              </div>
              <div className="rounded bg-zinc-50 p-1.5 dark:bg-slate-900/40">
                <div className="text-[9px] text-zinc-500">Workload Cumulative</div>
                <div className="font-semibold text-[11px]">{tooltip.content.workloadCumulative} {tooltip.content.workloadUnit}</div>
              </div>
              <div className="rounded bg-zinc-50 p-1.5 dark:bg-slate-900/40">
                <div className="text-[9px] text-zinc-500">Workload Total</div>
                <div className="font-semibold text-[11px]">{tooltip.content.workloadTotal ?? '-'} {tooltip.content.workloadUnit}</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
