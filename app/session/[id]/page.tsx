import { redirect } from "next/navigation";
import { getCurrentUser } from "../../actions/auth";
import { getSessionById, isUserParticipant } from "@/lib/redis";
import { getPatients } from "../../actions/patients";
import { getAllUsersForSelection } from "../../actions/sessions";
import PatientList from "../../components/PatientList";
import CreatePatientForm from "../../components/CreatePatientForm";
import LogoutButton from "../../components/LogoutButton";
import EndSessionButton from "../../components/EndSessionButton";
import SessionUserManagement from "../../components/SessionUserManagement";
import Link from "next/link";

export default async function SessionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getCurrentUser();

  if (!user) {
    redirect("/");
  }

  const session = await getSessionById(id);

  if (!session) {
    redirect("/");
  }

  // Kullanıcının bu oturuma katılıp katılmadığını kontrol et
  const isParticipant = await isUserParticipant(user.id, id);

  if (!isParticipant) {
    redirect("/");
  }

  const [patients, allUsers] = await Promise.all([
    getPatients(id),
    getAllUsersForSelection(),
  ]);

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <Link
              href="/"
              className="text-sm text-blue-600 hover:text-blue-800 mb-2 inline-block"
            >
              ← Oturumlara Dön
            </Link>
            <h1 className="text-3xl font-bold text-gray-800">{session.name}</h1>
          </div>
          <div className="flex items-center gap-3">
            {session.createdById === user.id && (
              <EndSessionButton sessionId={id} />
            )}
            <LogoutButton />
          </div>
        </div>

        {session.createdById === user.id && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">
              Kullanıcı Yönetimi
            </h2>
            <SessionUserManagement
              sessionId={id}
              allowedUserIds={session.allowedUserIds}
              allUsers={allUsers}
            />
          </div>
        )}

        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">
            Yeni Hasta Ekle
          </h2>
          <CreatePatientForm sessionId={id} />
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">
            Hasta Listesi
          </h2>
          <PatientList patients={patients} />
        </div>
      </div>
    </div>
  );
}

