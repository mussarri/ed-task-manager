"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "./auth";
import {
  createPatientInRedis,
  getPatientByTcNo,
  getAllPatientsWithTasks,
  getSessionPatientsWithTasks,
  getPatientWithTasks,
  addTaskToPatient,
  toggleTaskInRedis,
  cancelTaskInRedis,
  completePatientInRedis,
  getUserById,
  redis,
  taskKey,
  type Patient,
  type Task,
} from "@/lib/redis";

export type PatientState = {
  error?: string;
  success?: boolean;
  patientId?: string;
};

export type TaskState = {
  error?: string;
  success?: boolean;
};

export async function createPatient(
  prevState: PatientState | null,
  formData: FormData
): Promise<PatientState> {
  const tcNo = formData.get("tcNo") as string;
  const name = formData.get("name") as string;
  const sessionId = formData.get("sessionId") as string;

  if (!tcNo || tcNo.trim().length === 0) {
    return { error: "TC No gereklidir" };
  }

  if (!sessionId) {
    return { error: "Oturum ID gereklidir" };
  }

  // TC No validasyonu (11 haneli olmalı)
  if (!/^\d{11}$/.test(tcNo.trim())) {
    return { error: "TC No 11 haneli olmalıdır" };
  }

  try {
    const user = await getCurrentUser();
    if (!user) {
      return { error: "Giriş yapmanız gerekiyor" };
    }

    // TC No'nun zaten var olup olmadığını kontrol et (aynı oturumda)
    const existingPatient = await getPatientByTcNo(tcNo.trim());
    if (existingPatient && existingPatient.sessionId === sessionId) {
      return { error: "Bu TC No ile kayıtlı hasta zaten mevcut" };
    }

    // Hastayı oluştur ve default task'ları ekle
    const patient = await createPatientInRedis(
      tcNo.trim(),
      user.id,
      sessionId,
      name?.trim()
    );

    revalidatePath(`/session/${sessionId}`);
    return { success: true, patientId: patient.id };
  } catch (error) {
    console.error("Create patient error:", error);
    return { error: "Hasta oluşturulurken bir hata oluştu" };
  }
}

export async function getPatients(sessionId?: string) {
  try {
    const patientsWithTasks = sessionId
      ? await getSessionPatientsWithTasks(sessionId)
      : await getAllPatientsWithTasks();

    // Kullanıcı bilgilerini al
    const allUserIds = new Set<string>();
    patientsWithTasks.forEach(({ patient, tasks }) => {
      allUserIds.add(patient.createdById);
      if (patient.completedById) {
        allUserIds.add(patient.completedById);
      }
      tasks.forEach((task) => {
        allUserIds.add(task.createdById);
        if (task.completedById) {
          allUserIds.add(task.completedById);
        }
        if (task.cancelledById) {
          allUserIds.add(task.cancelledById);
        }
      });
    });

    const users = await Promise.all(
      Array.from(allUserIds).map(async (userId) => {
        const user = await getUserById(userId);
        return user ? { id: user.id, username: user.username } : null;
      })
    );

    const userMap = new Map(
      users
        .filter((u): u is { id: string; username: string } => u !== null)
        .map((u) => [u.id, u.username])
    );

    // Prisma formatına uygun hale getir ve sırala
    const patients = patientsWithTasks.map(({ patient, tasks }) => {
      // Tamamlanmamış görev sayısını hesapla (iptal edilmemiş ve tamamlanmamış)
      const incompleteTasks = tasks.filter(
        (t) => !t.completed && !t.cancelled
      ).length;

      return {
        id: patient.id,
        tcNo: patient.tcNo,
        name: patient.name,
        createdAt: new Date(patient.createdAt),
        updatedAt: new Date(patient.updatedAt),
        completed: patient.completed || false,
        completedAt: patient.completedAt ? new Date(patient.completedAt) : null,
        completedBy: patient.completedById
          ? {
              id: patient.completedById,
              username: userMap.get(patient.completedById) || "Bilinmeyen",
            }
          : null,
        createdBy: {
          id: patient.createdById,
          username: userMap.get(patient.createdById) || "Bilinmeyen",
        },
        incompleteTasksCount: incompleteTasks,
        tasks: tasks.map((task) => ({
          id: task.id,
          name: task.name,
          completed: task.completed,
          cancelled: task.cancelled,
          createdAt: new Date(task.createdAt),
          updatedAt: new Date(task.updatedAt),
          patientId: task.patientId,
          createdBy: {
            id: task.createdById,
            username: userMap.get(task.createdById) || "Bilinmeyen",
          },
          completedBy: task.completedById
            ? {
                id: task.completedById,
                username: userMap.get(task.completedById) || "Bilinmeyen",
              }
            : null,
          completedAt: task.completedAt ? new Date(task.completedAt) : null,
          cancelledBy: task.cancelledById
            ? {
                id: task.cancelledById,
                username: userMap.get(task.cancelledById) || "Bilinmeyen",
              }
            : null,
          cancelledAt: task.cancelledAt ? new Date(task.cancelledAt) : null,
        })),
      };
    });

    // Sıralama: Bitmiş olanlar en alta, bitmemiş olanlar tamamlanmamış görev sayısına göre (en çok olan en başa)
    patients.sort((a, b) => {
      // Önce bitmiş olanları en alta
      if (a.completed && !b.completed) return 1;
      if (!a.completed && b.completed) return -1;

      // Bitmiş olanlar arasında tarihe göre sırala
      if (a.completed && b.completed) {
        return (
          (b.completedAt?.getTime() || 0) - (a.completedAt?.getTime() || 0)
        );
      }

      // Bitmemiş olanlar arasında tamamlanmamış görev sayısına göre sırala (en çok olan en başa)
      return b.incompleteTasksCount - a.incompleteTasksCount;
    });

    return patients;
  } catch (error) {
    console.error("Get patients error:", error);
    return [];
  }
}

