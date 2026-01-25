'use client';

import React from 'react';

/**
 * ProgressIndicatorコンポーネントのProps
 */
export interface ProgressIndicatorProps {
  /** 現在の値 (0-100) */
  value: number;
  /** 最大値 (デフォルト: 100) */
  max?: number;
  /** 表示タイプ */
  type?: 'linear' | 'circular';
  /** サイズ */
  size?: 'sm' | 'md' | 'lg';
  /** カラーバリエーション */
  color?: 'primary' | 'success' | 'warning' | 'danger';
  /** ラベル表示 */
  showLabel?: boolean;
  /** カスタムラベル */
  label?: string;
  /** アニメーション有効 */
  animated?: boolean;
  /** 追加のクラス名 */
  className?: string;
}

/**
 * カラーに応じたクラスを取得
 */
function getColorClasses(color: 'primary' | 'success' | 'warning' | 'danger'): {
  bar: string;
  text: string;
  stroke: string;
} {
  switch (color) {
    case 'primary':
      return { bar: 'bg-primary', text: 'text-primary', stroke: 'stroke-primary' };
    case 'success':
      return { bar: 'bg-green-500', text: 'text-green-500', stroke: 'stroke-green-500' };
    case 'warning':
      return { bar: 'bg-yellow-500', text: 'text-yellow-500', stroke: 'stroke-yellow-500' };
    case 'danger':
      return { bar: 'bg-red-500', text: 'text-red-500', stroke: 'stroke-red-500' };
  }
}

/**
 * サイズに応じた値を取得
 */
function getSizeValues(size: 'sm' | 'md' | 'lg'): {
  height: string;
  circleSize: number;
  strokeWidth: number;
  fontSize: string;
} {
  switch (size) {
    case 'sm':
      return { height: 'h-1', circleSize: 48, strokeWidth: 4, fontSize: 'text-xs' };
    case 'md':
      return { height: 'h-2', circleSize: 64, strokeWidth: 6, fontSize: 'text-sm' };
    case 'lg':
      return { height: 'h-3', circleSize: 96, strokeWidth: 8, fontSize: 'text-base' };
  }
}

/**
 * 線形プログレスバー
 */
function LinearProgress({
  percentage,
  colorClasses,
  sizeValues,
  showLabel,
  label,
  animated,
}: {
  percentage: number;
  colorClasses: ReturnType<typeof getColorClasses>;
  sizeValues: ReturnType<typeof getSizeValues>;
  showLabel: boolean;
  label?: string;
  animated: boolean;
}) {
  return (
    <div className="w-full">
      {showLabel && (
        <div className="flex justify-between items-center mb-1">
          {label && <span className="text-sm text-foreground">{label}</span>}
          <span className={`${sizeValues.fontSize} font-medium ${colorClasses.text}`}>
            {Math.round(percentage)}%
          </span>
        </div>
      )}
      <div className={`w-full ${sizeValues.height} bg-muted rounded-full overflow-hidden`}>
        <div
          className={`${sizeValues.height} ${colorClasses.bar} rounded-full ${
            animated ? 'transition-all duration-500 ease-out' : ''
          }`}
          style={{ width: `${percentage}%` }}
          role="progressbar"
          aria-valuenow={percentage}
          aria-valuemin={0}
          aria-valuemax={100}
        />
      </div>
    </div>
  );
}


/**
 * 円形プログレスインジケーター
 */
function CircularProgress({
  percentage,
  colorClasses,
  sizeValues,
  showLabel,
  label,
  animated,
}: {
  percentage: number;
  colorClasses: ReturnType<typeof getColorClasses>;
  sizeValues: ReturnType<typeof getSizeValues>;
  showLabel: boolean;
  label?: string;
  animated: boolean;
}) {
  const { circleSize, strokeWidth } = sizeValues;
  const radius = (circleSize - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative" style={{ width: circleSize, height: circleSize }}>
        <svg
          width={circleSize}
          height={circleSize}
          className="transform -rotate-90"
        >
          {/* 背景の円 */}
          <circle
            cx={circleSize / 2}
            cy={circleSize / 2}
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth={strokeWidth}
            className="text-muted"
          />
          {/* プログレスの円 */}
          <circle
            cx={circleSize / 2}
            cy={circleSize / 2}
            r={radius}
            fill="none"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            className={`${colorClasses.stroke} ${
              animated ? 'transition-all duration-500 ease-out' : ''
            }`}
            role="progressbar"
            aria-valuenow={percentage}
            aria-valuemin={0}
            aria-valuemax={100}
          />
        </svg>
        {/* 中央のパーセンテージ表示 */}
        {showLabel && (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className={`${sizeValues.fontSize} font-bold ${colorClasses.text}`}>
              {Math.round(percentage)}%
            </span>
          </div>
        )}
      </div>
      {label && (
        <span className="text-sm text-muted-foreground text-center">{label}</span>
      )}
    </div>
  );
}

/**
 * ProgressIndicatorコンポーネント
 *
 * 線形・円形の進捗表示をサポートし、カラーバリエーションを提供。
 *
 * Requirements:
 * - 9.5: Display progress indicators with various styles
 */
export function ProgressIndicator({
  value,
  max = 100,
  type = 'linear',
  size = 'md',
  color = 'primary',
  showLabel = true,
  label,
  animated = true,
  className = '',
}: ProgressIndicatorProps) {
  // パーセンテージを計算（0-100の範囲に制限）
  const percentage = Math.min(100, Math.max(0, (value / max) * 100));
  const colorClasses = getColorClasses(color);
  const sizeValues = getSizeValues(size);

  return (
    <div className={className}>
      {type === 'linear' ? (
        <LinearProgress
          percentage={percentage}
          colorClasses={colorClasses}
          sizeValues={sizeValues}
          showLabel={showLabel}
          label={label}
          animated={animated}
        />
      ) : (
        <CircularProgress
          percentage={percentage}
          colorClasses={colorClasses}
          sizeValues={sizeValues}
          showLabel={showLabel}
          label={label}
          animated={animated}
        />
      )}
    </div>
  );
}

export default ProgressIndicator;
