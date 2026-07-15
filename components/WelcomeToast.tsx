"use client";

import { useEffect } from "react";
import toast from "react-hot-toast";

interface WelcomeToastProps {
  name?: string | null;
}

export default function WelcomeToast({ name }: WelcomeToastProps) {
  useEffect(() => {
    const hour = new Date().getHours();
    let greeting = "Good morning";
    if (hour >= 12 && hour < 17) greeting = "Good afternoon";
    else if (hour >= 17 || hour < 4) greeting = "Good evening";

    const firstName = name?.split(" ")[0] || "there";
    const key = `thryve-welcome-${new Date().toDateString()}`;

    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, "1");

    toast.success(`${greeting}, ${firstName}! Welcome back.`, {
      duration: 3500,
      icon: "👋",
    });
  }, [name]);

  return null;
}
