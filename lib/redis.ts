import Redis from "ioredis";

const globalForRedis = globalThis as unknown as {
  redis: Redis | undefined;
};

// Redis connection configuration
function createRedisClient(): Redis {
  const redisUrl = process.env.REDIS_URL;

  // Eğer REDIS_URL varsa ve geçerli bir URL ise kullan
  if (redisUrl) {
    try {
      // URL'den db parametresini kontrol et ve düzelt
      const url = new URL(redisUrl);
      const dbParam = url.searchParams.get("db");
      let dbFixed = false;

      if (dbParam !== null) {
        const db = parseInt(dbParam, 10);
        // DB index 0-15 arasında olmalı (Redis default)
        if (isNaN(db) || db < 0 || db > 15) {
          console.warn(`Geçersiz Redis DB index: ${dbParam}, 0 kullanılıyor`);
          url.searchParams.set("db", "0");
          dbFixed = true;
        }
      }

      // Düzeltilmiş URL'i kullan
      const finalUrl = dbFixed ? url.toString() : redisUrl;

      return new Redis(finalUrl, {
        retryStrategy: (times) => {
          const delay = Math.min(times * 50, 2000);
          return delay;
        },
        maxRetriesPerRequest: 3,
        enableReadyCheck: true,
      });
    } catch (error) {
      // URL parse edilemezse default yapılandırma kullan
      console.warn(
        "Redis URL parse edilemedi, default ayarlar kullanılıyor:",
        error
      );
    }
  }

  // Default yapılandırma (db: 0)
  return new Redis({
    host: "localhost",
    port: 6379,
    db: 0,
    retryStrategy: (times) => {
      const delay = Math.min(times * 50, 2000);
      return delay;
    },
    maxRetriesPerRequest: 3,
    enableReadyCheck: true,
  });
}

export const redis = globalForRedis.redis ?? createRedisClient();

// Error handling
redis.on("error", (err) => {
  console.error("Redis connection error:", err);
});

redis.on("connect", () => {
  console.log("Redis connected");
});

redis.on("ready", () => {
  console.log("Redis ready");
});

if (process.env.NODE_ENV !== "production") {
  globalForRedis.redis = redis;
}

// 24 saat expire (saniye cinsinden)
const EXPIRE_24H = 60 * 60 * 24; // 86400 saniye

// Helper functions for patient and task management

export interface Patient {
  id: string;
  tcNo: string;
  name?: string;
  createdAt: string;
  updatedAt: string;
  createdById: string;
  sessionId: string;
  completed?: boolean;
  completedAt?: string;
  completedById?: string;
}

export interface Task {
  id: string;
  name: string;
  completed: boolean;
  cancelled: boolean;
  createdAt: string;
  updatedAt: string;
  patientId: string;
  createdById: string;
  completedById?: string;
  completedAt?: string;
  cancelledById?: string;
  cancelledAt?: string;
}

export interface User {
  id: string;
  username: string;
  createdAt: string;
  updatedAt: string;
}

export interface Session {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  createdById: string;
  allowedUserIds?: string[]; // İzin verilen kullanıcı ID'leri (boş ise herkes girebilir)
}

export interface SessionParticipant {
  id: string;
  userId: string;
  sessionId: string;
  joinedAt: string;
}

// Key generators
const patientKey = (id: string) => `patient:${id}`;
const patientTcKey = (tcNo: string) => `patient:tc:${tcNo}`;
const patientTasksKey = (patientId: string) => `patient:${patientId}:tasks`;
const taskKey = (id: string) => `task:${id}`;
const patientsAllKey = () => "patients:all";

const userKey = (id: string) => `user:${id}`;
const userUsernameKey = (username: string) => `user:username:${username}`;
const usersAllKey = () => "users:all";

const sessionKey = (id: string) => `session:${id}`;
const sessionsAllKey = () => "sessions:all";
const sessionParticipantsKey = (sessionId: string) =>
  `session:${sessionId}:participants`;
const sessionPatientsKey = (sessionId: string) =>
  `session:${sessionId}:patients`;
const userSessionsKey = (userId: string) => `user:${userId}:sessions`;
const sessionParticipantKey = (userId: string, sessionId: string) =>
  `session:participant:${userId}:${sessionId}`;

