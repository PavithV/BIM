'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Building, Loader2 } from 'lucide-react';
import { LoginButtonKIT } from '@/components/login-button-kit';
import { signIn } from 'next-auth/react';

export default function LoginPage() {
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const { toast } = useToast();



  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-muted/40 p-4">
      <div className="absolute top-8 left-8 flex items-center gap-3">
        <Building className="w-8 h-8 text-foreground" />
        <h1 className="text-xl md:text-2xl font-bold font-headline text-foreground">BIMCoach Studio</h1>
      </div>
      <Card className="w-full max-w-sm border-0 shadow-xl shadow-black/5">
        <CardHeader>
          <CardTitle className="text-2xl">Anmelden</CardTitle>
          <CardDescription>Geben Sie Ihre E-Mail-Adresse unten ein, um sich bei Ihrem Konto anzumelden.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4">
            <LoginButtonKIT />
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">
                  Oder mit E-Mail
                </span>
              </div>
            </div>
          </div>
          <form onSubmit={async (e) => {
            e.preventDefault();
            setIsLoading(true);
            const formData = new FormData(e.currentTarget);
            const email = formData.get('email') as string;
            const password = formData.get('password') as string;

            try {
              const result = await signIn("credentials", {
                email,
                password,
                redirect: false,
              });

              if (result?.error) {
                console.error("Login error:", result.error);
                toast({
                  title: 'Fehler bei der Anmeldung',
                  description: 'Ungültige E-Mail-Adresse oder Passwort.',
                  variant: 'destructive',
                });
              } else {
                router.push('/');
                router.refresh();
              }
            } catch (error) {
              console.error(error);
              toast({
                title: 'Fehler bei der Anmeldung',
                description: 'Ein unerwarteter Fehler ist aufgetreten.',
                variant: 'destructive',
              });
            } finally {
              setIsLoading(false);
            }
          }} className="grid gap-4 mt-4">
            <div className="grid gap-2">
              <Label htmlFor="email">E-Mail</Label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="m@beispiel.de"
                required
                disabled={isLoading}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="password">Passwort</Label>
              <Input
                id="password"
                name="password"
                type="password"
                required
                disabled={isLoading}
              />
            </div>
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Anmelden
            </Button>
          </form>
          <div className="mt-4 text-center text-sm">
            Noch kein Konto?{' '}
            <Link href="/register" className="underline text-primary">
              Registrieren
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
