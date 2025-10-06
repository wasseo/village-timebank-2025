"use client";
import { useSession } from "@/hooks/useSession";

export default function Home() {
  const user = useSession();
  return (
    <main className="p-6">
      <h1 className="text-2xl font-semibold mb-4">마을시간은행</h1>
      {user ? (
        <p className="text-sm">로그인됨: {user.phone}</p>
      ) : (
        <p className="text-sm text-gray-500">로그인 안 됨</p>
      )}
    </main>
  );
  
}
