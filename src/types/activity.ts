// Valid action values for type safety
declare const validActions: readonly [
  'user_login',
  'user_logout',
  'quiz_submitted',
  'exam_submitted',
  'survey_response',
  'quiz_created',
  'exam_created',
  'survey_created',
  'live_battle_joined',
  'live_room_started',
  'live_room_ended',
  'badge_earned',
  'perfect_score',
  'question_imported',
  'result_generated',
  'profile_updated'
];
export type ActivityAction = typeof validActions[number];

// Valid entity types
declare const validEntityTypes: readonly [
  'user', 'quiz', 'exam', 'survey', 'live_room', 'badge', 'question', 'result'
];
export type ActivityEntityType = typeof validEntityTypes[number];

// Valid roles
declare const validRoles: readonly ['admin', 'student'];
export type ActorRole = typeof validRoles[number];

// Database ActivityLog (matches Supabase exactly)
export interface ActivityLog {
  id: string;
  actor_id: string | null;
  actor_name: string;
  actor_role: ActorRole;
  action: ActivityAction;
  entity_type: ActivityEntityType;
  entity_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

// Helper to normalize actor_role from database string
export function normalizeActorRole(value: string | null): ActorRole {
  if (value === 'admin' || value === 'student') return value;
  return 'student';
}

// Helper to normalize action from database string
export function normalizeAction(value: string | null): ActivityAction {
  const valid: ActivityAction[] = [
    'user_login', 'user_logout', 'quiz_submitted', 'exam_submitted', 'survey_response',
    'quiz_created', 'exam_created', 'survey_created', 'live_battle_joined',
    'live_room_started', 'live_room_ended', 'badge_earned', 'perfect_score',
    'question_imported', 'result_generated', 'profile_updated'
  ];
  if (value && valid.includes(value as ActivityAction)) return value as ActivityAction;
  return 'user_login';
}

// Helper to normalize entity_type from database string
export function normalizeEntityType(value: string | null): ActivityEntityType {
  const valid: ActivityEntityType[] = ['user', 'quiz', 'exam', 'survey', 'live_room', 'badge', 'question', 'result'];
  if (value && valid.includes(value as ActivityEntityType)) return value as ActivityEntityType;
  return 'user';
}

// Helper to normalize metadata from Json
export function normalizeMetadata(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

// Map database row to ActivityLog type
export function mapActivityLogRow(row: {
  id: string;
  actor_id: string | null;
  actor_name: string;
  actor_role: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  metadata: unknown;
  created_at: string;
}): ActivityLog {
  return {
    id: row.id,
    actor_id: row.actor_id,
    actor_name: row.actor_name,
    actor_role: normalizeActorRole(row.actor_role),
    action: normalizeAction(row.action),
    entity_type: normalizeEntityType(row.entity_type),
    entity_id: row.entity_id,
    metadata: normalizeMetadata(row.metadata),
    created_at: row.created_at,
  };
}

export interface ActivityFeedItem extends ActivityLog {
  icon?: string;
  color?: string;
  description?: string;
}

export interface ActivityFilter {
  action?: ActivityAction;
  entity_type?: ActivityEntityType;
  actor_role?: 'admin' | 'student';
  date_from?: string;
  date_to?: string;
  limit?: number;
}
