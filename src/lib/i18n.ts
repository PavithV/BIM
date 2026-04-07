export type Language = 'de' | 'en';

export function tr(language: Language, de: string, en: string): string {
  return language === 'en' ? en : de;
}

export function aiLanguageLabel(language: Language): 'German' | 'English' {
  return language === 'en' ? 'English' : 'German';
}

