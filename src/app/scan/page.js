// app/scan/page.js
import { Suspense } from "react";
import ScanRootClient from "./ScanRootClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function ScanPage() {
  return (
    <Suspense fallback={<main style={{ padding: 24 }}><p>로딩 중…</p></main>}>
      <ScanRootClient />
    </Suspense>
  );
}
