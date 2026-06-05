"use client";

import React from "react";
import { AppProgressBar as ProgressBar } from "next-nprogress-bar";

export default function ProgressBarProvider({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <ProgressBar
        height="3px"
        color="#10B981"
        options={{ showSpinner: false }}
        shallowRouting
      />
    </>
  );
}
