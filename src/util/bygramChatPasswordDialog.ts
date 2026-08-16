import { isBygramChatUnlocked } from './bygramChatSecurity';

export type BygramChatPasswordDialogRequest = {
  chatId: string;
  mode: 'manage' | 'unlock';
  resolve?: (isUnlocked: boolean) => void;
};

const callbacks = new Set<NoneToVoidFunction>();
let currentRequest: BygramChatPasswordDialogRequest | undefined;

export function getBygramChatPasswordDialogRequest() {
  return currentRequest;
}

export function subscribeBygramChatPasswordDialog(callback: NoneToVoidFunction) {
  callbacks.add(callback);
  return () => callbacks.delete(callback);
}

export function openBygramChatPasswordManager(chatId: string) {
  currentRequest?.resolve?.(false);
  currentRequest = { chatId, mode: 'manage' };
  notifySubscribers();
}

export function requestBygramChatUnlock(chatId: string) {
  if (isBygramChatUnlocked(chatId)) return Promise.resolve(true);

  currentRequest?.resolve?.(false);
  return new Promise<boolean>((resolve) => {
    currentRequest = { chatId, mode: 'unlock', resolve };
    notifySubscribers();
  });
}

export function closeBygramChatPasswordDialog(isUnlocked = false) {
  currentRequest?.resolve?.(isUnlocked);
  currentRequest = undefined;
  notifySubscribers();
}

function notifySubscribers() {
  callbacks.forEach((callback) => callback());
}
