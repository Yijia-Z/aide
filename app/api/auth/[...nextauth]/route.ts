import NextAuth from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import GoogleProvider from "next-auth/providers/google"

const handler = NextAuth({
    providers: [
        CredentialsProvider({
            name: "Credentials",
            credentials: {
                email: { label: "Email", type: "email" },
                password: { label: "Password", type: "password" }
            },
            async authorize(credentials) {
                try {
                    const res = await fetch("http://localhost:8000/api/login", {
                        method: 'POST',
                        body: JSON.stringify(credentials),
                        headers: { "Content-Type": "application/json" }
                    })

                    const data = await res.json()

                    if (res.ok && data.access_token) {
                        // Get user info using the access token
                        const userRes = await fetch("http://localhost:8000/api/userinfo", {
                            headers: {
                                Authorization: `Bearer ${data.access_token}`
                            }
                        })

                        const userData = await userRes.json()

                        return {
                            id: userData.id,
                            name: userData.username,
                            email: userData.email,
                            accessToken: data.access_token
                        }
                    }
                    return null
                } catch (error) {
                    console.error("Auth error:", error)
                    return null
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