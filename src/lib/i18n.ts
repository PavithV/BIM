export type Language = 'de' | 'en' | 'fr';

export function tr(language: Language, de: string, en: string, fr?: string): string {
  if (language === 'en') return en;
  if (language === 'fr') return fr ?? en;
  return de;
}

export function aiLanguageLabel(language: Language): 'German' | 'English' | 'French' {
  if (language === 'en') return 'English';
  if (language === 'fr') return 'French';
  return 'German';
}
