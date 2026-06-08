import { redirect } from 'next/navigation';

import { routing } from '@/i18n/routing';

export default async function LocaleHomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: requestedLocale } = await params;
  const locale = routing.locales.includes(requestedLocale as (typeof routing.locales)[number])
    ? requestedLocale
    : routing.defaultLocale;

  redirect(`/${locale}/projects`);
}
