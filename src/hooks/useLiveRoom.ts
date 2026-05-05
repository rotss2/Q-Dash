import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { generateRoomCode, calculateLivePoints } from '../lib/liveScoring';
import type { LiveRoom, LiveRoomParticipant, LiveLeaderboardEntry } from '../types/live';

// Define Question interface locally to avoid import issues
interface Question {
  id: string;
  survey_id: string;
  block_type: string;
  type: string;
  question_text: string;
  options: string[] | null;
  correct_answer: string | null;
  correct_answers: string[] | null;
  order_index: number;
  topic?: string | null;
}

interface CreateRoomParams {
  quizId: string;
  hostId: string;
  timerSeconds?: number;
}

interface SubmitAnswerParams {
  roomId: string;
  participantId: string;
  questionId: string;
  selectedOptionId: string | null;
  answerText: string | null;
  isCorrect: boolean;
  responseTimeMs: number;
  timerSeconds: number;
}

export function useLiveRoomHost(roomId: string | null) {
  const [room, setRoom] = useState<LiveRoom | null>(null);
  const [participants, setParticipants] = useState<LiveRoomParticipant[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null);
  const [leaderboard, setLeaderboard] = useState<LiveLeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch room data
  useEffect(() => {
    if (!roomId) return;

    const fetchRoomData = async () => {
      try {
        setLoading(true);

        // Fetch room
        const { data: roomData, error: roomError } = await supabase
          .from('live_rooms')
          .select('*')
          .eq('id', roomId)
          .single();

        if (roomError) throw roomError;

        if (!roomData) {
          setError('Room not found');
          return;
        }

        setRoom(roomData as LiveRoom);

        // Fetch questions
        const { data: questionsData, error: questionsError } = await supabase
          .from('questions')
          .select('*')
          .eq('survey_id', roomData.quiz_id)
          .order('order_index');

        if (questionsError) throw questionsError;
        setQuestions((questionsData || []) as unknown as Question[]);

        // Set current question
        if (questionsData && questionsData.length > 0 && roomData.current_question_index >= 0) {
          setCurrentQuestion((questionsData[roomData.current_question_index] || null) as unknown as Question);
        }

        // Fetch participants
        const { data: participantsData, error: participantsError } = await supabase
          .from('live_room_participants')
          .select('*')
          .eq('room_id', roomId)
          .order('score', { ascending: false });

        if (participantsError) throw participantsError;
        setParticipants(participantsData || []);

        // Calculate leaderboard
        updateLeaderboard(participantsData || []);
      } catch (err) {
        console.error('Error fetching room:', err);
        setError('Failed to load room data');
      } finally {
        setLoading(false);
      }
    };

    fetchRoomData();
  }, [roomId]);

  // Subscribe to realtime changes
  useEffect(() => {
    if (!roomId) return;

    const roomChannel = supabase
      .channel(`room:${roomId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'live_rooms', filter: `id=eq.${roomId}` },
        (payload) => {
          if (payload.new) {
            setRoom(payload.new as LiveRoom);
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'live_room_participants', filter: `room_id=eq.${roomId}` },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setParticipants((prev) => [...prev, payload.new as LiveRoomParticipant]);
          } else if (payload.eventType === 'UPDATE') {
            setParticipants((prev) =>
              prev.map((p) => (p.id === payload.new.id ? payload.new as LiveRoomParticipant : p))
            );
          } else if (payload.eventType === 'DELETE') {
            setParticipants((prev) => prev.filter((p) => p.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    return () => {
      roomChannel.unsubscribe();
    };
  }, [roomId]);

  const updateLeaderboard = (parts: LiveRoomParticipant[]) => {
    const sorted = [...parts].sort((a, b) => b.score - a.score);
    const entries: LiveLeaderboardEntry[] = sorted.map((p, index) => ({
      participant_id: p.id,
      display_name: p.display_name,
      score: p.score,
      rank: index + 1,
      is_active: p.is_active ?? true,
      correct_answers: 0,
      total_answers: 0,
      avg_response_time_ms: 0,
    }));
    setLeaderboard(entries);
  };

  const startQuiz = useCallback(async () => {
    if (!roomId || !room) return;

    try {
      const { error } = await supabase
        .from('live_rooms')
        .update({
          status: 'active',
          started_at: new Date().toISOString(),
          current_question_index: 0,
        })
        .eq('id', roomId);

      if (error) throw error;
    } catch (err) {
      console.error('Error starting quiz:', err);
      setError('Failed to start quiz');
    }
  }, [roomId, room]);

  const nextQuestion = useCallback(async () => {
    if (!roomId || !room || !questions.length) return;

    const nextIndex = room.current_question_index + 1;
    if (nextIndex >= questions.length) {
      // End quiz
      await endQuiz();
      return;
    }

    try {
      const { error } = await supabase
        .from('live_rooms')
        .update({ current_question_index: nextIndex })
        .eq('id', roomId);

      if (error) throw error;
    } catch (err) {
      console.error('Error moving to next question:', err);
      setError('Failed to move to next question');
    }
  }, [roomId, room, questions]);

  const endQuiz = useCallback(async () => {
    if (!roomId) return;

    try {
      const { error } = await supabase
        .from('live_rooms')
        .update({
          status: 'finished',
          ended_at: new Date().toISOString(),
        })
        .eq('id', roomId);

      if (error) throw error;
    } catch (err) {
      console.error('Error ending quiz:', err);
      setError('Failed to end quiz');
    }
  }, [roomId]);

  return {
    room,
    participants,
    questions,
    currentQuestion,
    leaderboard,
    loading,
    error,
    startQuiz,
    nextQuestion,
    endQuiz,
  };
}

export function useLiveRoomStudent(roomCode: string | null) {
  const [room, setRoom] = useState<LiveRoom | null>(null);
  const [participant, setParticipant] = useState<LiveRoomParticipant | null>(null);
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null);
  const [hasAnswered, setHasAnswered] = useState(false);
  const [leaderboard, setLeaderboard] = useState<LiveLeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Find room by code
  useEffect(() => {
    if (!roomCode) {
      setLoading(false);
      return;
    }

    const findRoom = async () => {
      try {
        setLoading(true);

        const { data: roomData, error: roomError } = await supabase
          .from('live_rooms')
          .select('*')
          .eq('room_code', roomCode.toUpperCase())
          .in('status', ['waiting', 'active'])
          .single();

        if (roomError || !roomData) {
          setError('Room not found or not available');
          return;
        }

        setRoom(roomData as LiveRoom);

        // Fetch current question if active
        if (roomData.status === 'active' && roomData.current_question_index >= 0) {
          const { data: questionsData } = await supabase
            .from('questions')
            .select('*')
            .eq('survey_id', roomData.quiz_id)
            .order('order_index');

          if (questionsData && questionsData.length > 0) {
            setCurrentQuestion((questionsData[roomData.current_question_index] || null) as unknown as Question);
          }
        }

        // Fetch leaderboard
        const { data: participantsData } = await supabase
          .from('live_room_participants')
          .select('*')
          .eq('room_id', roomData.id)
          .order('score', { ascending: false });

        if (participantsData) {
          const sorted = [...participantsData].sort((a, b) => b.score - a.score);
          const entries: LiveLeaderboardEntry[] = sorted.map((p, index) => ({
            participant_id: p.id,
            display_name: p.display_name,
            score: p.score,
            rank: index + 1,
            is_active: p.is_active ?? true,
            correct_answers: 0,
            total_answers: 0,
            avg_response_time_ms: 0,
          }));
          setLeaderboard(entries);
        }
      } catch (err) {
        console.error('Error finding room:', err);
        setError('Failed to find room');
      } finally {
        setLoading(false);
      }
    };

    findRoom();
  }, [roomCode]);

  // Subscribe to room changes
  useEffect(() => {
    if (!room?.id) return;

    const roomChannel = supabase
      .channel(`room-student:${room.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'live_rooms', filter: `id=eq.${room.id}` },
        async (payload) => {
          if (payload.new) {
            const updatedRoom = payload.new as LiveRoom;
            setRoom(updatedRoom);

            // Fetch current question when room updates
            if (updatedRoom.status === 'active' && updatedRoom.current_question_index >= 0) {
              const { data: questionsData } = await supabase
                .from('questions')
                .select('*')
                .eq('survey_id', updatedRoom.quiz_id)
                .order('order_index');

              if (questionsData && questionsData.length > 0) {
                const question = questionsData[updatedRoom.current_question_index];
                if (question?.id !== currentQuestion?.id) {
                  setCurrentQuestion((question || null) as unknown as Question);
                  setHasAnswered(false);
                }
              }
            }
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'live_room_participants', filter: `room_id=eq.${room.id}` },
        (payload) => {
          if (payload.eventType === 'UPDATE' && payload.new.id === participant?.id) {
            setParticipant(payload.new as LiveRoomParticipant);
          }
        }
      )
      .subscribe();

    return () => {
      roomChannel.unsubscribe();
    };
  }, [room?.id, participant?.id, currentQuestion?.id]);

  const joinRoom = useCallback(async (displayName: string, userId?: string) => {
    if (!room) return;

    try {
      const { data, error } = await supabase
        .from('live_room_participants')
        .insert({
          room_id: room.id,
          user_id: userId || null,
          display_name: displayName,
          score: 0,
          is_active: true,
        })
        .select()
        .single();

      if (error) throw error;

      setParticipant(data as LiveRoomParticipant);
      return data as LiveRoomParticipant;
    } catch (err) {
      console.error('Error joining room:', err);
      setError('Failed to join room');
      return null;
    }
  }, [room]);

  const submitAnswer = useCallback(
    async (params: Omit<SubmitAnswerParams, 'roomId' | 'participantId'>) => {
      if (!room?.id || !participant?.id || hasAnswered) return;

      try {
        const points = calculateLivePoints({
          isCorrect: params.isCorrect,
          responseTimeMs: params.responseTimeMs,
          timerSeconds: params.timerSeconds,
        });

        // Insert answer
        const { error: answerError } = await supabase.from('live_answers').insert({
          room_id: room.id,
          participant_id: participant.id,
          question_id: params.questionId,
          selected_option_id: params.selectedOptionId,
          answer_text: params.answerText,
          is_correct: params.isCorrect,
          points: points.totalPoints,
          response_time_ms: params.responseTimeMs,
        });

        if (answerError) throw answerError;

        // Update participant score
        const newScore = participant.score + points.totalPoints;
        const { error: updateError } = await supabase
          .from('live_room_participants')
          .update({ score: newScore })
          .eq('id', participant.id);

        if (updateError) throw updateError;

        setHasAnswered(true);
        return points;
      } catch (err) {
        console.error('Error submitting answer:', err);
        setError('Failed to submit answer');
        return null;
      }
    },
    [room?.id, participant?.id, hasAnswered, participant?.score]
  );

  return {
    room,
    participant,
    currentQuestion,
    hasAnswered,
    leaderboard,
    loading,
    error,
    joinRoom,
    submitAnswer,
    setHasAnswered,
  };
}

export function useCreateLiveRoom() {
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createRoom = useCallback(async (params: CreateRoomParams) => {
    try {
      setCreating(true);
      setError(null);

      const roomCode = generateRoomCode();

      const { data, error: createError } = await supabase
        .from('live_rooms')
        .insert({
          room_code: roomCode,
          quiz_id: params.quizId,
          host_id: params.hostId,
          status: 'waiting',
          timer_seconds: params.timerSeconds || 20,
          current_question_index: -1,
        })
        .select()
        .single();

      if (createError) throw createError;

      return data as LiveRoom;
    } catch (err) {
      console.error('Error creating room:', err);
      setError('Failed to create room');
      return null;
    } finally {
      setCreating(false);
    }
  }, []);

  return { createRoom, creating, error };
}
