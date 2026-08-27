import type {
  ByProtoBubbleProfile,
  ByProtoPeerBanner,
  ByProtoPeerCapabilities,
  ByProtoPeerProfile,
} from './types';

type StoredBubble = ByProtoBubbleProfile & { peerId: string; updatedAt: number };
type ProcessedPacket = { id: string; processedAt: number };
type ProtocolState = { key: string; value: unknown; updatedAt: number };

const DB_NAME = 'bygram-byproto-v1';
const DB_VERSION = 1;
const CAPABILITIES_STORE = 'peerCapabilities';
const PROFILES_STORE = 'peerProfiles';
const BUBBLES_STORE = 'peerBubbleStyles';
const BANNERS_STORE = 'peerBanners';
const PACKETS_STORE = 'processedPacketIds';
const STATE_STORE = 'protocolState';
const MAX_PROCESSED_PACKETS = 2048;

let databasePromise: Promise<IDBDatabase> | undefined;

export const ByProtoStore = {
  getPeerCapabilities(peerId: string) {
    return getRecord<ByProtoPeerCapabilities>(CAPABILITIES_STORE, peerId);
  },

  setPeerCapabilities(record: ByProtoPeerCapabilities) {
    return putRecord(CAPABILITIES_STORE, record);
  },

  getPeerProfile(peerId: string) {
    return getRecord<ByProtoPeerProfile>(PROFILES_STORE, peerId);
  },

  setPeerProfile(record: ByProtoPeerProfile) {
    return putRecord(PROFILES_STORE, record);
  },

  getPeerBubble(peerId: string) {
    return getRecord<StoredBubble>(BUBBLES_STORE, peerId);
  },

  setPeerBubble(record: StoredBubble) {
    return putRecord(BUBBLES_STORE, record);
  },

  getPeerBanner(peerId: string) {
    return getRecord<ByProtoPeerBanner>(BANNERS_STORE, peerId);
  },

  setPeerBanner(record: ByProtoPeerBanner) {
    return putRecord(BANNERS_STORE, record);
  },

  deletePeerBanner(peerId: string) {
    return deleteRecord(BANNERS_STORE, peerId);
  },

  async hasProcessedPacket(id: string) {
    return Boolean(await getRecord<ProcessedPacket>(PACKETS_STORE, id));
  },

  async markPacketProcessed(id: string) {
    await putRecord(PACKETS_STORE, { id, processedAt: Date.now() });
    await pruneProcessedPackets();
  },

  async getProtocolState<T>(key: string) {
    return (await getRecord<ProtocolState>(STATE_STORE, key))?.value as T | undefined;
  },

  setProtocolState(key: string, value: unknown) {
    return putRecord(STATE_STORE, { key, value, updatedAt: Date.now() });
  },
};

async function getRecord<T>(storeName: string, key: IDBValidKey) {
  const database = await openDatabase();
  return requestAsPromise<T | undefined>(database.transaction(storeName).objectStore(storeName).get(key));
}

async function putRecord(storeName: string, value: unknown) {
  const database = await openDatabase();
  const transaction = database.transaction(storeName, 'readwrite');
  await requestAsPromise(transaction.objectStore(storeName).put(value));
  await transactionDone(transaction);
}

async function deleteRecord(storeName: string, key: IDBValidKey) {
  const database = await openDatabase();
  const transaction = database.transaction(storeName, 'readwrite');
  await requestAsPromise(transaction.objectStore(storeName).delete(key));
  await transactionDone(transaction);
}

async function pruneProcessedPackets() {
  const database = await openDatabase();
  const transaction = database.transaction(PACKETS_STORE, 'readwrite');
  const store = transaction.objectStore(PACKETS_STORE);
  const count = await requestAsPromise<number>(store.count());
  let remaining = count - MAX_PROCESSED_PACKETS;
  if (remaining > 0) {
    await new Promise<void>((resolve, reject) => {
      const request = store.index('processedAt').openKeyCursor();
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const cursor = request.result;
        if (!cursor || remaining <= 0) {
          resolve();
          return;
        }
        store.delete(cursor.primaryKey);
        remaining--;
        cursor.continue();
      };
    });
  }
  await transactionDone(transaction);
}

function openDatabase() {
  databasePromise ||= new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = () => {
      const database = request.result;
      createStore(database, CAPABILITIES_STORE, 'peerId');
      createStore(database, PROFILES_STORE, 'peerId');
      createStore(database, BUBBLES_STORE, 'peerId');
      createStore(database, BANNERS_STORE, 'peerId');
      const packets = createStore(database, PACKETS_STORE, 'id');
      if (packets && !packets.indexNames.contains('processedAt')) packets.createIndex('processedAt', 'processedAt');
      createStore(database, STATE_STORE, 'key');
    };
  });
  return databasePromise;
}

function createStore(database: IDBDatabase, name: string, keyPath: string) {
  return database.objectStoreNames.contains(name) ? undefined : database.createObjectStore(name, { keyPath });
}

function requestAsPromise<T>(request: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function transactionDone(transaction: IDBTransaction) {
  return new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}
