import NextAuth from "next-auth"
import type { NextAuthConfig } from "next-auth"
import Credentials from "next-auth/providers/credentials"
import { z } from "zod"
import { supabaseAdmin } from "@/lib/supabase/admin"
import { createClient } from "@supabase/supabase-js"

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
                    // Create a FRESH admin client to ensure service role key is used
                    // (avoids potential singleton/bundling issues in auth route handler)
                    const admin = createClient(
                        process.env.NEXT_PUBLIC_SUPABASE_URL!,
                        process.env.SUPABASE_SERVICE_ROLE_KEY!,
                        { auth: { autoRefreshToken: false, persistSession: false } }
                    );

                    let userId: string | null = null;

                    // Step 1: Check if user already exists in public.users
                    const { data: existingPublicUser } = await admin
                        .from('users')
                        .select('id')
                        .eq('email', user.email)
                        .maybeSingle();

                    if (existingPublicUser) {
                        // User exists in public.users — use their existing UUID
                        userId = existingPublicUser.id;
                    } else {
                        // Step 2: User not in public.users — try to create a shadow Auth user
                        const { data: newAuthUser, error: createError } = await admin.auth.admin.createUser({
                            email: user.email || undefined,
                            email_confirm: true,
                            user_metadata: { source: 'kit_oidc' }
                        });

                        if (newAuthUser?.user) {
                            // New Auth user created successfully
                            userId = newAuthUser.user.id;
                        } else {
                            // Step 3: Auth user already exists but not in public.users
                            // (e.g. from a previous failed login). Find their UUID.
                            console.log("Auth user exists but not in public.users. Looking up Auth UUID...");
                            const { data: listData, error: listError } = await admin.auth.admin.listUsers({ perPage: 1000 });

                            if (!listError && listData?.users) {
                                const authUser = listData.users.find(u => u.email === user.email);
                                if (authUser) {
                                    userId = authUser.id;
                                    console.log("Found Auth UUID:", userId);
                                }
                            }

                            if (!userId) {
                                console.error("Could not resolve Supabase Auth UUID for:", user.email);
                                return false;
                            }
                        }
                    }

                    // CRITICAL: Override user.id with the Supabase UUID so the JWT/session
                    // uses the correct ID (not the KIT OIDC sub).
                    user.id = userId;

                    // Upsert user data to Supabase public.users
                    console.log("KIT Login - Resolved Supabase UUID:", userId);
                    console.log("KIT OIDC Profile Dump:", JSON.stringify(profile, null, 2));

                    const profileData = profile || {}; // Safe access

                    // Fallback logic for names
                    const firstName = (profileData as any).given_name || (profileData.name ? profileData.name.split(' ')[0] : '');
                    const lastName = (profileData as any).family_name || (profileData.name ? profileData.name.split(' ').slice(1).join(' ') : '');
                    const affiliation = (profileData as any).affiliation || (profileData as any).eduperson_affiliation || (profileData as any).unscoped_affiliation || undefined;

                    const { error } = await admin
                        .from('users')
                        .upsert({
                            id: userId, // Supabase Auth UUID
                            email: user.email,
                            name: user.name ?? undefined,
                            kit_kuerzel: (profileData as any).preferred_username,
                            first_name: firstName,
                            last_name: lastName,
                            affiliation: affiliation,
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
                token.sub = user.id; // Now uses Supabase UUID (overridden in signIn callback)
                token.kit_kuerzel = (user as any).kit_kuerzel;
                token.affiliation = (user as any).affiliation;
            }
            return token
        }
    },
} satisfies NextAuthConfig

export const { handlers, auth, signIn, signOut } = NextAuth(config)

