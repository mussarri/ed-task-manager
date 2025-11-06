"use client";

import { createPatient, type PatientState } from "../actions/patients";
import { useActionState } from "react";

type CreatePatientFormProps = {
  sessionId: string;
};

export default function CreatePatientForm({
  sessionId,
}: CreatePatientFormProps) {
  const [state, formAction] = useActionState(createPatient, null);

  return (
    <form action={formAction} className="space-y-3">
      {state?.error && (
        <div className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">
          {state.error}
        </div>
      )}
      {state?.success && (
        <div className="text-sm text-green-600 bg-green-50 p-3 rounded-lg">
          Hasta başarıyla eklendi!
        </div>
      )}
      <div className="space-y-2">
        <input type="hidden" name="sessionId" value={sessionId} />
        <div className="flex gap-2">
          <input
            type="text"
            name="tcNo"
            placeholder="TC No (11 haneli)"
            maxLength={11}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
          <input
            type="text"
            name="name"
            placeholder="Hasta Adı (opsiyonel)"
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <button
          type="submit"
          className="w-full px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors font-medium"
        >
          Yeni Hasta Ekle
        </button>
      </div>
    </form>
  );
}
