"use server";

import { signIn } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcrypt";

export async function registerAction(prevState: any, formData: FormData) {
  const name = formData.get("name") as string;
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  if (!name || !email || !password) {
    return { error: "Please fill in all fields" };
  }

  if (password.length < 6) {
    return { error: "Password must be at least 6 characters long" };
  }

  try {
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return { error: "An account with this email already exists" };
    }

    const passwordHash = await bcrypt.hash(password, 10);

    await prisma.user.create({
      data: {
        name,
        email,
        passwordHash,
      },
    });

    return { success: "Account created successfully! Redirecting to login..." };
  } catch (err: any) {
    return { error: err.message || "Something went wrong during registration" };
  }
}

export async function loginWithCredentials(prevState: any, formData: FormData) {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  if (!email || !password) {
    return { error: "Please provide both email and password" };
  }

  try {
    await signIn("credentials", {
      email,
      password,
      redirectTo: "/",
    });
    return { success: true };
  } catch (error: any) {
    // Check if it's a redirect, which NextAuth uses to navigate to the success url
    if (
      error.message === "NEXT_REDIRECT" || 
      error.name === "RedirectError" || 
      error.digest?.startsWith("NEXT_REDIRECT")
    ) {
      throw error;
    }
    
    // Otherwise, handle error responses
    if (error.type === "CredentialsSignin" || error.code === "CredentialsSignin") {
      return { error: "Invalid email or password" };
    }
    
    return { error: error.message || "Failed to log in" };
  }
}
