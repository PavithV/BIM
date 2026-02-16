"use client"

import { signInWithKit } from "@/lib/auth-actions"
import { Button } from "@/components/ui/button"

export function LoginButtonKIT() {
    return (
        <Button
            variant="outline"
            onClick={() => signInWithKit()}
            className="w-full relative"
        >
            <img
                src="https://upload.wikimedia.org/wikipedia/commons/3/3a/Logo_KIT.svg"
                alt="KIT Logo"
                className="h-4 w-auto absolute left-4"
            />
            Login mit KIT Account
        </Button>
    )
}
