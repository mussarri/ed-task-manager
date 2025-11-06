"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import {
  createUserInRedis,
  getUserByUsername,
  getUserById,
  type User,
} from "@/lib/redis";

export type AuthState = {
  error?: string;
  success?: boolean;
};

export async function loginOrRegister(
  prevState: AuthState | null,
  formData: FormData
): Promise<AuthState> {
  const username = formData.get("username") as string;

  if (!username || username.trim().length === 0) {
    return { error: "Kullanıcı adı gereklidir" };
  }

  if (username.trim().length < 2) {
    return { error: "Kullanıcı adı en az 2 karakter olmalıdır" };
  }

  try {
    // Kullanıcıyı bul veya oluştur
    let user = await getUserByUsername(username.trim());

    if (!user) {
      user = await createUserInRedis(username.trim());
    }

    // Session cookie'sine kullanıcı ID'sini kaydet
    const cookieStore = await cookies();
    cookieStore.set("userId", user.id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24, // 24 saat (Redis expire ile uyumlu)
    });

    revalidatePath("/");
    return { success: true };
  } catch (error) {
    console.error("Login/Register error:", error);
    return { error: "Bir hata oluştu. Lütfen tekrar deneyin." };
  }
}

export async function getCurrentUser(): Promise<User | null> {
  const cookieStore = await cookies();
  const userId = cookieStore.get("userId")?.value;

  if (!userId) {
    return null;
  }

  try {
    const user = await getUserById(userId);
    return user;
  } catch (error) {
    return null;
  }
}

export async function logout() {
  const cookieStore = await cookies();
  cookieStore.delete("userId");
  revalidatePath("/");
}
