"use server"
import { signIn } from "@/auth"

export async function signInWithKit() {
    await signIn("kit", { redirectTo: "/" })
}

export async function signInWithCredentials(formData: FormData) {
    try {
        await signIn("credentials", formData);
    } catch (error) {
        if ((error as Error).message.includes("NEXT_REDIRECT")) {
            throw error; // Rethrow redirect error
        }
        console.error("Sign in error in action:", error);
        throw error;
    }
}
