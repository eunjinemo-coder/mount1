import { getServerClient } from '@mount/db';

export async function signOut(): Promise<void> {
  try {
    const client = await getServerClient();
    await client.auth.signOut();
  } catch {
    return;
  }
}
