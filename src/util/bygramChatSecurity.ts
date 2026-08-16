import { ACCOUNT_SLOT } from './multiaccount';

type StoredChatPassword = {
  salt: string;
  hash: string;
};

const STORAGE_KEY = `bygram-chat-passwords-${ACCOUNT_SLOT || 1}`;
const PBKDF2_ITERATIONS = 210000;
const SALT_LENGTH = 16;

const unlockedChatIds = new Set<string>();

export function hasBygramChatPassword(chatId: string) {
  return Boolean(readPasswords()[chatId]);
}

export function isBygramChatUnlocked(chatId: string) {
  return !hasBygramChatPassword(chatId) || unlockedChatIds.has(chatId);
}

export async function setBygramChatPassword(chatId: string, password: string) {
  const saltBytes = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
  const salt = encodeBytes(saltBytes);
  const hash = await derivePasswordHash(password, saltBytes);
  const passwords = readPasswords();

  passwords[chatId] = { salt, hash };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(passwords));
  unlockedChatIds.add(chatId);
}

export async function verifyBygramChatPassword(chatId: string, password: string) {
  const storedPassword = readPasswords()[chatId];
  if (!storedPassword) return true;

  const hash = await derivePasswordHash(password, decodeBytes(storedPassword.salt));
  const isValid = hash === storedPassword.hash;
  if (isValid) unlockedChatIds.add(chatId);
  return isValid;
}

export async function removeBygramChatPassword(chatId: string, password: string) {
  if (!await verifyBygramChatPassword(chatId, password)) return false;

  const passwords = readPasswords();
  delete passwords[chatId];
  localStorage.setItem(STORAGE_KEY, JSON.stringify(passwords));
  unlockedChatIds.delete(chatId);
  return true;
}

export function lockBygramChats() {
  unlockedChatIds.clear();
}

async function derivePasswordHash(password: string, salt: Uint8Array) {
  const passwordKey = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  const bits = await crypto.subtle.deriveBits({
    name: 'PBKDF2',
    hash: 'SHA-256',
    salt: new Uint8Array(salt).buffer,
    iterations: PBKDF2_ITERATIONS,
  }, passwordKey, 256);

  return encodeBytes(new Uint8Array(bits));
}

function readPasswords(): Record<string, StoredChatPassword> {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') as Record<string, StoredChatPassword>;
  } catch {
    return {};
  }
}

function encodeBytes(bytes: Uint8Array) {
  return btoa(String.fromCharCode(...bytes));
}

function decodeBytes(value: string) {
  return Uint8Array.from(atob(value), (character) => character.charCodeAt(0));
}
