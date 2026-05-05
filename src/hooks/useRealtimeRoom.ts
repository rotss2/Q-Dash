import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { LiveRoom, LiveRoomParticipant, LiveLeaderboardEntry, mapLiveRoomParticipant } from '../types/live';

interface UseRealtimeRoomOptions {
  roomId: string | null;
  participantId?: string | null;
}

export function useRealtimeRoom({ roomId, participantId }: UseRealtimeRoomOptions) {
  const [room, setRoom] = useState<LiveRoom | null>(null);
  const [participants, setParticipants] = useState<LiveRoomParticipant[]>([]);
  const [leaderboard, setLeaderboard] = useState<LiveLeaderboardEntry[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fetch initial room state
  const fetchRoomState = useCallback(async () => {
    if (!roomId) return;

    try {
      // Fetch room details
      const { data: roomData, error: roomError } = await supabase
        .from('live_rooms')
        .select(`
          *,
          quiz:surveys!live_rooms_quiz_id_fkey(id, title, mode)
        `)
        .eq('id', roomId)
        .single();

      if (roomError) throw roomError;
      setRoom(roomData as LiveRoom);
      setCurrentQuestionIndex(roomData.current_question_index);
      setTimeRemaining(roomData.timer_seconds);

      // Fetch participants
      const { data: participantsData, error: participantsError } = await supabase
        .from('live_room_participants')
        .select('*')
        .eq('room_id', roomId)
        .eq('is_active', true)
        .order('score', { ascending: false });

      if (participantsError) throw participantsError;
      const mappedParticipants = (participantsData || []).map(mapLiveRoomParticipant);
      setParticipants(mappedParticipants);

      // Fetch leaderboard
      const { data: leaderboardData, error: leaderboardError } = await supabase
        .rpc('get_live_leaderboard', { p_room_id: roomId });

      if (leaderboardError) throw leaderboardError;
      setLeaderboard(leaderboardData || []);
    } catch (err) {
      console.error('Error fetching room state:', err);
      setError(err instanceof Error ? err.message : 'Failed to load room');
    }
  }, [roomId]);

  // Subscribe to realtime changes
  useEffect(() => {
    if (!roomId) return;

    setIsConnected(true);
    fetchRoomState();

    const subscription = supabase
      .channel(`room_${roomId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'live_rooms',
          filter: `id=eq.${roomId}`,
        },
        (payload) => {
          if (payload.eventType === 'UPDATE') {
            const newData = payload.new as LiveRoom;
            setRoom(newData);
            setCurrentQuestionIndex(newData.current_question_index);
            if (newData.timer_seconds !== timeRemaining) {
              setTimeRemaining(newData.timer_seconds);
            }
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'live_room_participants',
          filter: `room_id=eq.${roomId}`,
        },
        () => {
          // Refresh participants when any change occurs
          supabase
            .from('live_room_participants')
            .select('*')
            .eq('room_id', roomId)
            .eq('is_active', true)
            .order('score', { ascending: false })
            .then(({ data }) => {
              if (data) setParticipants(data.map(mapLiveRoomParticipant));
            });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'live_answers',
          filter: `room_id=eq.${roomId}`,
        },
        () => {
          // Refresh leaderboard when new answers are submitted
          supabase
            .rpc('get_live_leaderboard', { p_room_id: roomId })
            .then(({ data }) => {
              if (data) setLeaderboard(data);
            });
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [roomId, fetchRoomState, timeRemaining]);

  // Timer countdown
  useEffect(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }

    if (room?.status === 'active' && timeRemaining > 0) {
      timerRef.current = setInterval(() => {
        setTimeRemaining((prev) => {
          if (prev <= 1) {
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [room?.status, timeRemaining]);

  // Submit answer
  const submitAnswer = useCallback(async (
    questionId: string,
    answer: string,
    isCorrect: boolean,
    responseTimeMs: number
  ) => {
    if (!roomId || !participantId) return false;

    try {
      // Calculate points (base + speed bonus)
      const basePoints = isCorrect ? 1000 : 0;
      const speedBonus = isCorrect ? Math.floor((room?.timer_seconds || 20) * 1000 - responseTimeMs) / 10 : 0;
      const totalPoints = Math.max(0, basePoints + Math.floor(speedBonus));

      // Insert answer
      const { error: answerError } = await supabase
        .from('live_answers')
        .insert({
          room_id: roomId,
          participant_id: participantId,
          question_id: questionId,
          answer_text: answer,
          is_correct: isCorrect,
          points: totalPoints,
          response_time_ms: responseTimeMs,
        });

      if (answerError) throw answerError;

      // Fetch current score and update
      const { data: currentParticipant } = await supabase
        .from('live_room_participants')
        .select('score')
        .eq('id', participantId)
        .single();
      
      const newScore = (currentParticipant?.score ?? 0) + totalPoints;
      
      const { error: updateError } = await supabase
        .from('live_room_participants')
        .update({ score: newScore })
        .eq('id', participantId);

      if (updateError) throw updateError;

      return true;
    } catch (err) {
      console.error('Error submitting answer:', err);
      return false;
    }
  }, [roomId, participantId, room?.timer_seconds]);

  return {
    room,
    participants,
    leaderboard,
    currentQuestionIndex,
    timeRemaining,
    isConnected,
    error,
    submitAnswer,
    refresh: fetchRoomState,
  };
}

export function useLiveRoomHost(roomId: string | null) {
  const [isLoading, setIsLoading] = useState(false);

  const startRoom = useCallback(async () => {
    if (!roomId) return false;
    setIsLoading(true);

    try {
      const { error } = await supabase
        .from('live_rooms')
        .update({
          status: 'active',
          started_at: new Date().toISOString(),
        })
        .eq('id', roomId);

      if (error) throw error;
      return true;
    } catch (err) {
      console.error('Error starting room:', err);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [roomId]);

  const nextQuestion = useCallback(async () => {
    if (!roomId) return false;
    setIsLoading(true);

    try {
      const { data: room } = await supabase
        .from('live_rooms')
        .select('current_question_index')
        .eq('id', roomId)
        .single();

      const { error } = await supabase
        .from('live_rooms')
        .update({
          current_question_index: (room?.current_question_index || 0) + 1,
        })
        .eq('id', roomId);

      if (error) throw error;
      return true;
    } catch (err) {
      console.error('Error advancing question:', err);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [roomId]);

  const endRoom = useCallback(async () => {
    if (!roomId) return false;
    setIsLoading(true);

    try {
      const { error } = await supabase
        .from('live_rooms')
        .update({
          status: 'finished',
          ended_at: new Date().toISOString(),
        })
        .eq('id', roomId);

      if (error) throw error;
      return true;
    } catch (err) {
      console.error('Error ending room:', err);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [roomId]);

  return {
    startRoom,
    nextQuestion,
    endRoom,
    isLoading,
  };
}

export default useRealtimeRoom;
