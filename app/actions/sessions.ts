"use server";

import { getCurrentUser } from "./auth";
import { revalidatePath } from "next/cache";
import {
  createSessionInRedis,
  getSessionById,
  getAllSessionsWithParticipants,
  addParticipantToSession,
  isUserParticipant,
  canUserJoinSession,
  getUserSessions as getUserSessionsFromRedis,
  getAllUsers,
  createUserInRedis,
  getUserByUsername,
  getUserById,
  getActiveSession,
  endSessionInRedis,
  addUserToSession,
  removeUserFromSession,
  type Session,
  type User,
} from "@/lib/redis";

export type SessionState = {
  error?: string;
  success?: boolean;
  sessionId?: string;
};

export async function createSession(
  prevState: SessionState | null,
  formData: FormData
): Promise<SessionState> {
  const user = await getCurrentUser();

  if (!user) {
    return { error: "Giriş yapmanız gerekiyor" };
  }

  const sessionName = formData.get("name") as string;
  const allowedUsers = formData.getAll("allowedUsers") as string[];
  const newUserNames = formData.getAll("newUsers") as string[];

  if (!sessionName || sessionName.trim().length === 0) {
    return { error: "Oturum adı gereklidir" };
  }

  if (sessionName.trim().length < 2) {
    return { error: "Oturum adı en az 2 karakter olmalıdır" };
  }

  try {
    // Yeni kullanıcıları oluştur
    const newUserIds: string[] = [];
    for (const username of newUserNames) {
      if (username && username.trim().length >= 2) {
        let newUser = await getUserByUsername(username.trim());
        if (!newUser) {
          newUser = await createUserInRedis(username.trim());
        }
        newUserIds.push(newUser.id);
      }
    }

    // Tüm izin verilen kullanıcı ID'lerini birleştir
    const allAllowedUserIds = [...allowedUsers, ...newUserIds].filter(
      (id) => id && id.length > 0
    );

    const allowedUserIds =
      allAllowedUserIds.length > 0 ? allAllowedUserIds : undefined;

    const session = await createSessionInRedis(
      sessionName.trim(),
      user.id,
      allowedUserIds
    );

    revalidatePath("/");
    revalidatePath(`/session/${session.id}`);
    return { success: true, sessionId: session.id };
  } catch (error) {
    console.error("Create session error:", error);
    return {
      error:
        error instanceof Error
          ? error.message
          : "Oturum oluşturulurken bir hata oluştu",
    };
  }
}

export async function joinSession(
  prevState: SessionState | null,
  formData: FormData
): Promise<SessionState> {
  const user = await getCurrentUser();

  if (!user) {
    return { error: "Giriş yapmanız gerekiyor" };
  }

  const sessionId = formData.get("sessionId") as string;

  if (!sessionId) {
    return { error: "Oturum ID gereklidir" };
  }

  try {
    // İzin kontrolü
    const canJoin = await canUserJoinSession(user.id, sessionId);

    if (!canJoin.canJoin) {
      return { error: canJoin.reason || "Bu oturuma katılamazsınız" };
    }

    // Oturuma katıl
    await addParticipantToSession(user.id, sessionId);

    revalidatePath("/");
    return { success: true, sessionId: sessionId };
  } catch (error) {
    console.error("Join session error:", error);
    return { error: "Oturuma katılırken bir hata oluştu" };
  }
}

export async function getSessions() {
  try {
    const sessionsWithParticipants = await getAllSessionsWithParticipants();

    // Prisma formatına uygun hale getir (UI uyumluluğu için)
    return sessionsWithParticipants.map(
      ({ session, createdBy, participants }) => ({
        id: session.id,
        name: session.name,
        createdAt: new Date(session.createdAt),
        updatedAt: new Date(session.updatedAt),
        createdById: session.createdById,
        allowedUserIds: session.allowedUserIds,
        createdBy: {
          id: createdBy.id,
          username: createdBy.username,
          createdAt: new Date(createdBy.createdAt),
          updatedAt: new Date(createdBy.updatedAt),
        },
        participants: participants.map(({ participant, user }) => ({
          id: participant.id,
          userId: participant.userId,
          sessionId: participant.sessionId,
          joinedAt: new Date(participant.joinedAt),
          user: {
            id: user.id,
            username: user.username,
            createdAt: new Date(user.createdAt),
            updatedAt: new Date(user.updatedAt),
          },
        })),
      })
    );
  } catch (error) {
    console.error("Get sessions error:", error);
    return [];
  }
}

export async function getAllUsersForSelection() {
  try {
    const users = await getAllUsers();
    return users.map((user) => ({
      id: user.id,
      username: user.username,
    }));
  } catch (error) {
    console.error("Get all users error:", error);
    return [];
  }
}

