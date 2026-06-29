import Link from 'next/link';

export default function Forbidden(): React.ReactNode {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-3 p-4 text-center">
      <p className="text-sm font-medium text-gray-500">403</p>
      <h1 className="text-2xl font-bold">Access denied</h1>
      <p className="text-sm text-gray-500">
        You don&apos;t have permission to view this page.
      </p>
      <Link href="/dashboard" className="text-sm font-medium underline">
        Back to dashboard
      </Link>
    </div>
  );
}
