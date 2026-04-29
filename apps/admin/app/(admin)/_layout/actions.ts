'use server';

import { signOut } from '@mount/lib';
import { redirect } from 'next/navigation';

export async function signOutAction(): Promise<void> {
  await signOut();
  redirect('/login');
}