// Patient operations
export async function createPatientInRedis(
  tcNo: string,
  createdById: string,
  sessionId: string,
  name?: string,
  defaultTasks: string[] = ["anamnez", "3tup kan", "dosya girişi"]
): Promise<Patient> {
  const id = `pat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const now = new Date().toISOString();

  const patient: Patient = {
    id,
    tcNo: tcNo.trim(),
    name: name?.trim(),
    createdAt: now,
    updatedAt: now,
    createdById,
    sessionId,
    completed: false,
  };

  // Store patient data with 24h expire
  await redis.setex(patientKey(id), EXPIRE_24H, JSON.stringify(patient));

  // Store TC No lookup with 24h expire
  await redis.setex(patientTcKey(tcNo.trim()), EXPIRE_24H, id);

  // Add to patients list (sorted set with timestamp as score for ordering)
  await redis.zadd(patientsAllKey(), Date.now(), id);
  await redis.expire(patientsAllKey(), EXPIRE_24H);

  // Add to session patients list
  await redis.zadd(sessionPatientsKey(sessionId), Date.now(), id);
  await redis.expire(sessionPatientsKey(sessionId), EXPIRE_24H);

  // Create default tasks
  const tasks: Task[] = [];
  for (const taskName of defaultTasks) {
    const taskId = `task_${Date.now()}_${Math.random()
      .toString(36)
      .substr(2, 9)}`;
    const task: Task = {
      id: taskId,
      name: taskName,
      completed: false,
      cancelled: false,
      createdAt: now,
      updatedAt: now,
      patientId: id,
      createdById,
    };

    await redis.setex(taskKey(taskId), EXPIRE_24H, JSON.stringify(task));
    await redis.rpush(patientTasksKey(id), taskId);
    await redis.expire(patientTasksKey(id), EXPIRE_24H);
    tasks.push(task);
  }

  return patient;
}

export async function getPatientByTcNo(tcNo: string): Promise<Patient | null> {
  const patientId = await redis.get(patientTcKey(tcNo.trim()));
  if (!patientId) return null;

  const patientData = await redis.get(patientKey(patientId));
  if (!patientData) return null;

  return JSON.parse(patientData) as Patient;
}

export async function getAllPatients(): Promise<Patient[]> {
  // Get all patient IDs from sorted set (descending order by timestamp)
  const patientIds = await redis.zrevrange(patientsAllKey(), 0, -1);

  if (patientIds.length === 0) return [];

  // Get all patient data
  const patients = await Promise.all(
    patientIds.map(async (id) => {
      const data = await redis.get(patientKey(id));
      return data ? (JSON.parse(data) as Patient) : null;
    })
  );

  return patients.filter((p): p is Patient => p !== null);
}

export async function getPatientWithTasks(patientId: string): Promise<{
  patient: Patient;
  tasks: Task[];
} | null> {
  const patientData = await redis.get(patientKey(patientId));
  if (!patientData) return null;

  const patient = JSON.parse(patientData) as Patient;

  // Get task IDs
  const taskIds = await redis.lrange(patientTasksKey(patientId), 0, -1);

  // Get all tasks
  const tasks = await Promise.all(
    taskIds.map(async (taskId) => {
      const taskData = await redis.get(taskKey(taskId));
      return taskData ? (JSON.parse(taskData) as Task) : null;
    })
  );

  const validTasks = tasks.filter((t): t is Task => t !== null);

  // Sort by createdAt
  validTasks.sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );

  return { patient, tasks: validTasks };
}

export async function getAllPatientsWithTasks(): Promise<
  Array<{
    patient: Patient;
    tasks: Task[];
  }>
> {
  const patients = await getAllPatients();

  const patientsWithTasks = await Promise.all(
    patients.map(async (patient) => {
      const result = await getPatientWithTasks(patient.id);
      return result || { patient, tasks: [] };
    })
  );

  return patientsWithTasks;
}

export async function getSessionPatientsWithTasks(sessionId: string): Promise<
  Array<{
    patient: Patient;
    tasks: Task[];
  }>
> {
  // Get patient IDs from session patients sorted set
  const patientIds = await redis.zrevrange(
    sessionPatientsKey(sessionId),
    0,
    -1
  );

  if (patientIds.length === 0) return [];

  const patientsWithTasks = await Promise.all(
    patientIds.map(async (patientId) => {
      const result = await getPatientWithTasks(patientId);
      return result;
    })
  );

  return patientsWithTasks.filter(
    (p): p is { patient: Patient; tasks: Task[] } => p !== null
  );
}

// Task operations
export async function addTaskToPatient(
  patientId: string,
  taskName: string,
  createdById: string
): Promise<Task> {
  const taskId = `task_${Date.now()}_${Math.random()
    .toString(36)
    .substr(2, 9)}`;
  const now = new Date().toISOString();

  const task: Task = {
    id: taskId,
    name: taskName.trim(),
    completed: false,
    cancelled: false,
    createdAt: now,
    updatedAt: now,
    patientId,
    createdById,
  };

  await redis.setex(taskKey(taskId), EXPIRE_24H, JSON.stringify(task));
  await redis.rpush(patientTasksKey(patientId), taskId);
  await redis.expire(patientTasksKey(patientId), EXPIRE_24H);

  // Update patient updatedAt
  const patientData = await redis.get(patientKey(patientId));
  if (patientData) {
    const patient = JSON.parse(patientData) as Patient;
    patient.updatedAt = now;
    await redis.setex(
      patientKey(patientId),
      EXPIRE_24H,
      JSON.stringify(patient)
    );
  }

  return task;
}

export async function toggleTaskInRedis(
  taskId: string,
  userId: string
): Promise<Task | null> {
  const taskData = await redis.get(taskKey(taskId));
  if (!taskData) return null;

  const task = JSON.parse(taskData) as Task;
  const now = new Date().toISOString();
  const wasCompleted = task.completed;

  // İptal edilmiş görevler tamamlanamaz
  if (task.cancelled) {
    return task;
  }

  task.completed = !task.completed;
  task.updatedAt = now;

  if (task.completed && !wasCompleted) {
    // Görev tamamlandı
    task.completedById = userId;
    task.completedAt = now;
  } else if (!task.completed && wasCompleted) {
    // Görev tamamlanmamış olarak işaretlendi
    task.completedById = undefined;
    task.completedAt = undefined;
  }

  await redis.setex(taskKey(taskId), EXPIRE_24H, JSON.stringify(task));

  // Update patient updatedAt
  const patientData = await redis.get(patientKey(task.patientId));
  if (patientData) {
    const patient = JSON.parse(patientData) as Patient;
    patient.updatedAt = task.updatedAt;
    await redis.setex(
      patientKey(task.patientId),
      EXPIRE_24H,
      JSON.stringify(patient)
    );
  }

  return task;
}

export async function cancelTaskInRedis(
  taskId: string,
  userId: string
): Promise<Task | null> {
  const taskData = await redis.get(taskKey(taskId));
  if (!taskData) return null;

  const task = JSON.parse(taskData) as Task;
  const now = new Date().toISOString();

  task.cancelled = true;
  task.cancelledById = userId;
  task.cancelledAt = now;
  task.updatedAt = now;

  await redis.setex(taskKey(taskId), EXPIRE_24H, JSON.stringify(task));

  // Update patient updatedAt
  const patientData = await redis.get(patientKey(task.patientId));
  if (patientData) {
    const patient = JSON.parse(patientData) as Patient;
    patient.updatedAt = now;
    await redis.setex(
      patientKey(task.patientId),
      EXPIRE_24H,
      JSON.stringify(patient)
    );
  }

  return task;
}

export async function completePatientInRedis(
  patientId: string,
  userId: string
): Promise<Patient | null> {
  const patientData = await redis.get(patientKey(patientId));
  if (!patientData) return null;

  const patient = JSON.parse(patientData) as Patient;
  const now = new Date().toISOString();

  patient.completed = true;
  patient.completedAt = now;
  patient.completedById = userId;
  patient.updatedAt = now;

  await redis.setex(patientKey(patientId), EXPIRE_24H, JSON.stringify(patient));

  return patient;
}

// User operations
export async function createUserInRedis(username: string): Promise<User> {
  const id = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const now = new Date().toISOString();

  const user: User = {
    id,
    username: username.trim(),
    createdAt: now,
    updatedAt: now,
  };

  // Store user data with 24h expire
  await redis.setex(userKey(id), EXPIRE_24H, JSON.stringify(user));

  // Store username lookup with 24h expire
  await redis.setex(userUsernameKey(username.trim()), EXPIRE_24H, id);

  // Add to users list
  await redis.zadd(usersAllKey(), Date.now(), id);
  await redis.expire(usersAllKey(), EXPIRE_24H);

  return user;
}

export async function getUserByUsername(
  username: string
): Promise<User | null> {
  const userId = await redis.get(userUsernameKey(username.trim()));
  if (!userId) return null;

  const userData = await redis.get(userKey(userId));
  if (!userData) return null;

  return JSON.parse(userData) as User;
}

export async function getUserById(userId: string): Promise<User | null> {
  const userData = await redis.get(userKey(userId));
  if (!userData) return null;

  return JSON.parse(userData) as User;
}

export async function getAllUsers(): Promise<User[]> {
  // Get all user IDs from sorted set (descending order by timestamp)
  const userIds = await redis.zrevrange(usersAllKey(), 0, -1);

  if (userIds.length === 0) return [];

  // Get all user data
  const users = await Promise.all(
    userIds.map(async (id) => {
      const data = await redis.get(userKey(id));
      return data ? (JSON.parse(data) as User) : null;
    })
  );

  return users.filter((u): u is User => u !== null);
}

// Session operations
export async function getActiveSession(): Promise<Session | null> {
  // Get all sessions
  const sessions = await getAllSessions();

  // Return the most recent session (first one)
  return sessions.length > 0 ? sessions[0] : null;
}

export async function createSessionInRedis(
  name: string,
  createdById: string,
  allowedUserIds?: string[]
): Promise<Session> {
  const id = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const now = new Date().toISOString();

  const session: Session = {
    id,
    name: name.trim(),
    createdAt: now,
    updatedAt: now,
    createdById,
    allowedUserIds:
      allowedUserIds && allowedUserIds.length > 0 ? allowedUserIds : undefined,
  };

  // Store session data with 24h expire
  await redis.setex(sessionKey(id), EXPIRE_24H, JSON.stringify(session));

  // Add to sessions list (sorted set with timestamp as score for ordering)
  await redis.zadd(sessionsAllKey(), Date.now(), id);
  await redis.expire(sessionsAllKey(), EXPIRE_24H);

  // Add creator as participant
  await addParticipantToSession(createdById, id);

  return session;
}

export async function endSessionInRedis(
  sessionId: string,
  userId: string
): Promise<boolean> {
  const session = await getSessionById(sessionId);
  if (!session) {
    throw new Error("Oturum bulunamadı");
  }

  // Only creator can end the session
  if (session.createdById !== userId) {
    throw new Error("Sadece oturumu oluşturan kişi oturumu sonlandırabilir");
  }

  // Get all participants
  const participantKeys = await redis.smembers(
    sessionParticipantsKey(sessionId)
  );

  // Remove all participants
  for (const key of participantKeys) {
    const participantData = await redis.get(key);
    if (participantData) {
      const participant = JSON.parse(participantData) as SessionParticipant;
      await removeParticipantFromSession(participant.userId, sessionId);
    }
  }

  // Remove session from sessions list
  await redis.zrem(sessionsAllKey(), sessionId);

  // Delete session data
  await redis.del(sessionKey(sessionId));
  await redis.del(sessionParticipantsKey(sessionId));
  await redis.del(sessionPatientsKey(sessionId));

  // Get all patients in this session and delete them
  const patientIds = await redis.zrange(sessionPatientsKey(sessionId), 0, -1);
  for (const patientId of patientIds) {
    const patientData = await redis.get(patientKey(patientId));
    if (patientData) {
      const patient = JSON.parse(patientData) as Patient;

      // Get all tasks for this patient
      const taskIds = await redis.lrange(patientTasksKey(patientId), 0, -1);
      for (const taskId of taskIds) {
        await redis.del(taskKey(taskId));
      }

      // Delete patient data
      await redis.del(patientKey(patientId));
      await redis.del(patientTcKey(patient.tcNo));
      await redis.del(patientTasksKey(patientId));
    }

    // Remove from sorted sets
    await redis.zrem(patientsAllKey(), patientId);
    await redis.zrem(sessionPatientsKey(sessionId), patientId);
  }

  return true;
}

export async function getSessionById(
  sessionId: string
): Promise<Session | null> {
  const sessionData = await redis.get(sessionKey(sessionId));
  if (!sessionData) return null;

  return JSON.parse(sessionData) as Session;
}

export async function getAllSessions(): Promise<Session[]> {
  // Get all session IDs from sorted set (descending order by timestamp)
  const sessionIds = await redis.zrevrange(sessionsAllKey(), 0, -1);

  if (sessionIds.length === 0) return [];

  // Get all session data
  const sessions = await Promise.all(
    sessionIds.map(async (id) => {
      const data = await redis.get(sessionKey(id));
      return data ? (JSON.parse(data) as Session) : null;
    })
  );

  return sessions.filter((s): s is Session => s !== null);
}

export async function getSessionWithParticipants(sessionId: string): Promise<{
  session: Session;
  participants: Array<{
    participant: SessionParticipant;
    user: User;
  }>;
} | null> {
  const sessionData = await redis.get(sessionKey(sessionId));
  if (!sessionData) return null;

  const session = JSON.parse(sessionData) as Session;

  // Get participant IDs
  const participantKeys = await redis.smembers(
    sessionParticipantsKey(sessionId)
  );

  // Get all participants with user data
  const participants = await Promise.all(
    participantKeys.map(async (key) => {
      const participantData = await redis.get(key);
      if (!participantData) return null;

      const participant = JSON.parse(participantData) as SessionParticipant;
      const user = await getUserById(participant.userId);

      if (!user) return null;

      return { participant, user };
    })
  );

  const validParticipants = participants.filter(
    (p): p is { participant: SessionParticipant; user: User } => p !== null
  );

  return { session, participants: validParticipants };
}

export async function getAllSessionsWithParticipants(): Promise<
  Array<{
    session: Session;
    createdBy: User;
    participants: Array<{
      participant: SessionParticipant;
      user: User;
    }>;
  }>
> {
  const sessions = await getAllSessions();

  const sessionsWithParticipants = await Promise.all(
    sessions.map(async (session) => {
      const result = await getSessionWithParticipants(session.id);
      const createdBy = await getUserById(session.createdById);

      if (!createdBy) return null;

      return {
        session,
        createdBy,
        participants: result?.participants || [],
      };
    })
  );

  return sessionsWithParticipants.filter(
    (
      s
    ): s is {
      session: Session;
      createdBy: User;
      participants: Array<{
        participant: SessionParticipant;
        user: User;
      }>;
    } => s !== null
  );
}

export async function removeParticipantFromSession(
  userId: string,
  sessionId: string
): Promise<boolean> {
  const key = sessionParticipantKey(userId, sessionId);

  // Remove participant data
  await redis.del(key);

  // Remove from session participants set
  await redis.srem(sessionParticipantsKey(sessionId), key);

  // Remove from user sessions set
  await redis.srem(userSessionsKey(userId), sessionId);

  return true;
}

export async function addParticipantToSession(
  userId: string,
  sessionId: string
): Promise<SessionParticipant> {
  // Önce kullanıcının mevcut oturumundan çık
  const activeSession = await getUserActiveSession(userId);
  if (activeSession && activeSession.id !== sessionId) {
    await removeParticipantFromSession(userId, activeSession.id);
  }

  const participantId = `sp_${Date.now()}_${Math.random()
    .toString(36)
    .substr(2, 9)}`;
  const now = new Date().toISOString();

  const participant: SessionParticipant = {
    id: participantId,
    userId,
    sessionId,
    joinedAt: now,
  };

  const key = sessionParticipantKey(userId, sessionId);

  // Store participant data with 24h expire
  await redis.setex(key, EXPIRE_24H, JSON.stringify(participant));

  // Add to session participants set
  await redis.sadd(sessionParticipantsKey(sessionId), key);
  await redis.expire(sessionParticipantsKey(sessionId), EXPIRE_24H);

  // Add to user sessions set (remove old ones first)
  await redis.del(userSessionsKey(userId));
  await redis.sadd(userSessionsKey(userId), sessionId);
  await redis.expire(userSessionsKey(userId), EXPIRE_24H);

  return participant;
}

export async function isUserParticipant(
  userId: string,
  sessionId: string
): Promise<boolean> {
  const key = sessionParticipantKey(userId, sessionId);
  const exists = await redis.exists(key);
  return exists === 1;
}

export async function getUserActiveSession(
  userId: string
): Promise<Session | null> {
  // Get user sessions
  const sessionIds = await redis.smembers(userSessionsKey(userId));

  if (sessionIds.length === 0) return null;

  // Get the most recent session (first one in the set, or we can check all)
  for (const sessionId of sessionIds) {
    const session = await getSessionById(sessionId);
    if (session) {
      // Check if user is still a participant
      const isParticipant = await isUserParticipant(userId, sessionId);
      if (isParticipant) {
        return session;
      }
    }
  }

  return null;
}

export async function canUserJoinSession(
  userId: string,
  sessionId: string
): Promise<{ canJoin: boolean; reason?: string }> {
  const session = await getSessionById(sessionId);
  if (!session) {
    return { canJoin: false, reason: "Oturum bulunamadı" };
  }

  // Zaten katılımcı mı?
  const isParticipant = await isUserParticipant(userId, sessionId);
  if (isParticipant) {
    return { canJoin: false, reason: "Bu oturuma zaten katılıyorsunuz" };
  }

  // Başka bir oturuma katılıyor mu?
  const activeSession = await getUserActiveSession(userId);
  if (activeSession) {
    return {
      canJoin: false,
      reason: `Zaten "${activeSession.name}" oturumuna katılıyorsunuz. Önce o oturumdan çıkmalısınız.`,
    };
  }

  // İzin kontrolü
  if (session.allowedUserIds && session.allowedUserIds.length > 0) {
    if (!session.allowedUserIds.includes(userId)) {
      return { canJoin: false, reason: "Bu oturuma giriş izniniz yok" };
    }
  }

  return { canJoin: true };
}

export async function getUserSessions(userId: string): Promise<Session[]> {
  // Get session IDs from user sessions set
  const sessionIds = await redis.smembers(userSessionsKey(userId));

  if (sessionIds.length === 0) return [];

  // Get all session data
  const sessions = await Promise.all(
    sessionIds.map(async (id) => {
      const data = await redis.get(sessionKey(id));
      return data ? (JSON.parse(data) as Session) : null;
    })
  );

  const validSessions = sessions.filter((s): s is Session => s !== null);

  // Sort by createdAt descending
  validSessions.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  return validSessions;
}

export async function addUserToSession(
  sessionId: string,
  userId: string,
  requesterId: string
): Promise<boolean> {
  const session = await getSessionById(sessionId);
  if (!session) {
    throw new Error("Oturum bulunamadı");
  }

  // Only creator can add users
  if (session.createdById !== requesterId) {
    throw new Error("Sadece oturumu oluşturan kişi kullanıcı ekleyebilir");
  }

  // Get current allowedUserIds
  const currentAllowedUserIds = session.allowedUserIds || [];

  // If user already in list, do nothing
  if (currentAllowedUserIds.includes(userId)) {
    return true;
  }

  // Add user to allowedUserIds
  const updatedAllowedUserIds = [...currentAllowedUserIds, userId];

  // Update session
  session.allowedUserIds = updatedAllowedUserIds;
  session.updatedAt = new Date().toISOString();

  await redis.setex(sessionKey(sessionId), EXPIRE_24H, JSON.stringify(session));

  return true;
}

export async function removeUserFromSession(
  sessionId: string,
  userId: string,
  requesterId: string
): Promise<boolean> {
  const session = await getSessionById(sessionId);
  if (!session) {
    throw new Error("Oturum bulunamadı");
  }

  // Only creator can remove users
  if (session.createdById !== requesterId) {
    throw new Error("Sadece oturumu oluşturan kişi kullanıcı çıkarabilir");
  }

  // Can't remove the creator
  if (userId === session.createdById) {
    throw new Error("Oturumu oluşturan kişi çıkarılamaz");
  }

  // Get current allowedUserIds
  const currentAllowedUserIds = session.allowedUserIds || [];

  // If no restrictions, nothing to remove
  if (currentAllowedUserIds.length === 0) {
    return true;
  }

  // Remove user from allowedUserIds
  const updatedAllowedUserIds = currentAllowedUserIds.filter(
    (id) => id !== userId
  );

  // Update session
  session.allowedUserIds =
    updatedAllowedUserIds.length > 0 ? updatedAllowedUserIds : undefined;
  session.updatedAt = new Date().toISOString();

  await redis.setex(sessionKey(sessionId), EXPIRE_24H, JSON.stringify(session));

  // Also remove user from session participants if they are participating
  const isParticipant = await isUserParticipant(userId, sessionId);
  if (isParticipant) {
    await removeParticipantFromSession(userId, sessionId);
  }

  return true;
}
