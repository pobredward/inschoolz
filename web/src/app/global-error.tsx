'use client'

import { useEffect } from 'react'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // console.error(error)
  }, [error])

  return (
    <html lang="ko">
      <body>
        <div className="mx-auto flex min-h-[60vh] max-w-3xl flex-col items-center justify-center px-6 text-center">
          <h1 className="mb-4 text-3xl font-bold">문제가 발생했어요</h1>
          <p className="mb-6 text-gray-500">잠시 후 다시 시도해 주세요.</p>
          <button
            onClick={() => reset()}
            className="rounded-md bg-blue-600 px-4 py-2 text-white hover:opacity-90"
          >
            다시 시도
          </button>
        </div>
      </body>
    </html>
  )
}
