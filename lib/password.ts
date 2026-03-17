import { compare, hash } from "bcryptjs";

const PASSWORD_SALT_ROUNDS = 12;

export function hashPassword(value: string) {
  return hash(value, PASSWORD_SALT_ROUNDS);
}

export function verifyPassword(value: string, passwordHash: string) {
  return compare(value, passwordHash);
}
