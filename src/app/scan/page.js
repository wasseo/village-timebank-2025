import { Suspense } from "react";
import ScanRootClient from "./ScanRootClient";
import ScanGateClient from "./ScanGateClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function ScanPage() {
  return (
    <Suspense fallback={<main style={{ padding: 24 }}><p>로딩 중…</p></main>}>
      <ScanGateClient>
        <ScanRootClient />   {/* 게이트 통과 시에만 렌더 */}
      </ScanGateClient>
    </Suspense>
  );
}