export async function getUserSessions(userId: string) {
  try {
    const sessions = await getUserSessionsFromRedis(userId);

    // Prisma formatına uygun hale getir (UI uyumluluğu için)
    // Bu fonksiyon sadece session listesi döndürüyor, participants bilgisi yok
    // Eğer participants bilgisi gerekiyorsa getSessions kullanılmalı
    return sessions.map((session) => ({
      id: session.id,
      name: session.name,
      createdAt: new Date(session.createdAt),
      updatedAt: new Date(session.updatedAt),
      createdById: session.createdById,
    }));
  } catch (error) {
    console.error("Get user sessions error:", error);
    return [];
  }
}

export async function endSession(
  prevState: SessionState | null,
  formData: FormData
): Promise<SessionState> {
  const user = await getCurrentUser();

  if (!user) {
    return { error: "Giriş yapmanız gerekiyor" };
  }

  const sessionId = formData.get("sessionId") as string;

  if (!sessionId) {
    return { error: "Oturum ID gereklidir" };
  }

  try {
    await endSessionInRedis(sessionId, user.id);

    revalidatePath("/");
    revalidatePath(`/session/${sessionId}`);
    return { success: true };
  } catch (error) {
    console.error("End session error:", error);
    return {
      error:
        error instanceof Error
          ? error.message
          : "Oturum sonlandırılırken bir hata oluştu",
    };
  }
}

export async function getActiveSessionForUI() {
  try {
    const session = await getActiveSession();
    if (!session) return null;

    const createdBy = await getUserById(session.createdById);
    if (!createdBy) return null;

    return {
      id: session.id,
      name: session.name,
      createdAt: new Date(session.createdAt),
      updatedAt: new Date(session.updatedAt),
      createdById: session.createdById,
      createdBy: {
        id: createdBy.id,
        username: createdBy.username,
        createdAt: new Date(createdBy.createdAt),
        updatedAt: new Date(createdBy.updatedAt),
      },
    };
  } catch (error) {
    console.error("Get active session error:", error);
    return null;
  }
}

export async function addUserToSessionAction(
  prevState: SessionState | null,
  formData: FormData
): Promise<SessionState> {
  const user = await getCurrentUser();

  if (!user) {
    return { error: "Giriş yapmanız gerekiyor" };
  }

  const sessionId = formData.get("sessionId") as string;
  const userId = formData.get("userId") as string;

  if (!sessionId || !userId) {
    return { error: "Oturum ID ve Kullanıcı ID gereklidir" };
  }

  try {
    await addUserToSession(sessionId, userId, user.id);

    revalidatePath(`/session/${sessionId}`);
    return { success: true, sessionId };
  } catch (error) {
    console.error("Add user to session error:", error);
    return {
      error:
        error instanceof Error
          ? error.message
          : "Kullanıcı eklenirken bir hata oluştu",
    };
  }
}

export async function createUserAndAddToSession(
  username: string,
  sessionId: string
): Promise<{ success: boolean; error?: string; userId?: string }> {
  const user = await getCurrentUser();

  if (!user) {
    return { success: false, error: "Giriş yapmanız gerekiyor" };
  }

  try {
    // Check if user is creator
    const session = await getSessionById(sessionId);
    if (!session) {
      return { success: false, error: "Oturum bulunamadı" };
    }

    if (session.createdById !== user.id) {
      return {
        success: false,
        error: "Sadece oturumu oluşturan kişi kullanıcı ekleyebilir",
      };
    }

    // Create or get user
    let newUser = await getUserByUsername(username.trim());
    if (!newUser) {
      newUser = await createUserInRedis(username.trim());
    }

    // Add to session
    await addUserToSession(sessionId, newUser.id, user.id);

    revalidatePath(`/session/${sessionId}`);
    return { success: true, userId: newUser.id };
  } catch (error) {
    console.error("Create user and add to session error:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Kullanıcı oluşturulurken bir hata oluştu",
    };
  }
}

export async function removeUserFromSessionAction(
  prevState: SessionState | null,
  formData: FormData
): Promise<SessionState> {
  const user = await getCurrentUser();

  if (!user) {
    return { error: "Giriş yapmanız gerekiyor" };
  }

  const sessionId = formData.get("sessionId") as string;
  const userId = formData.get("userId") as string;

  if (!sessionId || !userId) {
    return { error: "Oturum ID ve Kullanıcı ID gereklidir" };
  }

  try {
    await removeUserFromSession(sessionId, userId, user.id);

    revalidatePath(`/session/${sessionId}`);
    return { success: true, sessionId };
  } catch (error) {
    console.error("Remove user from session error:", error);
    return {
      error:
        error instanceof Error
          ? error.message
          : "Kullanıcı çıkarılırken bir hata oluştu",
    };
  }
}
