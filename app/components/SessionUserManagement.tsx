"use client";

import { useActionState, useEffect, useState } from "react";
import {
  addUserToSessionAction,
  removeUserFromSessionAction,
} from "../actions/sessions";
import { useRouter } from "next/navigation";

type User = {
  id: string;
  username: string;
};

type SessionUserManagementProps = {
  sessionId: string;
  allowedUserIds?: string[];
  allUsers: User[];
};

export default function SessionUserManagement({
  sessionId,
  allowedUserIds = [],
  allUsers,
}: SessionUserManagementProps) {
  const router = useRouter();
  const [addState, addFormAction, isAdding] = useActionState(
    addUserToSessionAction,
    null
  );
  const [removeState, removeFormAction, isRemoving] = useActionState(
    removeUserFromSessionAction,
    null
  );
  const [newUsers, setNewUsers] = useState<string[]>([""]);
  const [newUserStates, setNewUserStates] = useState<
    Array<{ username: string; isSubmitting: boolean }>
  >([{ username: "", isSubmitting: false }]);

  useEffect(() => {
    if (addState?.success || removeState?.success) {
      router.refresh();
      setNewUsers([""]);
      setNewUserStates([{ username: "", isSubmitting: false }]);
    }
  }, [addState?.success, removeState?.success, router]);

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

  // Users that are allowed but not in the list
  const availableUsers = allUsers.filter(
    (user) => !allowedUserIds.includes(user.id)
  );

  // Users that are in the allowed list
  const allowedUsers = allUsers.filter((user) =>
    allowedUserIds.includes(user.id)
  );

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-medium text-gray-700 mb-2">
          İzin Verilen Kullanıcılar
        </h3>
        {allowedUsers.length === 0 ? (
          <p className="text-sm text-gray-500">
            Henüz izin verilen kullanıcı yok (herkes girebilir)
          </p>
        ) : (
          <div className="space-y-2">
            {allowedUsers.map((user) => (
              <div
                key={user.id}
                className="flex items-center justify-between p-2 bg-gray-50 rounded-lg"
              >
                <span className="text-sm text-gray-700">{user.username}</span>
                <form action={removeFormAction}>
                  <input type="hidden" name="sessionId" value={sessionId} />
                  <input type="hidden" name="userId" value={user.id} />
                  <button
                    type="submit"
                    disabled={isRemoving}
                    className="text-xs px-2 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200 transition-colors disabled:opacity-50"
                  >
                    Çıkar
                  </button>
                </form>
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-medium text-gray-700">
            Kullanıcı Ekle
          </h3>
          <button
            type="button"
            onClick={addNewUserField}
            className="text-xs text-blue-600 hover:text-blue-800"
          >
            + Yeni Kullanıcı
          </button>
        </div>

        {/* Mevcut Kullanıcılar */}
        {availableUsers.length > 0 && (
          <div className="mb-3">
            <p className="text-xs text-gray-500 mb-2">Kayıtlı Kullanıcılar</p>
            <div className="space-y-1">
              {availableUsers.map((user) => (
                <form key={user.id} action={addFormAction} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                  <span className="text-sm text-gray-700">{user.username}</span>
                  <input type="hidden" name="sessionId" value={sessionId} />
                  <input type="hidden" name="userId" value={user.id} />
                  <button
                    type="submit"
                    disabled={isAdding}
                    className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors disabled:opacity-50"
                  >
                    Ekle
                  </button>
                </form>
              ))}
            </div>
          </div>
        )}

        {/* Yeni Kullanıcılar */}
        <div>
          <p className="text-xs text-gray-500 mb-2">Yeni Kullanıcı Oluştur ve Ekle</p>
          <div className="space-y-2">
            {newUsers.map((newUser, index) => (
              <form
                key={index}
                action={async (formData) => {
                  const username = formData.get("newUser") as string;
                  if (!username || username.trim().length < 2) return;

                  setNewUserStates((prev) => {
                    const updated = [...prev];
                    updated[index] = { ...updated[index], isSubmitting: true };
                    return updated;
                  });

                  // Create user first, then add to session
                  const response = await fetch("/api/create-user-and-add", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      username: username.trim(),
                      sessionId,
                    }),
                  });

                  const result = await response.json();
                  if (result.success) {
                    router.refresh();
                  } else {
                    setNewUserStates((prev) => {
                      const updated = [...prev];
                      updated[index] = { ...updated[index], isSubmitting: false };
                      return updated;
                    });
                  }
                }}
                className="flex gap-2"
              >
                <input
                  type="text"
                  name="newUser"
                  value={newUser}
                  onChange={(e) => updateNewUser(index, e.target.value)}
                  placeholder="Kullanıcı adı (min 2 karakter)"
                  minLength={2}
                  disabled={newUserStates[index]?.isSubmitting}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm disabled:bg-gray-100"
                />
                <button
                  type="submit"
                  disabled={
                    !newUser ||
                    newUser.trim().length < 2 ||
                    newUserStates[index]?.isSubmitting
                  }
                  className="px-3 py-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors disabled:opacity-50 text-sm"
                >
                  {newUserStates[index]?.isSubmitting ? "..." : "Oluştur & Ekle"}
                </button>
                {newUsers.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeNewUserField(index)}
                    className="px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    ✕
                  </button>
                )}
              </form>
            ))}
          </div>
        </div>
      </div>

      {addState?.error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded-lg text-sm">
          {addState.error}
        </div>
      )}

      {removeState?.error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded-lg text-sm">
          {removeState.error}
        </div>
      )}

      {addState?.success && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-2 rounded-lg text-sm">
          Kullanıcı başarıyla eklendi!
        </div>
      )}

      {removeState?.success && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-2 rounded-lg text-sm">
          Kullanıcı başarıyla çıkarıldı!
        </div>
      )}
    </div>
  );
}

