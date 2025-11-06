"use client";

import { useActionState, useEffect, useState } from "react";
import { createSession } from "../actions/sessions";
import { useRouter } from "next/navigation";

type User = {
  id: string;
  username: string;
};

type CreateSessionFormProps = {
  users: User[];
};

export default function CreateSessionForm({ users }: CreateSessionFormProps) {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(createSession, null);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [newUsers, setNewUsers] = useState<string[]>([""]);

  useEffect(() => {
    if (state?.success) {
      router.refresh();
    }
  }, [state?.success, router]);

  const toggleUser = (userId: string) => {
    setSelectedUsers((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId]
    );
  };

  const addNewUserField = () => {
    setNewUsers([...newUsers, ""]);
  };

  const removeNewUserField = (index: number) => {
    setNewUsers(newUsers.filter((_, i) => i !== index));
  };

  const updateNewUser = (index: number, value: string) => {
    const updated = [...newUsers];
    updated[index] = value;
    setNewUsers(updated);
  };

  return (
    <div className="bg-white rounded-lg shadow-sm p-4">
      <h2 className="text-lg font-semibold text-gray-800 mb-4">
        Yeni Oturum Oluştur
      </h2>
      <form action={formAction} className="space-y-3">
        <div>
          <label
            htmlFor="sessionName"
            className="block text-sm font-medium text-gray-700 mb-2"
          >
            Oturum Adı
          </label>
          <input
            type="text"
            id="sessionName"
            name="name"
            required
            minLength={2}
            disabled={isPending}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none disabled:bg-gray-100"
            placeholder="Örn: 6 Kasım Nöbet"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            İzin Verilen Kullanıcılar (Boş bırakırsanız herkes girebilir)
          </label>

          {/* Mevcut Kullanıcılar */}
          <div className="mb-3">
            <p className="text-xs text-gray-500 mb-2">Kayıtlı Kullanıcılar</p>
            <div className="max-h-40 overflow-y-auto border border-gray-300 rounded-lg p-2 space-y-2">
              {users.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-2">
                  Henüz kullanıcı bulunmamaktadır
                </p>
              ) : (
                users.map((user) => (
                  <label
                    key={user.id}
                    className="flex items-center gap-2 p-2 hover:bg-gray-50 rounded cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      name="allowedUsers"
                      value={user.id}
                      checked={selectedUsers.includes(user.id)}
                      onChange={() => toggleUser(user.id)}
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700">
                      {user.username}
                    </span>
                  </label>
                ))
              )}
            </div>
          </div>

          {/* Yeni Kullanıcılar */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-gray-500">Yeni Kullanıcı Ekle</p>
              <button
                type="button"
                onClick={addNewUserField}
                className="text-xs text-blue-600 hover:text-blue-800"
              >
                + Ekle
              </button>
            </div>
            <div className="space-y-2">
              {newUsers.map((newUser, index) => (
                <div key={index} className="flex gap-2">
                  <input
                    type="text"
                    name="newUsers"
                    value={newUser}
                    onChange={(e) => updateNewUser(index, e.target.value)}
                    placeholder="Kullanıcı adı (min 2 karakter)"
                    minLength={2}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm"
                  />
                  {newUsers.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeNewUserField(index)}
                      className="px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {state?.error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded-lg text-sm">
            {state.error}
          </div>
        )}

        {state?.success && (
          <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-2 rounded-lg text-sm">
            Oturum başarıyla oluşturuldu!
          </div>
        )}

        <button
          type="submit"
          disabled={isPending}
          className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isPending ? "Oluşturuluyor..." : "Oluştur"}
        </button>
      </form>
    </div>
  );
}
