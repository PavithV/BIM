import NextAuth from "next-auth"
import type { NextAuthConfig } from "next-auth"
import Credentials from "next-auth/providers/credentials"
import { z } from "zod"
import { supabaseAdmin } from "@/lib/supabase/admin"

export const config = {
    theme: {
        logo: "https://next-auth.js.org/img/logo/logo-sm.png",
    },
    providers: [
        {
            id: "kit",
            name: "KIT",
            type: "oidc",
            issuer: process.env.KIT_ISSUER,
            clientId: process.env.KIT_CLIENT_ID,
            clientSecret: process.env.KIT_CLIENT_SECRET,
            authorization: {
                params: {
                    scope: "openid profile email",
                },
            },
            profile(profile) {
                return {
                    id: profile.sub,
                    name: profile.name,
                    email: profile.email,
                    image: null,
                    // Custom attributes from KIT OIDC
                    kit_kuerzel: profile.preferred_username,
                    given_name: profile.given_name,
                    family_name: profile.family_name,
                    affiliation: profile.affiliation,
                }
            },
        },
        Credentials({
            name: "Credentials",
            credentials: {
                email: { label: "Email", type: "email" },
                password: { label: "Password", type: "password" },
            },
            async authorize(credentials) {
                const parsedCredentials = z
                    .object({ email: z.string().email(), password: z.string().min(6) })
                    .safeParse(credentials);

                if (parsedCredentials.success) {
                    const { email, password } = parsedCredentials.data;

                    const { data, error } = await supabaseAdmin.auth.signInWithPassword({
                        email,
                        password,
                    });

                    if (error) {
                        console.error("Supabase auth error:", error);
                        return null;
                    }

                    if (!data.user) {
                        console.error("Supabase returned no user data");
                        return null;
                    }

                    // Map Supabase user to NextAuth user
                    return {
                        id: data.user.id,
                        email: data.user.email,
                        name: data.user.user_metadata?.name || data.user.email, // Fallback to email if name is missing
                        // Add other fields if needed, verifying they exist on the user metadata
                    };
                }

                console.log("Invalid credentials format", parsedCredentials.error);
                return null;
            },
        }),
    ],
    callbacks: {
        async signIn({ user, account, profile }) {
            if (account?.provider === "kit") {
                try {
                    // Upsert user data to Supabase
                    const { error } = await supabaseAdmin
                        .from('users') // Assuming 'users' table exists in public schema
                        .upsert({
                            email: user.email,
                            name: user.name, // Mapping standard OIDC name to existing 'name' column
                            kit_kuerzel: (user as any).kit_kuerzel,
                            first_name: (user as any).given_name,
                            last_name: (user as any).family_name,
                            affiliation: (user as any).affiliation,
                            last_seen: new Date().toISOString(),
                        }, {
                            onConflict: 'kit_kuerzel',
                        })

                    if (error) {
                        console.error("Error upserting user to Supabase:", error)
                        return false
                    }
                } catch (error) {
                    console.error("Exception upserting user to Supabase:", error)
                    return false
                }
            }
            // Add explicit check for credentials provider
            if (account?.provider === "credentials") {
                return true;
            }
            return true
        },
        async session({ session, token }) {
            // Pass custom user data to the client session if needed
            if (session.user) {
                if (token.sub) {
                    session.user.id = token.sub;
                }
                (session.user as any).kit_kuerzel = token.kit_kuerzel;
                (session.user as any).affiliation = token.affiliation;
            }
            return session
        },
        async jwt({ token, user }) {
            // Persist custom user data to the token
            if (user) {
                token.sub = user.id; // Ensure sub is set to user ID
                token.kit_kuerzel = (user as any).kit_kuerzel;
                token.affiliation = (user as any).affiliation;
            }
            return token
        }
    },
} satisfies NextAuthConfig

export const { handlers, auth, signIn, signOut } = NextAuth(config)
