/**
 * Admin Service
 *
 * Service for managing admin users and audit logging.
 * Admins can access all Premium features without subscription and bypass token quotas.
 *
 * Requirements: 13.1, 13.2, 13.3
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { getLogger } from '../utils/logger.js';

const logger = getLogger('adminService');

// ============================================================================
// Types
// ============================================================================

export interface AdminUser {
  id: string;
  userId: string;
  email: string;
  grantedAt: string;
  expiresAt: string | null;
  grantedBy: 'env_config' | 'database';
  notes?: string;
}

export interface AdminUsageStats {
  totalTokensUsed: number;
  totalOperations: number;
  estimatedCost: number; // USD
  byFeature: Record<string, { tokens: number; operations: number }>;
}

export interface AdminAuditLog {
  id: string;
  userId: string;
  action: string;
  details: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  createdAt: string;
}

// ============================================================================
// Admin Service
// ============================================================================

export interface AdminService {
  isAdmin(userId: string, userEmail?: string): Promise<boolean>;
  getAdminByUserId(userId: string): Promise<AdminUser | null>;
  getAdminByEmail(email: string): Promise<AdminUser | null>;
  logAdminAction(
    userId: string,
    action: string,
    details: Record<string, any>,
    context?: { ipAddress?: string | undefined; userAgent?: string | undefined }
  ): Promise<void>;
  getAdminUsageStats(userId: string): Promise<AdminUsageStats>;
  getAdminAuditLogs(userId: string, limit?: number): Promise<AdminAuditLog[]>;
}

class AdminServiceImpl implements AdminService {
  private adminEmailsCache: Set<string> | null = null;

  constructor(private supabase: SupabaseClient) {}

  /**
   * Get admin emails from environment variable
   */
  private getAdminEmailsFromEnv(): Set<string> {
    if (this.adminEmailsCache) {
      return this.adminEmailsCache;
    }

    const adminEmailsEnv = process.env['ADMIN_EMAILS'] || '';
    const emails = adminEmailsEnv
      .split(',')
      .map((e) => e.trim().toLowerCase())
      .filter((e) => e.length > 0);

    this.adminEmailsCache = new Set(emails);
    return this.adminEmailsCache;
  }

  /**
   * Check if a user is an admin
   *
   * Admin status is determined by:
   * 1. Email in ADMIN_EMAILS environment variable
   * 2. Entry in admin_users table (not expired)
   */
  async isAdmin(userId: string, userEmail?: string): Promise<boolean> {
    // Check environment variable first (fastest)
    if (userEmail) {
      const adminEmails = this.getAdminEmailsFromEnv();
      if (adminEmails.has(userEmail.toLowerCase())) {
        logger.info('Admin access granted via env config', { userId, email: userEmail });
        return true;
      }
    }

    // Check database
    const adminUser = await this.getAdminByUserId(userId);
    if (adminUser) {
      // Check if not expired
      if (!adminUser.expiresAt || new Date(adminUser.expiresAt) > new Date()) {
        logger.info('Admin access granted via database', { userId });
        return true;
      }
    }

    return false;
  }

  /**
   * Get admin user by user ID
   */
  async getAdminByUserId(userId: string): Promise<AdminUser | null> {
    const { data, error } = await this.supabase
      .from('admin_users')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error || !data) {
      return null;
    }

    return {
      id: data.id,
      userId: data.user_id,
      email: data.email,
      grantedAt: data.granted_at,
      expiresAt: data.expires_at,
      grantedBy: data.granted_by,
      notes: data.notes,
    };
  }

  /**
   * Get admin user by email
   */
  async getAdminByEmail(email: string): Promise<AdminUser | null> {
    // Check environment variable first
    const adminEmails = this.getAdminEmailsFromEnv();
    if (adminEmails.has(email.toLowerCase())) {
      // Return a virtual admin user for env-configured admins
      return {
        id: 'env-config',
        userId: '',
        email: email.toLowerCase(),
        grantedAt: new Date().toISOString(),
        expiresAt: null,
        grantedBy: 'env_config',
      };
    }

    // Check database
    const { data, error } = await this.supabase
      .from('admin_users')
      .select('*')
      .eq('email', email.toLowerCase())
      .single();

    if (error || !data) {
      return null;
    }

    return {
      id: data.id,
      userId: data.user_id,
      email: data.email,
      grantedAt: data.granted_at,
      expiresAt: data.expires_at,
      grantedBy: data.granted_by,
      notes: data.notes,
    };
  }

  /**
   * Log an admin action to the audit log
   */
  async logAdminAction(
    userId: string,
    action: string,
    details: Record<string, any>,
    context?: { ipAddress?: string | undefined; userAgent?: string | undefined }
  ): Promise<void> {
    const { error } = await this.supabase.from('admin_audit_logs').insert({
      user_id: userId,
      action,
      details,
      ip_address: context?.ipAddress,
      user_agent: context?.userAgent,
      created_at: new Date().toISOString(),
    });

    if (error) {
      logger.error('Failed to log admin action', new Error(error.message), {
        userId,
        action,
      });
      // Don't throw - audit logging should not block operations
    } else {
      logger.info('Admin action logged', { userId, action });
    }
  }

  /**
   * Get usage statistics for an admin user
   */
  async getAdminUsageStats(userId: string): Promise<AdminUsageStats> {
    // Get token usage for the current month
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const { data: usageData, error } = await this.supabase
      .from('token_usage')
      .select('feature, tokens_used')
      .eq('user_id', userId)
      .gte('created_at', startOfMonth.toISOString());

    if (error) {
      logger.error('Failed to get admin usage stats', new Error(error.message), { userId });
      return {
        totalTokensUsed: 0,
        totalOperations: 0,
        estimatedCost: 0,
        byFeature: {},
      };
    }

    // Aggregate by feature
    const byFeature: Record<string, { tokens: number; operations: number }> = {};
    let totalTokensUsed = 0;
    let totalOperations = 0;

    for (const record of usageData || []) {
      const feature = record.feature;
      const tokens = record.tokens_used;

      if (!byFeature[feature]) {
        byFeature[feature] = { tokens: 0, operations: 0 };
      }

      byFeature[feature]!.tokens += tokens;
      byFeature[feature]!.operations += 1;
      totalTokensUsed += tokens;
      totalOperations += 1;
    }

    // Calculate estimated cost (GPT-4o mini pricing)
    // Input: $0.15/1M tokens, Output: $0.60/1M tokens
    // Assuming 70% input, 30% output
    const costPerMillion = 0.7 * 0.15 + 0.3 * 0.6; // $0.285/1M tokens
    const estimatedCost = (totalTokensUsed / 1_000_000) * costPerMillion;

    return {
      totalTokensUsed,
      totalOperations,
      estimatedCost,
      byFeature,
    };
  }

  /**
   * Get audit logs for an admin user
   */
  async getAdminAuditLogs(userId: string, limit = 100): Promise<AdminAuditLog[]> {
    const { data, error } = await this.supabase
      .from('admin_audit_logs')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      logger.error('Failed to get admin audit logs', new Error(error.message), { userId });
      return [];
    }

    return (data || []).map((row) => ({
      id: row.id,
      userId: row.user_id,
      action: row.action,
      details: row.details,
      ipAddress: row.ip_address,
      userAgent: row.user_agent,
      createdAt: row.created_at,
    }));
  }
}

// ============================================================================
// Factory Function
// ============================================================================

let adminServiceInstance: AdminService | null = null;

export function getAdminService(supabase: SupabaseClient): AdminService {
  if (!adminServiceInstance) {
    adminServiceInstance = new AdminServiceImpl(supabase);
  }
  return adminServiceInstance;
}

// Reset for testing
export function resetAdminService(): void {
  adminServiceInstance = null;
}
