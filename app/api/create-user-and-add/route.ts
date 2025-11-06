import { createUserAndAddToSession } from "@/app/actions/sessions";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { username, sessionId } = body;

    if (!username || !sessionId) {
      return NextResponse.json(
        { success: false, error: "Kullanıcı adı ve oturum ID gereklidir" },
        { status: 400 }
      );
    }

    const result = await createUserAndAddToSession(username, sessionId);
    return NextResponse.json(result);
  } catch (error) {
    console.error("API error:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Bir hata oluştu",
      },
      { status: 500 }
    );
  }
}

