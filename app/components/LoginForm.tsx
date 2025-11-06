"use client";

import { useActionState } from "react";
import { loginOrRegister } from "../actions/auth";

export default function LoginForm() {
  const [state, formAction, isPending] = useActionState(loginOrRegister, null);

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <label
          htmlFor="username"
          className="block text-sm font-medium text-gray-700 mb-2"
        >
          Kullanıcı Adı
        </label>
        <input
          type="text"
          id="username"
          name="username"
          required
          minLength={2}
          disabled={isPending}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none disabled:bg-gray-100"
          placeholder="Kullanıcı adınızı girin"
        />
      </div>

      {state?.error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
          {state.error}
        </div>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {isPending ? "Giriş yapılıyor..." : "Giriş Yap / Kayıt Ol"}
      </button>
    </form>
  );
}