export async function addTask(
  prevState: TaskState | null,
  formData: FormData
): Promise<TaskState> {
  const patientId = formData.get("patientId") as string;
  const taskName = formData.get("taskName") as string;

  if (!patientId) {
    return { error: "Hasta ID gereklidir" };
  }

  if (!taskName || taskName.trim().length === 0) {
    return { error: "Görev adı gereklidir" };
  }

  try {
    const user = await getCurrentUser();
    if (!user) {
      return { error: "Giriş yapmanız gerekiyor" };
    }

    // Check if patient is completed
    const patientData = await getPatientWithTasks(patientId);
    if (!patientData) {
      return { error: "Hasta bulunamadı" };
    }

    if (patientData.patient.completed) {
      return { error: "Bitmiş hastaya görev eklenemez" };
    }

    await addTaskToPatient(patientId, taskName.trim(), user.id);

    // Get patient to find sessionId
    const updatedPatientData = await getPatientWithTasks(patientId);
    if (updatedPatientData) {
      revalidatePath(`/session/${updatedPatientData.patient.sessionId}`);
    } else {
      revalidatePath("/");
    }
    return { success: true };
  } catch (error) {
    console.error("Add task error:", error);
    return { error: "Görev eklenirken bir hata oluştu" };
  }
}

export async function toggleTask(taskId: string): Promise<TaskState> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { error: "Giriş yapmanız gerekiyor" };
    }

    // First get task to find patient
    const taskData = await redis.get(taskKey(taskId));
    if (!taskData) {
      return { error: "Görev bulunamadı" };
    }

    const task = JSON.parse(taskData) as Task;

    // Check if patient is completed
    const patientData = await getPatientWithTasks(task.patientId);
    if (!patientData) {
      return { error: "Hasta bulunamadı" };
    }

    if (patientData.patient.completed) {
      return { error: "Bitmiş hastanın görevlerine dokunulamaz" };
    }

    const updatedTask = await toggleTaskInRedis(taskId, user.id);

    if (!updatedTask) {
      return { error: "Görev güncellenemedi" };
    }

    // Get patient to find sessionId
    const updatedPatientData = await getPatientWithTasks(task.patientId);
    if (updatedPatientData) {
      revalidatePath(`/session/${updatedPatientData.patient.sessionId}`);
    } else {
      revalidatePath("/");
    }
    return { success: true };
  } catch (error) {
    console.error("Toggle task error:", error);
    return { error: "Görev güncellenirken bir hata oluştu" };
  }
}

export async function cancelTask(taskId: string): Promise<TaskState> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { error: "Giriş yapmanız gerekiyor" };
    }

    // First get task to find patient
    const taskData = await redis.get(taskKey(taskId));
    if (!taskData) {
      return { error: "Görev bulunamadı" };
    }

    const task = JSON.parse(taskData) as Task;

    // Check if patient is completed
    const patientData = await getPatientWithTasks(task.patientId);
    if (!patientData) {
      return { error: "Hasta bulunamadı" };
    }

    if (patientData.patient.completed) {
      return { error: "Bitmiş hastanın görevlerine dokunulamaz" };
    }

    const updatedTask = await cancelTaskInRedis(taskId, user.id);

    if (!updatedTask) {
      return { error: "Görev iptal edilemedi" };
    }

    // Get patient to find sessionId
    const updatedPatientData = await getPatientWithTasks(task.patientId);
    if (updatedPatientData) {
      revalidatePath(`/session/${updatedPatientData.patient.sessionId}`);
    } else {
      revalidatePath("/");
    }
    return { success: true };
  } catch (error) {
    console.error("Cancel task error:", error);
    return { error: "Görev iptal edilirken bir hata oluştu" };
  }
}

export async function completePatient(
  prevState: PatientState | null,
  formData: FormData
): Promise<PatientState> {
  const patientId = formData.get("patientId") as string;

  if (!patientId) {
    return { error: "Hasta ID gereklidir" };
  }

  try {
    const user = await getCurrentUser();
    if (!user) {
      return { error: "Giriş yapmanız gerekiyor" };
    }

    const patient = await completePatientInRedis(patientId, user.id);

    if (!patient) {
      return { error: "Hasta bulunamadı" };
    }

    revalidatePath(`/session/${patient.sessionId}`);
    return { success: true };
  } catch (error) {
    console.error("Complete patient error:", error);
    return { error: "Hasta bitirilirken bir hata oluştu" };
  }
}
