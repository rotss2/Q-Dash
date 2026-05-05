import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { ActivityLog, ActivityFilter, mapActivityLogRow } from '../types/activity';

interface UseActivityFeedOptions {
  limit?: number;
  realtime?: boolean;
}

export function useActivityFeed(options: UseActivityFeedOptions = {}) {
  const { limit = 20, realtime = true } = options;
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchActivities = useCallback(async (filter?: ActivityFilter) => {
    try {
      setLoading(true);
      setError(null);

      let query = supabase
        .from('activity_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(filter?.limit || limit);

      if (filter?.action) {
        query = query.eq('action', filter.action);
      }
      if (filter?.entity_type) {
        query = query.eq('entity_type', filter.entity_type);
      }
      if (filter?.actor_role) {
        query = query.eq('actor_role', filter.actor_role);
      }
      if (filter?.date_from) {
        query = query.gte('created_at', filter.date_from);
      }
      if (filter?.date_to) {
        query = query.lte('created_at', filter.date_to);
      }

      const { data, error: fetchError } = await query;

      if (fetchError) throw fetchError;
      // Map database rows to ActivityLog type
      const mappedActivities = (data || []).map(row => mapActivityLogRow(row));
      setActivities(mappedActivities);
    } catch (err) {
      console.error('Error fetching activities:', err);
      setError(err instanceof Error ? err.message : 'Failed to load activities');
    } finally {
      setLoading(false);
    }
  }, [limit]);

  useEffect(() => {
    fetchActivities();
  }, [fetchActivities]);

  useEffect(() => {
    if (!realtime) return;

    const subscription = supabase
      .channel('activity_logs_changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'activity_logs',
        },
        (payload) => {
          const newActivity = mapActivityLogRow(payload.new as {
            id: string;
            actor_id: string | null;
            actor_name: string;
            actor_role: string;
            action: string;
            entity_type: string;
            entity_id: string | null;
            metadata: unknown;
            created_at: string;
          });
          setActivities((prev) => [newActivity, ...prev].slice(0, limit));
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [realtime, limit]);

  const logActivity = useCallback(async (
    actorName: string,
    actorRole: 'admin' | 'student',
    action: string,
    entityType: string,
    entityId?: string | null,
    metadata?: Record<string, unknown> | null
  ) => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      const actorId = userData?.user?.id;

      const { error: insertError } = await supabase.rpc('log_activity', {
        p_actor_id: actorId,
        p_actor_name: actorName,
        p_actor_role: actorRole,
        p_action: action,
        p_entity_type: entityType,
        p_entity_id: entityId ?? undefined,
        p_metadata: metadata ?? {},
      });

      if (insertError) throw insertError;
    } catch (err) {
      console.error('Error logging activity:', err);
    }
  }, []);

  return {
    activities,
    loading,
    error,
    refresh: fetchActivities,
    logActivity,
  };
}

export function useActivityLogger() {
  const logActivity = useCallback(async (
    actorName: string,
    actorRole: 'admin' | 'student',
    action: string,
    entityType: string,
    entityId?: string | null,
    metadata?: Record<string, unknown> | null
  ) => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      const actorId = userData?.user?.id;

      await supabase.rpc('log_activity', {
        p_actor_id: actorId,
        p_actor_name: actorName,
        p_actor_role: actorRole,
        p_action: action,
        p_entity_type: entityType,
        p_entity_id: entityId ?? undefined,
        p_metadata: metadata ?? {},
      });
    } catch (err) {
      console.error('Error logging activity:', err);
    }
  }, []);

  return { logActivity };
}

export default useActivityFeed;
