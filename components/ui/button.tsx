"use client";

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cn } from "@/lib/utils";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  asChild?: boolean;
  variant?: "primary" | "ghost" | "surface";
  size?: "sm" | "md" | "icon";
};

export function Button({ className, asChild, variant = "surface", size = "md", ...props }: ButtonProps) {
  const Comp = asChild ? Slot : "button";
  return (
    <Comp
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-md font-semibold transition active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50",
        variant === "primary" && "bg-accent text-black hover:bg-[#1ed760]",
        variant === "ghost" && "bg-transparent text-white hover:bg-white/10",
        variant === "surface" && "bg-white/10 text-white hover:bg-white/15",
        size === "sm" && "h-9 px-3 text-sm",
        size === "md" && "h-11 px-4 text-sm",
        size === "icon" && "h-11 w-11 p-0",
        className
      )}
      {...props}
    />
  );
}
