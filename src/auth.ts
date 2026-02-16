import NextAuth from "next-auth"
import type { NextAuthConfig } from "next-auth"
import Credentials from "next-auth/providers/credentials"
import { z } from "zod"
import { supabaseAdmin } from "@/lib/supabase/admin"

export const config = {
    trustHost: true,
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
            checks: ["state"],
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
                    let userId = user.id; // Default to incoming ID, but we strictly need a Supabase UUID if strict FK is on.

                    // 1. Try to create a shadow user in Supabase Auth to satisfy FK constraint
                    // and to ensure we have a valid UUID.
                    const { data: newAuthUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
                        email: user.email,
                        email_confirm: true,
                        user_metadata: { source: 'kit_oidc' }
                    });

                    if (newAuthUser?.user) {
                        // Success: We created a new Auth user. Use this UUID.
                        userId = newAuthUser.user.id;
                    } else {
                        // Error (likely "User already registered"): User exists in Auth.
                        // We try to find the existing user in public.users to get their UUID.
                        const { data: existingPublicUser } = await supabaseAdmin
                            .from('users')
                            .select('id')
                            .eq('email', user.email)
                            .maybeSingle(); // Use maybeSingle to avoid error if not found

                        if (existingPublicUser) {
                            userId = existingPublicUser.id;
                        } else {
                            // Edge Case: User in Auth but not in Public.
                            // We can't easily get the Auth ID without listUsers (expensive) or bypassing.
                            // However, if we don't provide a valid UUID that matches Auth, FK will fail.
                            // We will proceed; if this fails, the user might need to contact support or we need to drop the FK.
                            console.warn("User exists in Auth but not Public. Upsert might fail if FK is strict.");
                        }
                    }

                    // 2. Upsert user data to Supabase public.users
                    const { error } = await supabaseAdmin
                        .from('users')
                        .upsert({
                            id: userId, // Explicitly provide the resolved UUID
                            email: user.email,
                            name: user.name ?? undefined,
                            kit_kuerzel: (user as any).kit_kuerzel,
                            first_name: (user as any).given_name,
                            last_name: (user as any).family_name,
                            affiliation: (user as any).affiliation,
                            last_seen: new Date().toISOString(),
                        }, {
                            onConflict: 'id',
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
