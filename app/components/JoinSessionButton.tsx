'use client'

import { useActionState, useEffect } from 'react'
import { joinSession } from '../actions/sessions'
import { useRouter } from 'next/navigation'

type JoinSessionButtonProps = {
  sessionId: string
}

export default function JoinSessionButton({
  sessionId,
}: JoinSessionButtonProps) {
  const router = useRouter()
  const [state, formAction, isPending] = useActionState(joinSession, null)

  useEffect(() => {
    if (state?.success) {
      router.refresh()
    }
  }, [state?.success, router])

  return (
    <form action={formAction}>
      <input type="hidden" name="sessionId" value={sessionId} />
      <button
        type="submit"
        disabled={isPending || state?.success}
        className="bg-green-600 text-white text-sm px-4 py-2 rounded-lg font-medium hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
      >
        {isPending
          ? 'Katılıyor...'
          : state?.success
          ? 'Katıldı'
          : 'Katıl'}
      </button>
      {state?.error && (
        <div className="mt-1 text-xs text-red-600">{state.error}</div>
      )}
    </form>
  )
}






