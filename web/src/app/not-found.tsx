import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-3xl flex-col items-center justify-center px-6 text-center">
      <h1 className="mb-4 text-4xl font-bold">페이지를 찾을 수 없습니다</h1>
      <p className="mb-8 text-muted-foreground">
        요청하신 페이지가 존재하지 않거나 이동되었을 수 있어요.
      </p>
      <Link
        href="/"
        className="rounded-md bg-primary px-4 py-2 text-primary-foreground hover:opacity-90"
      >
        홈으로 가기
      </Link>
    </div>
  );
}


