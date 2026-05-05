export type LiveRoomStatus = 'waiting' | 'active' | 'finished' | 'cancelled';

export interface LiveRoom {
  id: string;
  room_code: string;
  quiz_id: string;
  host_id: string;
  status: LiveRoomStatus;
  current_question_index: number;
  timer_seconds: number;
  started_at: string | null;
  ended_at: string | null;
  created_at: string;
  quiz?: {
    id: string;
    title: string;
    mode: 'quiz' | 'exam';
  };
}

export interface LiveRoomParticipant {
  id: string;
  room_id: string;
  user_id: string | null;
  display_name: string;
  score: number;
  rank: number | null;
  joined_at: string;
  is_active: boolean | null;
}

// Helper to map database row to LiveRoomParticipant
export function mapLiveRoomParticipant(row: {
  id: string;
  room_id: string;
  user_id: string | null;
  display_name: string;
  score: number;
  rank: number | null;
  joined_at: string;
  is_active: boolean | null;
}): LiveRoomParticipant {
  return {
    id: row.id,
    room_id: row.room_id,
    user_id: row.user_id,
    display_name: row.display_name,
    score: row.score,
    rank: row.rank,
    joined_at: row.joined_at,
    is_active: row.is_active,
  };
}

export interface LiveAnswer {
  id: string;
  room_id: string;
  participant_id: string;
  question_id: string;
  selected_option_id: string | null;
  answer_text: string | null;
  is_correct: boolean;
  points: number;
  response_time_ms: number;
  submitted_at: string;
}

export interface LiveLeaderboardEntry {
  participant_id: string;
  display_name: string;
  score: number;
  rank: number;
  correct_answers: number;
  total_answers: number;
  avg_response_time_ms: number;
}

export interface LiveQuestionState {
  question_index: number;
  question_id: string;
  time_remaining: number;
  status: 'showing' | 'answering' | 'revealing' | 'transitioning';
  total_questions: number;
}

export interface JoinRoomResult {
  success: boolean;
  participant_id?: string;
  room?: LiveRoom;
  error?: string;
}

export interface CreateRoomResult {
  success: boolean;
  room?: LiveRoom;
  error?: string;
}
