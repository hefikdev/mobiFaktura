import "server-only";
import argon2 from "argon2";

// Hash password using Argon2id (most secure variant)
export async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 65536, // 64 MB
    timeCost: 3,
    parallelism: 4,
  });
}

// Verify password against hash
export async function verifyPassword(
  hash: string,
  password: string
): Promise<boolean> {
  try {
    return await argon2.verify(hash, password);
  } catch {
    return false;
  }
}

// Password validation rules
export function validatePassword(password: string): {
  valid: boolean;
  message: string;
} {
  if (password.length < 8) {
    return { valid: false, message: "Hasło musi mieć minimum 8 znaków" };
  }
  if (!/[A-Z]/.test(password)) {
    return { valid: false, message: "Hasło musi zawierać wielką literę" };
  }
  if (!/[a-z]/.test(password)) {
    return { valid: false, message: "Hasło musi zawierać małą literę" };
  }
  if (!/[0-9]/.test(password)) {
    return { valid: false, message: "Hasło musi zawierać cyfrę" };
  }
  return { valid: true, message: "" };
}
