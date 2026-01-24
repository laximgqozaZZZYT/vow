"use client";

import { useState, useEffect, useCallback } from 'react';
import { useHandedness } from '../contexts/HandednessContext';
import api from '../../../lib/api';
import { debug } from '../../../lib/debug';

/**
 * Notice types matching backend NoticeType
 */
type NoticeType = 
  | 'workload_coaching'
  | 'habit_recovery'
  | 'token_warning_70'
  | 'token_warning_90'
  | 'token_exhausted'
  | 'subscription_renewed'
  | 'subscription_payment_failed'
  | 'habit_suggestion'
  | 'weekly_report';

interface Notice {
  id: string;
  userId: string;
  type: NoticeType;
  title: string;
  message: string;
  actionType?: 'rescue_proposal' | 'recovery_proposal' | 'token_warning' | 'subscription' | 'habit_suggestion';
  actionPayload?: Record<string, any>;
  read: boolean;
  createdAt: string;
}

interface NoticeSectionProps {
  onActionClick?: (notice: Notice) => void;
}

/**
 * Section.Notice - In-app notification display component
 * 
 * Displays user notifications with unread badge, mark as read functionality,
 * and action buttons for actionable notifications.
 * 
 * Requirements: 12.1, 12.2
 */
export default function NoticeSection({ onActionClick }: NoticeSectionProps) {
  const { isLeftHanded } = useHandedness();
  const [notices, setNotices] = useState<Notice[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isExpanded, setIsExpanded] = useState(false);

  // Fetch notices from API
  const fetchNotices = useCallback(async () => {
    try {
      const response = await api.get('/api/notices?limit=20');
      if (response && response.notices) {
        setNotices(response.notices);
        setUnreadCount(response.unreadCount || 0);
      }
    } catch (error) {
      debug.log('[NoticeSection] Failed to fetch notices:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNotices();
    
    // Poll for new notices every 60 seconds
    const interval = setInterval(fetchNotices, 60000);
    return () => clearInterval(interval);
  }, [fetchNotices]);

  // Mark single notice as read
  const handleMarkAsRead = async (noticeId: string) => {
    try {
      await api.patch(`/api/notices/${noticeId}/read`);
      setNotices(prev => prev.map(n => 
        n.id === noticeId ? { ...n, read: true } : n
      ));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      debug.log('[NoticeSection] Failed to mark as read:', error);
    }
  };

  // Mark all notices as read
  const handleMarkAllAsRead = async () => {
    try {
      await api.post('/api/notices/read-all');
      setNotices(prev => prev.map(n => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch (error) {
      debug.log('[NoticeSection] Failed to mark all as read:', error);
    }
  };

  // Delete a notice
  const handleDelete = async (noticeId: string) => {
    try {
      await api.delete(`/api/notices/${noticeId}`);
      const notice = notices.find(n => n.id === noticeId);
      setNotices(prev => prev.filter(n => n.id !== noticeId));
      if (notice && !notice.read) {
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
    } catch (error) {
      debug.log('[NoticeSection] Failed to delete notice:', error);
    }
  };

  // Get icon for notice type
  const getNoticeIcon = (type: NoticeType): string => {
    switch (type) {
      case 'workload_coaching':
        return '💪';
      case 'habit_recovery':
        return '🔄';
      case 'token_warning_70':
      case 'token_warning_90':
        return '⚠️';
      case 'token_exhausted':
        return '🚫';
      case 'subscription_renewed':
        return '✅';
      case 'subscription_payment_failed':
        return '❌';
      case 'habit_suggestion':
        return '💡';
      case 'weekly_report':
        return '📊';
      default:
        return '📬';
    }
  };

  // Get background color for notice type
  const getNoticeColor = (type: NoticeType, read: boolean): string => {
    if (read) return 'bg-muted/50';
    
    switch (type) {
      case 'token_warning_70':
      case 'token_warning_90':
        return 'bg-yellow-50 dark:bg-yellow-900/20';
      case 'token_exhausted':
      case 'subscription_payment_failed':
        return 'bg-red-50 dark:bg-red-900/20';
      case 'subscription_renewed':
      case 'habit_recovery':
        return 'bg-green-50 dark:bg-green-900/20';
      case 'workload_coaching':
      case 'habit_suggestion':
        return 'bg-blue-50 dark:bg-blue-900/20';
      default:
        return 'bg-card';
    }
  };

  // Format relative time
  const formatRelativeTime = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'たった今';
    if (diffMins < 60) return `${diffMins}分前`;
    if (diffHours < 24) return `${diffHours}時間前`;
    if (diffDays < 7) return `${diffDays}日前`;
    return date.toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' });
  };

  if (isLoading) {
    return (
      <section className="rounded-lg border border-border bg-card text-card-foreground shadow-sm p-4 sm:p-6 mt-4">
        <div className="flex items-center justify-center h-20">
          <div className="text-sm text-muted-foreground">Loading...</div>
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-lg border border-border bg-card text-card-foreground shadow-sm p-4 sm:p-6 mt-4">
      {/* Header */}
      <div className={`flex items-center mb-3 ${isLeftHanded ? 'flex-row-reverse' : 'justify-between'}`}>
        <div className={`flex items-center gap-2 ${isLeftHanded ? 'flex-row-reverse' : ''}`}>
          <h2 className="text-lg font-semibold">Notifications</h2>
          {unreadCount > 0 && (
            <span className="inline-flex items-center justify-center px-2 py-0.5 text-xs font-medium bg-primary text-primary-foreground rounded-full">
              {unreadCount}
            </span>
          )}
        </div>
        
        <div className={`flex items-center gap-2 ${isLeftHanded ? 'flex-row-reverse' : ''}`}>
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllAsRead}
              className="text-xs text-primary hover:underline"
            >
              すべて既読
            </button>
          )}
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            {isExpanded ? '折りたたむ' : '展開'}
          </button>
        </div>
      </div>

      {/* Notice List */}
      <div className={`space-y-2 overflow-y-auto pr-1 ${isExpanded ? 'max-h-96' : 'max-h-48'}`}>
        {notices.length === 0 ? (
          <div className="text-sm text-muted-foreground text-center py-4">
            通知はありません
          </div>
        ) : (
          notices.map(notice => (
            <div
              key={notice.id}
              className={`
                relative p-3 rounded-md border border-border
                ${getNoticeColor(notice.type, notice.read)}
                ${!notice.read ? 'border-l-4 border-l-primary' : ''}
                transition-colors duration-200
              `}
            >
              <div className={`flex items-start gap-3 ${isLeftHanded ? 'flex-row-reverse' : ''}`}>
                {/* Icon */}
                <span className="text-lg flex-shrink-0" role="img" aria-label={notice.type}>
                  {getNoticeIcon(notice.type)}
                </span>
                
                {/* Content */}
                <div className={`flex-1 min-w-0 ${isLeftHanded ? 'text-right' : ''}`}>
                  <div className={`flex items-center gap-2 ${isLeftHanded ? 'flex-row-reverse justify-end' : ''}`}>
                    <h3 className={`text-sm font-medium truncate ${notice.read ? 'text-muted-foreground' : 'text-foreground'}`}>
                      {notice.title}
                    </h3>
                    <span className="text-xs text-muted-foreground flex-shrink-0">
                      {formatRelativeTime(notice.createdAt)}
                    </span>
                  </div>
                  
                  <p className={`text-xs mt-1 ${notice.read ? 'text-muted-foreground' : 'text-foreground/80'}`}>
                    {notice.message}
                  </p>
                  
                  {/* Action buttons */}
                  <div className={`flex items-center gap-2 mt-2 ${isLeftHanded ? 'flex-row-reverse justify-end' : ''}`}>
                    {notice.actionType && onActionClick && (
                      <button
                        onClick={() => {
                          onActionClick(notice);
                          if (!notice.read) handleMarkAsRead(notice.id);
                        }}
                        className="text-xs px-2 py-1 bg-primary text-primary-foreground rounded hover:opacity-90 transition-opacity"
                      >
                        詳細を見る
                      </button>
                    )}
                    
                    {!notice.read && (
                      <button
                        onClick={() => handleMarkAsRead(notice.id)}
                        className="text-xs text-muted-foreground hover:text-foreground"
                      >
                        既読にする
                      </button>
                    )}
                    
                    <button
                      onClick={() => handleDelete(notice.id)}
                      className="text-xs text-red-500 hover:text-red-600"
                    >
                      削除
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
