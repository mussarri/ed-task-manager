"use client";

import { useRouter } from "next/navigation";
import { joinSession } from "../actions/sessions";
import { useActionState } from "react";

type Session = {
  id: string;
  name: string;
  createdAt: Date;
  allowedUserIds?: string[];
  createdBy: {
    id: string;
    username: string;
  };
  participants: Array<{
    id: string;
    user: {
      id: string;
      username: string;
    };
  }>;
};

type SessionListProps = {
  sessions: Session[];
  currentUserId: string;
  showJoinButton?: boolean;
  userSessionIds?: Set<string>;
};

export default function SessionList({
  sessions,
  currentUserId,
  showJoinButton = false,
  userSessionIds,
}: SessionListProps) {
  const router = useRouter();

  if (sessions.length === 0) {
    return null;
  }

  const handleSessionClick = (sessionId: string, isParticipant: boolean) => {
    if (isParticipant) {
      router.push(`/session/${sessionId}`);
    }
  };

  return (
    <div className="space-y-3">
      {sessions.map((session) => {
        const isParticipant =
          userSessionIds?.has(session.id) ||
          session.participants.some((p) => p.user.id === currentUserId);
        const participantCount = session.participants.length;
        const hasRestriction =
          session.allowedUserIds && session.allowedUserIds.length > 0;
        const canJoin =
          !isParticipant &&
          (!hasRestriction || session.allowedUserIds?.includes(currentUserId));

        return (
          <div
            key={session.id}
            className={`bg-white rounded-lg shadow-sm p-4 border border-gray-200 ${
              isParticipant ? "cursor-pointer hover:shadow-md transition-shadow" : ""
            }`}
            onClick={() => handleSessionClick(session.id, isParticipant)}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-semibold text-gray-800">
                    {session.name}
                  </h3>
                  {isParticipant && (
                    <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded font-medium">
                      Katılıyorsunuz
                    </span>
                  )}
                  {hasRestriction && (
                    <span className="px-2 py-0.5 bg-yellow-100 text-yellow-700 text-xs rounded font-medium">
                      Kısıtlı
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-500 mb-2">
                  Oluşturan: {session.createdBy.username}
                </p>
                <p className="text-xs text-gray-400">
                  {new Date(session.createdAt).toLocaleDateString("tr-TR", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
                <div className="mt-2">
                  <span className="text-xs text-gray-500">
                    {participantCount} katılımcı
                  </span>
                  {participantCount > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {session.participants.slice(0, 5).map((participant) => (
                        <span
                          key={participant.id}
                          className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded"
                        >
                          {participant.user.username}
                        </span>
                      ))}
                      {participantCount > 5 && (
                        <span className="text-xs text-gray-500">
                          +{participantCount - 5} daha
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
              {showJoinButton && !isParticipant && (
                <JoinSessionButton
                  sessionId={session.id}
                  canJoin={canJoin}
                />
              )}
              {isParticipant && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    router.push(`/session/${session.id}`);
                  }}
                  className="ml-4 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-sm font-medium"
                >
                  Giriş Yap
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function JoinSessionButton({
  sessionId,
  canJoin,
}: {
  sessionId: string;
  canJoin: boolean;
}) {
  const [state, formAction] = useActionState(joinSession, null);

  if (!canJoin) {
    return (
      <button
        disabled
        className="ml-4 px-4 py-2 bg-gray-300 text-gray-500 rounded-lg cursor-not-allowed text-sm font-medium"
        title="Bu oturuma giriş izniniz yok"
      >
        İzin Yok
      </button>
    );
  }

  return (
    <form action={formAction}>
      <input type="hidden" name="sessionId" value={sessionId} />
      <button
        type="submit"
        className="ml-4 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors text-sm font-medium"
      >
        Oturuma Katıl
      </button>
      {state?.error && (
        <div className="absolute mt-2 text-xs text-red-600 bg-red-50 p-2 rounded border border-red-200">
          {state.error}
        </div>
      )}
    </form>
  );
}
