import * as bcrypt from 'bcrypt';

export async function hashValue(value: string): Promise<string> {
  return bcrypt.hash(value, 10);
}

export async function compareHash(value: string, hash: string): Promise<boolean> {
  return bcrypt.compare(value, hash);
}
