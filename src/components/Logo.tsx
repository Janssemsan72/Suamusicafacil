import React, { useState } from "react";

const LOGO_URL = "/logo.png";

interface LogoProps {
  className?: string;
  width?: number;
  height?: number;
  variant?: "default" | "white";
  align?: "left" | "center";
  trim?: boolean;
}

export default function Logo({
  className = "",
  width = 640,
  height,
  variant = "default",
  align = "center",
}: LogoProps) {
  const [hasError, setHasError] = useState(false);
  const explicitHeight = height ?? Math.round(width / 5.53);
  const isWhite = variant === "white";

  if (hasError) {
    return (
      <span
        className={`inline-flex items-center justify-center w-fit shrink-0 overflow-hidden m-0 p-0 leading-none font-bold text-purple-700 ${className}`}
        style={{
          fontSize: "clamp(0.875rem, 2vw, 1.25rem)",
          ...(isWhite && { color: "white", filter: "none" }),
        }}
      >
        Sua Música Fácil
      </span>
    );
  }

  return (
    <span className={`inline-flex items-center justify-center w-fit shrink-0 overflow-hidden m-0 p-0 leading-none ${className}`}>
      <img
        src={LOGO_URL}
        alt="Sua Música Fácil"
        role="img"
        width={width}
        height={explicitHeight}
        onError={() => setHasError(true)}
        className="block max-h-full w-auto object-contain m-0 p-0 border-0 align-top"
        style={{
          display: "block",
          objectFit: "contain",
          verticalAlign: "top",
          fontWeight: 700,
          ...(isWhite && {
            filter: "brightness(0) invert(1)",
          }),
        }}
      />
    </span>
  );
}
