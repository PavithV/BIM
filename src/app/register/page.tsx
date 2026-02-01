'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Building, Loader2 } from 'lucide-react';

export default function RegisterPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      toast({
        title: 'Fehler bei der Registrierung',
        description: 'Das Passwort muss mindestens 6 Zeichen lang sein.',
        variant: 'destructive',
      });
      return;
    }
    setIsLoading(true);
    try {
      const { data: { user }, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: name,
          },
        },
      });

      if (error) throw error;

      if (user) {
        // User created. Profile creation handled by Database Trigger (handle_new_user).
        console.log('User created:', user.id);
      }

      router.push('/');
      router.refresh();

    } catch (error: any) {
      console.error(error);
      let errorMessage = 'Registrierung fehlgeschlagen. Bitte versuchen Sie es erneut.';
      if (error.message.includes('already registered')) {
        errorMessage = 'Diese E-Mail-Adresse wird bereits verwendet.';
      } else if (error.message.includes('valid email')) {
        errorMessage = 'Bitte geben Sie eine gültige E-Mail-Adresse ein.';
      }
      toast({
        title: 'Fehler bei der Registrierung',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-muted/40 p-4">
      <div className="absolute top-8 left-8 flex items-center gap-3">
        <Building className="w-8 h-8 text-foreground" />
        <h1 className="text-xl md:text-2xl font-bold font-headline text-foreground">BIMCoach Studio</h1>
      </div>
      <Card className="w-full max-w-sm border-0 shadow-xl shadow-black/5">
        <CardHeader>
          <CardTitle className="text-2xl">Registrieren</CardTitle>
          <CardDescription>Erstellen Sie ein Konto, um loszulegen.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSignUp} className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                placeholder="Max Mustermann"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={isLoading}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="email">E-Mail</Label>
              <Input
                id="email"
                type="email"
                placeholder="m@beispiel.de"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isLoading}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="password">Passwort</Label>
              <Input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoading}
              />
            </div>
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Konto erstellen
            </Button>
          </form>
          <div className="mt-4 text-center text-sm">
            Haben Sie bereits ein Konto?{' '}
            <Link href="/login" className="underline text-primary">
              Anmelden
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
