import React from 'react';
import { 
  Radio, 
  Play,
  Clock,
  ChevronRight
} from 'lucide-react';
import { EmptyState } from '../EmptyState';
import { LiveRoom } from '../../types/live';

interface ActiveLiveRoomsPanelProps {
  rooms: LiveRoom[];
  loading?: boolean;
  onViewAll?: () => void;
  onJoinRoom?: (roomCode: string) => void;
}

const formatDuration = (startTime: string | null): string => {
  if (!startTime) return 'Not started';
  const start = new Date(startTime);
  const now = new Date();
  const minutes = Math.floor((now.getTime() - start.getTime()) / 60000);
  if (minutes < 1) return 'Just started';
  return `${minutes}m`;
};

const statusConfig = {
  waiting: { label: 'Waiting', color: 'text-amber-600', bg: 'bg-amber-50' },
  active: { label: 'Live', color: 'text-red-600', bg: 'bg-red-50' },
  finished: { label: 'Finished', color: 'text-gray-600', bg: 'bg-gray-50' },
  cancelled: { label: 'Cancelled', color: 'text-red-600', bg: 'bg-red-50' },
};

export const ActiveLiveRoomsPanel: React.FC<ActiveLiveRoomsPanelProps> = ({
  rooms,
  loading,
  onViewAll,
  onJoinRoom,
}) => {
  const activeRooms = rooms.filter(r => r.status === 'active' || r.status === 'waiting');

  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Active Live Rooms</h3>
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 animate-pulse">
              <div className="w-10 h-10 bg-gray-200 rounded-full" />
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-gray-200 rounded w-3/4" />
                <div className="h-3 bg-gray-200 rounded w-1/2" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (activeRooms.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Active Live Rooms</h3>
        <EmptyState
          type="default"
          title="No active rooms"
          description="Start a live quiz battle to engage students in real-time."
          className="border-0 p-0"
        />
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-semibold text-gray-900">Active Live Rooms</h3>
          <span className="bg-red-100 text-red-600 text-xs font-medium px-2 py-1 rounded-full">
            {activeRooms.length}
          </span>
        </div>
        {onViewAll && (
          <button
            onClick={onViewAll}
            className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
          >
            View all
            <ChevronRight className="w-4 h-4" />
          </button>
        )}
      </div>

      <div className="space-y-3">
        {activeRooms.slice(0, 5).map((room) => {
          const status = statusConfig[room.status];

          return (
            <div
              key={room.id}
              className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 transition-colors"
            >
              <div className={`${status.bg} ${status.color} rounded-full p-2`}>
                {room.status === 'active' ? (
                  <Radio className="w-4 h-4 animate-pulse" />
                ) : (
                  <Clock className="w-4 h-4" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-gray-900">
                    {room.quiz?.title || 'Untitled'}
                  </p>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${status.bg} ${status.color}`}>
                    {status.label}
                  </span>
                </div>
                <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                  <span className="font-mono">{room.room_code}</span>
                  <span>•</span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {formatDuration(room.started_at)}
                  </span>
                </div>
              </div>
              {onJoinRoom && (
                <button
                  onClick={() => onJoinRoom(room.room_code)}
                  className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                >
                  <Play className="w-4 h-4" />
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ActiveLiveRoomsPanel;
