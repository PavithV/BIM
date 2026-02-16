'use client';

import { createContext, useContext } from 'react';
import { useSession, signOut as nextAuthSignOut, SessionProvider } from 'next-auth/react';
import { Session } from 'next-auth';

// Define a compatible User type based on what components might expect
interface CompatibleUser {
    id: string;
    email?: string | null;
    name?: string | null;
    image?: string | null;
}

interface SupabaseAuthContextType {
    user: CompatibleUser | null;
    session: Session | null;
    loading: boolean;
    signOut: () => Promise<void>;
}

const SupabaseAuthContext = createContext<SupabaseAuthContextType | undefined>(undefined);

function InternalSupabaseAuthProvider({ children }: { children: React.ReactNode }) {
    const { data: session, status } = useSession();

    const loading = status === 'loading';

    // Map NextAuth user to compatible format
    const user: CompatibleUser | null = session?.user ? {
        id: session.user.id || 'unknown', // Use ID from session
        email: session.user.email,
        name: session.user.name,
        image: session.user.image,
    } : null;

    const signOut = async () => {
        await nextAuthSignOut({ callbackUrl: '/login' });
    };

    return (
        <SupabaseAuthContext.Provider value={{ user, session, loading, signOut }}>
            {children}
        </SupabaseAuthContext.Provider>
    );
}

// Export the wrapper that includes SessionProvider as the default named export
export function SupabaseAuthProvider({ children }: { children: React.ReactNode }) {
    return (
        <SessionProvider>
            <InternalSupabaseAuthProvider>
                {children}
            </InternalSupabaseAuthProvider>
        </SessionProvider>
    );
}

export const useSupabaseAuth = () => {
    const context = useContext(SupabaseAuthContext);
    if (context === undefined) {
        throw new Error('useSupabaseAuth must be used within a SupabaseAuthProvider');
    }
    return context;
};
