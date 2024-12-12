import NextAuth from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import GoogleProvider from "next-auth/providers/google"
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_KEY!
)

const handler = NextAuth({
    providers: [
        CredentialsProvider({
            name: "Credentials",
            credentials: {
                email: { label: "Email", type: "email" },
                password: { label: "Password", type: "password" },
                mode: { type: "text" }, // Add mode to handle login vs register
            },
            async authorize(credentials) {
                try {
                    if (!credentials?.email || !credentials?.password) {
                        return null;
                    }

                    if (credentials.mode === 'register') {
                        // Handle registration
                        const { data: existingUser } = await supabase
                            .from('users')
                            .select()
                            .eq('email', credentials.email)
                            .single();

                        if (existingUser) {
                            throw new Error('Email already registered');
                        }

                        const { data: newUser, error } = await supabase.auth.signUp({
                            email: credentials.email,
                            password: credentials.password,
                        });

                        if (error) throw error;

                        return newUser.user ? {
                            id: newUser.user.id,
                            email: newUser.user.email!,
                            name: newUser.user.user_metadata?.name || null,
                        } : null;

                    } else {
                        // Handle login
                        const { data: { user }, error } = await supabase.auth.signInWithPassword({
                            email: credentials.email,
                            password: credentials.password,
                        });

                        if (error) throw error;

                        return user ? {
                            id: user.id,
                            email: user.email!,
                            name: user.user_metadata?.name || null,
                        } : null;
                    }
                } catch (error) {
                    console.error("Auth error:", error);
                    return null;
                }
            }
        }),
        GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID!,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
        })
    ],
    callbacks: {
        async jwt({ token, user }) {
            if (user) {
                token.accessToken = user.accessToken
            }
            return token
        },
        async session({ session, token }) {
            if (session.user) {
                session.user.accessToken = token.accessToken as string;
            }
            return session
        }
    },
    pages: {
        signIn: '/', // Use custom sign-in page
    },
})

export { handler as GET, handler as POST }