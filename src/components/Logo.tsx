"use client";

import { useEffect, useRef, useState } from "react";
import { program } from "@/config/program";
import { CandlesIcon } from "./icons";

/** The yeshiva's logo from /public, or a candles mark if there's no logo file. */
export function Logo({ size, className }: { size: number; className: string }) {
  const [failed, setFailed] = useState(!program.logo);
  const img = useRef<HTMLImageElement>(null);

  // The image may fail before React is listening, so check once on mount too.
  useEffect(() => {
    const el = img.current;
    if (el && el.complete && el.naturalWidth === 0) setFailed(true);
  }, []);

  if (failed) {
    return (
      <span className={className} style={{ width: size, height: size }}>
        <CandlesIcon width={size * 0.6} height={size * 0.6} />
      </span>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      ref={img}
      src={program.logo}
      alt=""
      width={size}
      height={size}
      className={`${className} logo-img`}
      onError={() => setFailed(true)}
    />
  );
}
