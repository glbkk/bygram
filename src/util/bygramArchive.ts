import type { ApiMessage } from '../api/types';

export type BygramSettings = {
  isArchiveEnabled: boolean;
  isAntiDeleteEnabled: boolean;
  isEditHistoryEnabled: boolean;
  isMediaArchiveEnabled: boolean;
  mediaArchiveLimitMb: number;
};

export type BygramMessageVersion = {
  savedAt: number;
  message: ApiMessage;
};

export type BygramArchiveRecord = {
  key: string;
  chatId: string;
  messageId: number;
  savedAt: number;
  deletedAt?: number;
  message: ApiMessage;
  versions: BygramMessageVersion[];
};

export type BygramArchiveStats = {
  messageCount: number;
  deletedCount: number;
  mediaBytes: number;
};

type BygramMediaRecord = {
  key: string;
  savedAt: number;
  size: number;
  blob: Blob;
};

const DB_NAME = 'bygram-archive';
const DB_VERSION = 1;
const MESSAGE_STORE = 'messages';
const MEDIA_STORE = 'media';
const SETTINGS_STORE = 'settings';
const SETTINGS_KEY = 'archive';
const SETTINGS_STORAGE_KEY = 'bygram-settings';
const BYTES_IN_MB = 1024 * 1024;

const DEFAULT_SETTINGS: BygramSettings = {
  isArchiveEnabled: true,
  isAntiDeleteEnabled: true,
  isEditHistoryEnabled: true,
  isMediaArchiveEnabled: false,
  mediaArchiveLimitMb: 256,
};

let databasePromise: Promise<IDBDatabase> | undefined;
let settings = loadSettings();

export function getBygramSettings() {
  return settings;
}

export function updateBygramSettings(patch: Partial<BygramSettings>) {
  settings = { ...settings, ...patch };
  localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  void runTransaction(SETTINGS_STORE, 'readwrite', (store) => requestAsPromise(store.put(settings, SETTINGS_KEY)));
  return settings;
}

export async function archiveNewMessage(message: ApiMessage) {
  if (!settings.isArchiveEnabled || message.id <= 0) return;

  const key = buildMessageKey(message.chatId, message.id);
  await runTransaction(MESSAGE_STORE, 'readwrite', async (store) => {
    const current = await requestAsPromise<BygramArchiveRecord | undefined>(store.get(key));
    const record: BygramArchiveRecord = {
      key,
      chatId: message.chatId,
      messageId: message.id,
      savedAt: Date.now(),
      deletedAt: current?.deletedAt,
      message: cloneMessage(message),
      versions: current?.versions || [],
    };
    await requestAsPromise(store.put(record));
  });
}

export async function archiveEditedMessage(previousMessage: ApiMessage, message: ApiMessage) {
  if (!settings.isArchiveEnabled || message.id <= 0) return;

  const key = buildMessageKey(message.chatId, message.id);
  await runTransaction(MESSAGE_STORE, 'readwrite', async (store) => {
    const current = await requestAsPromise<BygramArchiveRecord | undefined>(store.get(key));
    const versions = current?.versions || [];
    const hasContentChanged = JSON.stringify(previousMessage.content) !== JSON.stringify(message.content);

    if (settings.isEditHistoryEnabled && hasContentChanged) {
      versions.push({ savedAt: Date.now(), message: cloneMessage(previousMessage) });
    }

    const record: BygramArchiveRecord = {
      key,
      chatId: message.chatId,
      messageId: message.id,
      savedAt: Date.now(),
      deletedAt: current?.deletedAt,
      message: cloneMessage(message),
      versions,
    };
    await requestAsPromise(store.put(record));
  });
}

export async function archiveDeletedMessage(message: ApiMessage) {
  if (!settings.isArchiveEnabled || message.id <= 0) return;

  const key = buildMessageKey(message.chatId, message.id);
  await runTransaction(MESSAGE_STORE, 'readwrite', async (store) => {
    const current = await requestAsPromise<BygramArchiveRecord | undefined>(store.get(key));
    const record: BygramArchiveRecord = {
      key,
      chatId: message.chatId,
      messageId: message.id,
      savedAt: current?.savedAt || Date.now(),
      deletedAt: Date.now(),
      message: cloneMessage(message),
      versions: current?.versions || [],
    };
    await requestAsPromise(store.put(record));
  });
}

export async function markArchivedMessagesDeleted(chatId: string, messageIds: number[]) {
  if (!settings.isArchiveEnabled) return;

  const deletedAt = Date.now();
  await runTransaction(MESSAGE_STORE, 'readwrite', async (store) => {
    const records = await Promise.all(messageIds.map((id) => requestAsPromise<BygramArchiveRecord | undefined>(
      store.get(buildMessageKey(chatId, id)),
    )));

    await Promise.all(records.filter((record): record is BygramArchiveRecord => (
      Boolean(record) && messageIds.includes(record.messageId)
    )).map((record) => requestAsPromise(store.put({ ...record, deletedAt }))));
  });
}

