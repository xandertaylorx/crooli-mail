// Sender pictures (Gravatar photo or company logo), fetched by the Rust side.
// One request per address per session, at most four at a time.
import { useEffect, useState } from "react";
import { mailApi } from "./mail";

const cache = new Map<string, string | null>();
const waiting = new Map<string, ((v: string | null) => void)[]>();
const queue: string[] = [];
let running = 0;

function pump() {
  while (running < 4 && queue.length) {
    const addr = queue.shift()!;
    running++;
    mailApi
      .senderIcon(addr)
      .catch(() => null)
      .then((v) => {
        cache.set(addr, v ?? null);
        for (const f of waiting.get(addr) ?? []) f(v ?? null);
        waiting.delete(addr);
        running--;
        pump();
      });
  }
}

export function useSenderIcon(address: string | undefined, enabled: boolean): string | null {
  const key = (address ?? "").trim().toLowerCase();
  const [url, setUrl] = useState<string | null>(() => cache.get(key) ?? null);
  useEffect(() => {
    if (!enabled || !key.includes("@")) return setUrl(null);
    if (cache.has(key)) return setUrl(cache.get(key) ?? null);
    let live = true;
    const cb = (v: string | null) => live && setUrl(v);
    if (!waiting.has(key)) {
      waiting.set(key, []);
      queue.push(key);
      pump();
    }
    waiting.get(key)!.push(cb);
    return () => {
      live = false;
    };
  }, [key, enabled]);
  return url;
}
