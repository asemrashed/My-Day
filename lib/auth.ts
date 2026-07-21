import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { prisma } from "@/lib/prisma";
import {
  createSessionId,
  isDeviceSessionValid,
  registerDeviceSession,
  touchDeviceSession,
} from "@/lib/devices";

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      allowDangerousEmailAccountLinking: true,
    }),
    Credentials({
      id: "credentials",
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const email = credentials.email as string;
        const password = credentials.password as string;

        const user = await prisma.user.findUnique({
          where: { email },
        });

        if (!user || !user.passwordHash) {
          return null;
        }

        const bcrypt = await import("bcryptjs");
        const isValid = await bcrypt.compare(password, user.passwordHash);

        if (!isValid) {
          return null;
        }

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          image: user.image,
        };
      },
    }),
    Credentials({
      id: "otp-verified",
      name: "otp-verified",
      credentials: {
        userId: { label: "User ID", type: "text" },
        challengeId: { label: "Challenge ID", type: "text" },
      },
      async authorize(credentials) {
        const userId = credentials?.userId as string | undefined;
        const challengeId = credentials?.challengeId as string | undefined;
        if (!userId || !challengeId) {
          return null;
        }

        const challenge = await prisma.otpChallenge.findUnique({
          where: { id: challengeId },
        });

        if (
          !challenge ||
          challenge.userId !== userId ||
          !challenge.consumedAt ||
          challenge.purpose !== "LOGIN_2FA"
        ) {
          return null;
        }

        const ageMs = Date.now() - challenge.consumedAt.getTime();
        if (ageMs > 2 * 60 * 1000) {
          return null;
        }

        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user) return null;

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          image: user.image,
        };
      },
    }),
  ],
  session: {
    strategy: "jwt",
  },
  callbacks: {
    async jwt({ token, user, trigger }) {
      try {
        if (user) {
          token.id = user.id;
          const sessionId = createSessionId();
          token.sessionId = sessionId;
          try {
            await registerDeviceSession(user.id as string, sessionId);
          } catch {
            // Device tracking must never block sign-in
          }
        }

        if (token.sessionId) {
          try {
            const valid = await isDeviceSessionValid(token.sessionId as string);
            if (!valid) {
              return { ...token, id: undefined, sessionId: undefined };
            }
            if (trigger === "update") {
              await touchDeviceSession(token.sessionId as string);
            }
          } catch {
            // Ignore device validation failures
          }
        }
      } catch {
        // Never let jwt callback throw (causes Auth.js CallbackRouteError)
      }

      return token;
    },
    async session({ session, token }) {
      if (!token?.id) {
        return session;
      }
      if (session.user) {
        session.user.id = token.id as string;
        (session as any).sessionId = token.sessionId as string | undefined;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
  secret: process.env.NEXTAUTH_SECRET,
});
