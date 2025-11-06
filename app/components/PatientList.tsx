"use client";

import { useState, useEffect } from "react";
import {
  toggleTask,
  addTask,
  cancelTask,
  completePatient,
  type TaskState,
} from "../actions/patients";
import { useActionState } from "react";

type Task = {
  id: string;
  name: string;
  completed: boolean;
  cancelled: boolean;
  createdAt: Date;
  createdBy: {
    id: string;
    username: string;
  };
  completedBy: {
    id: string;
    username: string;
  } | null;
  completedAt: Date | null;
  cancelledBy: {
    id: string;
    username: string;
  } | null;
  cancelledAt: Date | null;
};

type Patient = {
  id: string;
  tcNo: string;
  name?: string;
  createdAt: Date;
  completed: boolean;
  completedAt: Date | null;
  completedBy: {
    id: string;
    username: string;
  } | null;
  createdBy: {
    id: string;
    username: string;
  };
  tasks: Task[];
};

type PatientListProps = {
  patients: Patient[];
};

export default function PatientList({ patients }: PatientListProps) {
  const [openPatientId, setOpenPatientId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | "active" | "completed">("all");

  const toggleAccordion = (patientId: string) => {
    setOpenPatientId(openPatientId === patientId ? null : patientId);
  };

  // Filtreleme ve arama
  const filteredPatients = patients.filter((patient) => {
    // Status filtresi
    if (filterStatus === "active" && patient.completed) return false;
    if (filterStatus === "completed" && !patient.completed) return false;

    // Arama
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      return (
        patient.tcNo.toLowerCase().includes(query) ||
        patient.name?.toLowerCase().includes(query) ||
        false
      );
    }

    return true;
  });

  return (
    <div className="space-y-4">
      {/* Arama ve Filtre */}
      <div className="space-y-2">
        <input
          type="text"
          placeholder="TC No veya Hasta Adı ile ara..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <div className="flex gap-2">
          <button
            onClick={() => setFilterStatus("all")}
            className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors ${
              filterStatus === "all"
                ? "bg-blue-500 text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            Tümü
          </button>
          <button
            onClick={() => setFilterStatus("active")}
            className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors ${
              filterStatus === "active"
                ? "bg-blue-500 text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            Aktif
          </button>
          <button
            onClick={() => setFilterStatus("completed")}
            className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors ${
              filterStatus === "completed"
                ? "bg-blue-500 text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            Bitmiş
          </button>
        </div>
      </div>

      {/* Hasta Listesi */}
      <div className="space-y-3">
        {filteredPatients.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            {searchQuery || filterStatus !== "all"
              ? "Arama kriterlerine uygun hasta bulunamadı."
              : "Henüz hasta kaydı bulunmamaktadır."}
          </div>
        ) : (
          filteredPatients.map((patient) => {
            const isOpen = openPatientId === patient.id;
            const completedTasks = patient.tasks.filter((t) => t.completed).length;
            const cancelledTasks = patient.tasks.filter((t) => t.cancelled).length;
            const totalTasks = patient.tasks.length;
            const allTasksCompleted = totalTasks > 0 && patient.tasks.every(
              (t) => t.completed || t.cancelled
            );

            return (
              <div
                key={patient.id}
                className={`bg-white rounded-lg shadow-sm border overflow-hidden ${
                  patient.completed
                    ? "border-gray-300 bg-gray-50"
                    : "border-gray-200"
                }`}
              >
                <button
                  onClick={() => toggleAccordion(patient.id)}
                  className="w-full p-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
                >
                  <div className="flex-1 text-left">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-gray-800">
                        {patient.name ? (
                          <>
                            {patient.name} <span className="text-gray-500 font-normal">({patient.tcNo})</span>
                          </>
                        ) : (
                          `TC No: ${patient.tcNo}`
                        )}
                      </h3>
                      {patient.completed && (
                        <span className="px-2 py-0.5 bg-gray-200 text-gray-700 text-xs rounded font-medium">
                          BİTMİŞ
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-500 mb-1">
                      {completedTasks}/{totalTasks} görev tamamlandı
                      {cancelledTasks > 0 && ` • ${cancelledTasks} iptal edildi`}
                    </p>
                    <div className="flex flex-wrap gap-2 text-xs text-gray-400">
                      <span>Oluşturan: {patient.createdBy.username}</span>
                      <span>•</span>
                      <span>
                        {new Date(patient.createdAt).toLocaleString("tr-TR", {
                          day: "2-digit",
                          month: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                      {patient.completed && patient.completedBy && (
                        <>
                          <span>•</span>
                          <span className="text-green-600">
                            Bitiren: {patient.completedBy.username}
                          </span>
                          {patient.completedAt && (
                            <>
                              <span>•</span>
                              <span>
                                {new Date(patient.completedAt).toLocaleString("tr-TR", {
                                  day: "2-digit",
                                  month: "2-digit",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </span>
                            </>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                  <div className="ml-4">
                    <svg
                      className={`w-5 h-5 text-gray-500 transition-transform ${
                        isOpen ? "transform rotate-180" : ""
                      }`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 9l-7 7-7-7"
                      />
                    </svg>
                  </div>
                </button>

                {isOpen && (
                  <div className="border-t border-gray-200 p-4">
                    <TaskList
                      patientId={patient.id}
                      tasks={patient.tasks}
                      allTasksCompleted={allTasksCompleted}
                      patientCompleted={patient.completed}
                    />
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

function TaskList({
  patientId,
  tasks,
  allTasksCompleted,
  patientCompleted,
}: {
  patientId: string;
  tasks: Task[];
  allTasksCompleted: boolean;
  patientCompleted: boolean;
}) {
  const [isAddingTask, setIsAddingTask] = useState(false);
  const [addTaskState, addTaskAction] = useActionState(addTask, null);
  const [completeState, completeAction] = useActionState(completePatient, null);

  const handleToggleTask = async (taskId: string) => {
    await toggleTask(taskId);
  };

  const handleCancelTask = async (taskId: string) => {
    if (confirm("Bu görevi iptal etmek istediğinizden emin misiniz?")) {
      await cancelTask(taskId);
    }
  };

  const handleCompletePatient = () => {
    if (confirm("Bu hastayı bitirmek istediğinizden emin misiniz?")) {
      const formData = new FormData();
      formData.append("patientId", patientId);
      completeAction(formData);
    }
  };

  // Reset form when task is successfully added
  useEffect(() => {
    if (addTaskState?.success && isAddingTask) {
      setIsAddingTask(false);
    }
  }, [addTaskState?.success, isAddingTask]);

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        {tasks.map((task) => (
          <div
            key={task.id}
            className={`flex items-start gap-3 p-3 rounded-lg ${
              task.cancelled
                ? "bg-red-50 border border-red-200"
                : task.completed
                ? "bg-green-50"
                : "bg-gray-50"
            }`}
          >
            {!task.cancelled && (
              <button
                onClick={() => handleToggleTask(task.id)}
                disabled={patientCompleted}
                className={`flex-shrink-0 w-6 h-6 rounded border-2 flex items-center justify-center transition-colors mt-0.5 ${
                  patientCompleted
                    ? "bg-gray-200 border-gray-300 cursor-not-allowed opacity-50"
                    : task.completed
                    ? "bg-green-500 border-green-500"
                    : "border-gray-300 hover:border-green-400"
                }`}
                title={patientCompleted ? "Bitmiş hastanın görevlerine dokunulamaz" : ""}
              >
                {task.completed && (
                  <svg
                    className="w-4 h-4 text-white"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                )}
              </button>
            )}
            {task.cancelled && (
              <div className="flex-shrink-0 w-6 h-6 rounded border-2 border-red-400 bg-red-100 flex items-center justify-center mt-0.5">
                <svg
                  className="w-4 h-4 text-red-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <span
                  className={`block ${
                    task.completed || task.cancelled
                      ? "line-through text-gray-500"
                      : "text-gray-800 font-medium"
                  }`}
                >
                  {task.name}
                </span>
                {!task.cancelled && !task.completed && !patientCompleted && (
                  <button
                    onClick={() => handleCancelTask(task.id)}
                    className="text-xs px-2 py-1 text-red-600 hover:bg-red-100 rounded transition-colors"
                  >
                    İptal
                  </button>
                )}
              </div>
              <div className="mt-1 flex flex-wrap gap-2 text-xs text-gray-500">
                <span>
                  Ekleyen: {task.createdBy.username} (
                  {new Date(task.createdAt).toLocaleTimeString("tr-TR", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                  )
                </span>
                {task.completed && task.completedBy && (
                  <>
                    <span>•</span>
                    <span className="text-green-600">
                      Tamamlayan: {task.completedBy.username}
                    </span>
                    {task.completedAt && (
                      <>
                        <span>•</span>
                        <span>
                          {new Date(task.completedAt).toLocaleTimeString("tr-TR", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </>
                    )}
                  </>
                )}
                {task.cancelled && task.cancelledBy && (
                  <>
                    <span>•</span>
                    <span className="text-red-600">
                      İptal eden: {task.cancelledBy.username}
                    </span>
                    {task.cancelledAt && (
                      <>
                        <span>•</span>
                        <span>
                          {new Date(task.cancelledAt).toLocaleTimeString("tr-TR", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {addTaskState?.error && (
        <div className="text-sm text-red-600 bg-red-50 p-2 rounded">
          {addTaskState.error}
        </div>
      )}

      {completeState?.error && (
        <div className="text-sm text-red-600 bg-red-50 p-2 rounded">
          {completeState.error}
        </div>
      )}

      {!patientCompleted && allTasksCompleted && (
        <button
          onClick={handleCompletePatient}
          className="w-full px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors font-medium"
        >
          ✓ Hastayı Bitir
        </button>
      )}

      {!patientCompleted && (
        <>
          {isAddingTask ? (
            <form action={addTaskAction} className="space-y-2">
              <input type="hidden" name="patientId" value={patientId} />
              <div className="flex gap-2">
                <input
                  type="text"
                  name="taskName"
                  placeholder="Yeni görev adı"
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  autoFocus
                  required
                />
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                >
                  Ekle
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsAddingTask(false);
                  }}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                >
                  İptal
                </button>
              </div>
            </form>
          ) : (
            <button
              onClick={() => setIsAddingTask(true)}
              className="w-full px-4 py-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors font-medium"
            >
              + Yeni Görev Ekle
            </button>
          )}
        </>
      )}
    </div>
  );
}
