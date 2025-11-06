import { redirect } from 'next/navigation'
import { getCurrentUser } from '../actions/auth'
import { getSessions, getUserSessions } from '../actions/sessions'
import SessionList from '../components/SessionList'
import CreateSessionForm from '../components/CreateSessionForm'
import LogoutButton from '../components/LogoutButton'

export default async function SessionsPage() {
  const user = await getCurrentUser()

  if (!user) {
    redirect('/')
  }

  const [allSessions, userSessions] = await Promise.all([
    getSessions(),
    getUserSessions(user.id),
  ])

  const userSessionIds = new Set(userSessions.map((s) => s.id))

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <div className="bg-white shadow-sm border-b sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-800">
            Oturumlar
          </h1>
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-600">{user.username}</span>
            <LogoutButton />
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        <CreateSessionForm />

        <div>
          <h2 className="text-lg font-semibold text-gray-800 mb-3">
            Katıldığım Oturumlar
          </h2>
          {userSessions.length > 0 ? (
            <SessionList sessions={userSessions} currentUserId={user.id} />
          ) : (
            <div className="bg-white rounded-lg shadow-sm p-6 text-center text-gray-500">
              Henüz hiçbir oturuma katılmadınız
            </div>
          )}
        </div>

        <div>
          <h2 className="text-lg font-semibold text-gray-800 mb-3">
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
            <div className="bg-white rounded-lg shadow-sm p-6 text-center text-gray-500">
              Henüz oturum oluşturulmamış
            </div>
          )}
        </div>
      </div>
    </div>
  )
}



