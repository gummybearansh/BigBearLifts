"use client";

import { useEffect } from "react";
import { noteAppHidden, recordFailure, stackOf } from "@/lib/failure-log";

export function FailureWatch() {
  useEffect(() => {
    const onError = (event: ErrorEvent) => {
      recordFailure("window", event.error ?? event.message, `${event.filename}:${event.lineno}\n${stackOf(event.error)}`);
    };
    const onRejection = (event: PromiseRejectionEvent) => {
      recordFailure("promise", event.reason, stackOf(event.reason));
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden") noteAppHidden();
    };
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);
  return null;
}