export async function getArchivedMessages(chatId: string, messageIds: number[]) {
  return runTransaction(MESSAGE_STORE, 'readonly', async (store) => {
    const records = await Promise.all(messageIds.map((id) => requestAsPromise<BygramArchiveRecord | undefined>(
      store.get(buildMessageKey(chatId, id)),
    )));
    return records.filter((record): record is BygramArchiveRecord => Boolean(record));
  });
}

export async function getArchivedRetainedMessages(chatId: string) {
  if (!settings.isArchiveEnabled) return [];

  const records = await runTransaction(MESSAGE_STORE, 'readonly', (store) => (
    requestAsPromise<BygramArchiveRecord[]>(store.index('chatId').getAll(IDBKeyRange.only(chatId)))
  ));

  return records.filter((record) => (
    (settings.isAntiDeleteEnabled && Boolean(record.deletedAt))
    || record.message.content.ttlSeconds !== undefined
  ));
}

export async function getArchivedChatMessages(chatId: string) {
  const records = await runTransaction(MESSAGE_STORE, 'readonly', (store) => (
    requestAsPromise<BygramArchiveRecord[]>(store.index('chatId').getAll(IDBKeyRange.only(chatId)))
  ));

  return records.sort((first, second) => (
    first.message.date - second.message.date || first.messageId - second.messageId
  ));
}

export async function getMessageHistory(chatId: string, messageId: number) {
  const record = await runTransaction(MESSAGE_STORE, 'readonly', (store) => (
    requestAsPromise<BygramArchiveRecord | undefined>(store.get(buildMessageKey(chatId, messageId)))
  ));
  return record?.versions || [];
}

export async function archiveMedia(key: string, blob: Blob) {
  if (!settings.isMediaArchiveEnabled || !blob.size) return;

  const record: BygramMediaRecord = {
    key,
    blob,
    size: blob.size,
    savedAt: Date.now(),
  };

  await runTransaction(MEDIA_STORE, 'readwrite', async (store) => {
    await requestAsPromise(store.put(record));
    const records = await requestAsPromise<BygramMediaRecord[]>(store.getAll());
    let totalSize = records.reduce((total, item) => total + item.size, 0);
    const limit = settings.mediaArchiveLimitMb * BYTES_IN_MB;

    for (const item of records.sort((first, second) => first.savedAt - second.savedAt)) {
      if (totalSize <= limit) break;
      await requestAsPromise(store.delete(item.key));
      totalSize -= item.size;
    }
  });
}

export async function getArchivedMedia(key: string) {
  if (!settings.isMediaArchiveEnabled) return undefined;

  const record = await runTransaction(MEDIA_STORE, 'readonly', (store) => (
    requestAsPromise<BygramMediaRecord | undefined>(store.get(key))
  ));
  return record?.blob;
}

export async function getBygramArchiveStats(): Promise<BygramArchiveStats> {
  const [messages, media] = await Promise.all([
    runTransaction(MESSAGE_STORE, 'readonly', (store) => requestAsPromise<BygramArchiveRecord[]>(store.getAll())),
    runTransaction(MEDIA_STORE, 'readonly', (store) => requestAsPromise<BygramMediaRecord[]>(store.getAll())),
  ]);

  return {
    messageCount: messages.length,
    deletedCount: messages.filter(({ deletedAt }) => Boolean(deletedAt)).length,
    mediaBytes: media.reduce((total, item) => total + item.size, 0),
  };
}

export async function clearBygramArchive() {
  await Promise.all([
    runTransaction(MESSAGE_STORE, 'readwrite', (store) => requestAsPromise(store.clear())),
    runTransaction(MEDIA_STORE, 'readwrite', (store) => requestAsPromise(store.clear())),
  ]);
}

function loadSettings(): BygramSettings {
  try {
    const stored = localStorage.getItem(SETTINGS_STORAGE_KEY);
    return stored ? { ...DEFAULT_SETTINGS, ...JSON.parse(stored) as Partial<BygramSettings> } : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function buildMessageKey(chatId: string, messageId: number) {
  return `${chatId}:${messageId}`;
}

function cloneMessage(message: ApiMessage) {
  return structuredClone(message);
}

function getDatabase() {
  databasePromise ||= new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(MESSAGE_STORE)) {
        const store = database.createObjectStore(MESSAGE_STORE, { keyPath: 'key' });
        store.createIndex('chatId', 'chatId');
        store.createIndex('messageId', 'messageId');
        store.createIndex('deletedAt', 'deletedAt');
      }
      if (!database.objectStoreNames.contains(MEDIA_STORE)) {
        database.createObjectStore(MEDIA_STORE, { keyPath: 'key' });
      }
      if (!database.objectStoreNames.contains(SETTINGS_STORE)) {
        database.createObjectStore(SETTINGS_STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
  });
  return databasePromise;
}

async function runTransaction<T>(
  storeName: string,
  mode: IDBTransactionMode,
  callback: (store: IDBObjectStore) => Promise<T>,
) {
  const database = await getDatabase();
  const transaction = database.transaction(storeName, mode);
  const transactionPromise = new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
  const result = await callback(transaction.objectStore(storeName));
  await transactionPromise;
  return result;
}

function requestAsPromise<T = IDBValidKey>(request: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
