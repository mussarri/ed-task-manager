"use client";

import { useActionState } from "react";
import { endSession } from "../actions/sessions";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

type EndSessionButtonProps = {
  sessionId: string;
};

export default function EndSessionButton({ sessionId }: EndSessionButtonProps) {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(endSession, null);

  useEffect(() => {
    if (state?.success) {
      router.push("/");
      router.refresh();
    }
  }, [state?.success, router]);

  return (
    <form action={formAction}>
      <input type="hidden" name="sessionId" value={sessionId} />
      {state?.error && (
        <div className="mb-2 text-sm text-red-600 bg-red-50 p-2 rounded">
          {state.error}
        </div>
      )}
      <button
        type="submit"
        disabled={isPending}
        className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
      >
        {isPending ? "Sonlandırılıyor..." : "Oturumu Sonlandır"}
      </button>
    </form>
  );
}

