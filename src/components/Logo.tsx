"use client";

import { useEffect, useRef, useState } from "react";
import { program } from "@/config/program";
import { CandlesIcon } from "./icons";

/**
 * The program's logo from /public, or a candles mark if there's no logo file.
 * When `program.logoDark` is set, both versions are rendered and the CSS shows
 * the one that suits the theme. `size` is the width in pixels.
 */
export function Logo({ size, className }: { size: number; className: string }) {
  const [failed, setFailed] = useState(!program.logo);
  const light = useRef<HTMLImageElement>(null);
  const dark = useRef<HTMLImageElement>(null);

  // An image may fail before React is listening, so check once on mount too.
  useEffect(() => {
    for (const el of [light.current, dark.current]) {
      if (el && el.complete && el.naturalWidth === 0) setFailed(true);
    }
  }, []);

  if (failed) {
    return (
      <span className={className} style={{ width: size, height: size }}>
        <CandlesIcon width={size * 0.6} height={size * 0.6} />
      </span>
    );
  }
  const dual = Boolean(program.logoDark);
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        ref={light}
        src={program.logo}
        alt=""
        width={size}
        className={`${className} logo-img${dual ? " logo-img--light" : ""}`}
        onError={() => setFailed(true)}
      />
      {dual && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          ref={dark}
          src={program.logoDark}
          alt=""
          width={size}
          className={`${className} logo-img logo-img--dark`}
          onError={() => setFailed(true)}
        />
      )}
    </>
  );
}
