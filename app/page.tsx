import { redirect } from "next/navigation";
import { getCurrentUser } from "./actions/auth";
import LoginForm from "./components/LoginForm";
import {
  getSessions,
  getUserSessions,
  getAllUsersForSelection,
} from "./actions/sessions";
import SessionList from "./components/SessionList";
import CreateSessionForm from "./components/CreateSessionForm";
import LogoutButton from "./components/LogoutButton";

export default async function HomePage() {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-lg shadow-md p-6">
            <h1 className="text-2xl font-bold text-center mb-6 text-gray-800">
              Acil Servis Görev Yönetimi
            </h1>
            <LoginForm />
          </div>
        </div>
      </div>
    );
  }

  const [allSessions, userSessions, allUsers] = await Promise.all([
    getSessions(),
    getUserSessions(user.id),
    getAllUsersForSelection(),
  ]);

  const userSessionIds = new Set(userSessions.map((s) => s.id));

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold text-gray-800">Oturumlar</h1>
          <LogoutButton />
        </div>

        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <CreateSessionForm users={allUsers} />
        </div>

        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">
            Katıldığım Oturumlar
          </h2>
          {userSessions.length > 0 ? (
            <SessionList
              sessions={userSessions.map((s) => {
                const fullSession = allSessions.find((as) => as.id === s.id);
                return fullSession || {
                  id: s.id,
                  name: s.name,
                  createdAt: s.createdAt,
                  createdBy: { id: "", username: "" },
                  participants: [],
                };
              })}
              currentUserId={user.id}
            />
          ) : (
            <div className="text-center py-8 text-gray-500">
              Henüz hiçbir oturuma katılmadınız
            </div>
          )}
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">
            Tüm Oturumlar
          </h2>
          {allSessions.length > 0 ? (
            <SessionList
              sessions={allSessions}
              currentUserId={user.id}
              showJoinButton={true}
              userSessionIds={userSessionIds}
            />
          ) : (
            <div className="text-center py-8 text-gray-500">
              Henüz oturum oluşturulmamış
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
