"use client"

import React, { createContext, useContext, useState, useEffect } from 'react'

type Locale = 'en' | 'ja'

interface LocaleContextType {
  locale: Locale
  setLocale: (locale: Locale) => void
  t: (key: string) => string
}

const LocaleContext = createContext<LocaleContextType | undefined>(undefined)

const translations: Record<Locale, Record<string, string>> = {
  en: {
    // Modal.Habit
    'habit.title': 'Habit',
    'habit.view.normal': 'Normal',
    'habit.view.detail': 'Detail',
    'habit.name': 'Name',
    'habit.name.placeholder': 'Add title',
    'habit.workload': 'Workload',
    'habit.workload.unit': 'Unit',
    'habit.workload.unit.placeholder': 'e.g. hrs, pages',
    'habit.workload.perCount': 'Load per Count',
    'habit.workload.totalDay': 'Load Total(Day)',
    'habit.workload.totalEnd': 'Load Total(End) (optional)',
    'habit.workload.estimatedDays': 'Estimated days to reach Load Total(End):',
    'habit.workload.estimatedDays.value': 'days',
    'habit.workload.description': 'Based on Load Total(Day), we estimate how many days it takes to reach Load Total(End).',
    'habit.timings': 'Timings',
    'habit.timings.timing': 'Timing',
    'habit.timings.date': 'Date',
    'habit.timings.start': 'Start',
    'habit.timings.end': 'End',
    'habit.timings.autoLoad': 'Auto Load / Set',
    'habit.timings.aDay': 'A Day',
    'habit.timings.daily': 'Daily',
    'habit.timings.weekly': 'Weekly',
    'habit.timings.monthly': 'Monthly',
    'habit.timings.selectDate': 'Select date',
    'habit.outdates': 'Outdates (exclude periods)',
    'habit.outdates.expand': 'Expand',
    'habit.outdates.collapse': 'Collapse',
    'habit.outdates.none': 'No outdates added.',
    'habit.type': 'Type',
    'habit.type.good': 'Good',
    'habit.type.bad': 'Bad',
    'habit.type.description': 'Good = show on calendar. Bad = track but hide from calendar.',
    'habit.goal': 'Goal',
    'habit.description': 'Description',
    'habit.description.placeholder': 'Add description',
    'habit.tags': 'Tags',
    'habit.tags.placeholder': 'Search and add tags...',
    'habit.relatedHabits': 'Related Habits',
    'habit.relatedHabits.loading': 'Loading...',
    'habit.relatedHabits.none': 'No related habits.',
    'habit.relatedHabits.select': 'Select habit...',
    'habit.relatedHabits.main': 'Main',
    'habit.relatedHabits.sub': 'Sub',
    'habit.relatedHabits.next': 'Next',
    'habit.relatedHabits.saveFirst': 'Save the habit first to add relations.',
    'habit.button.save': 'Save',
    'habit.button.cancel': 'Cancel',
    'habit.button.delete': 'Delete',
  },
  ja: {
    // Modal.Habit
    'habit.title': 'ハビット',
    'habit.view.normal': '通常',
    'habit.view.detail': '詳細',
    'habit.name': '名前',
    'habit.name.placeholder': 'タイトルを追加',
    'habit.workload': '作業負荷',
    'habit.workload.unit': '単位',
    'habit.workload.unit.placeholder': '例: 時間, ページ',
    'habit.workload.perCount': '1回あたりの負荷',
    'habit.workload.totalDay': '1日の総負荷',
    'habit.workload.totalEnd': '最終目標負荷 (任意)',
    'habit.workload.estimatedDays': '最終目標到達までの推定日数:',
    'habit.workload.estimatedDays.value': '日',
    'habit.workload.description': '1日の総負荷に基づいて、最終目標到達までの日数を推定します。',
    'habit.timings': 'タイミング',
    'habit.timings.timing': 'タイミング',
    'habit.timings.date': '日付',
    'habit.timings.start': '開始',
    'habit.timings.end': '終了',
    'habit.timings.autoLoad': '自動負荷 / セット',
    'habit.timings.aDay': '1日',
    'habit.timings.daily': '毎日',
    'habit.timings.weekly': '毎週',
    'habit.timings.monthly': '毎月',
    'habit.timings.selectDate': '日付を選択',
    'habit.outdates': '除外期間',
    'habit.outdates.expand': '展開',
    'habit.outdates.collapse': '折りたたむ',
    'habit.outdates.none': '除外期間が追加されていません。',
    'habit.type': 'タイプ',
    'habit.type.good': '良い',
    'habit.type.bad': '悪い',
    'habit.type.description': '良い = カレンダーに表示。悪い = 追跡するがカレンダーには非表示。',
    'habit.goal': '目標',
    'habit.description': '説明',
    'habit.description.placeholder': '説明を追加',
    'habit.tags': 'タグ',
    'habit.tags.placeholder': 'タグを検索して追加...',
    'habit.relatedHabits': '関連ハビット',
    'habit.relatedHabits.loading': '読み込み中...',
    'habit.relatedHabits.none': '関連ハビットがありません。',
    'habit.relatedHabits.select': 'ハビットを選択...',
    'habit.relatedHabits.main': 'メイン',
    'habit.relatedHabits.sub': 'サブ',
    'habit.relatedHabits.next': '次',
    'habit.relatedHabits.saveFirst': '関連を追加するには、まずハビットを保存してください。',
    'habit.button.save': '保存',
    'habit.button.cancel': 'キャンセル',
    'habit.button.delete': '削除',
  },
}

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>('en')

  useEffect(() => {
    // Load locale from localStorage
    const savedLocale = localStorage.getItem('locale') as Locale | null
    if (savedLocale && (savedLocale === 'en' || savedLocale === 'ja')) {
      setLocaleState(savedLocale)
    }
  }, [])

  const setLocale = (newLocale: Locale) => {
    setLocaleState(newLocale)
    localStorage.setItem('locale', newLocale)
  }

  const t = (key: string): string => {
    return translations[locale][key] || key
  }

  return (
    <LocaleContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </LocaleContext.Provider>
  )
}

export function useLocale() {
  const context = useContext(LocaleContext)
  if (context === undefined) {
    throw new Error('useLocale must be used within a LocaleProvider')
  }
  return context
}
