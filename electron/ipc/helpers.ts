import { getSession } from '../../src/main/services/auth.service';

export function serialize(obj: any) {
  return JSON.parse(JSON.stringify(obj, (_key, value) =>
    typeof value === 'bigint' ? value.toString() : value
  ));
}

export function requireAuth() {
  const session = getSession();
  if (!session) throw new Error('Not authenticated');
  return session;
}
