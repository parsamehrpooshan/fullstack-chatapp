"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getToken } from "@/lib/auth";

// The entry point only routes: a stored token goes to the app, otherwise to
// sign-in. It renders nothing visible — the redirect is immediate.
export default function Home() {
  const router = useRouter();

  useEffect(() => {
    router.replace(getToken() ? "/chat" : "/login");
  }, [router]);

  return null;
}
