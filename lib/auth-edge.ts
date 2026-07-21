import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import Google from "next-auth/providers/google";
import { prisma } from "@/lib/prisma";
import { isDeviceSessionValid } from "@/lib/devices";

export const { auth } = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      allowDangerousEmailAccountLinking: true,
    }),
  ],
  session: {
    strategy: "jwt",
  },
  callbacks: {
    async jwt({ token, user }) {
      try {
        if (user) {
          token.id = user.id;
        }

        if (token.sessionId) {
          const valid = await isDeviceSessionValid(token.sessionId as string);
          if (!valid) {
            return { ...token, id: undefined, sessionId: undefined };
          }
        }
      } catch {
        // Never throw from edge jwt callback
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
