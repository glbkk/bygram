export type BygramGhostStoryChoice = 'ghost' | 'normal';

type Request = {
  resolve: (choice?: BygramGhostStoryChoice) => void;
};

const callbacks = new Set<NoneToVoidFunction>();
let currentRequest: Request | undefined;

export function getBygramGhostStoryRequest() {
  return currentRequest;
}

export function subscribeBygramGhostStoryDialog(callback: NoneToVoidFunction) {
  callbacks.add(callback);
  return () => callbacks.delete(callback);
}

// Resolves once the choice is made, so the caller can hold the story back until then. Dismissing the
// dialog resolves with nothing, which means the story should not be opened at all.
export function requestBygramGhostStoryChoice() {
  currentRequest?.resolve(undefined);
  return new Promise<BygramGhostStoryChoice | undefined>((resolve) => {
    currentRequest = { resolve };
    notifySubscribers();
  });
}

export function resolveBygramGhostStoryChoice(choice?: BygramGhostStoryChoice) {
  currentRequest?.resolve(choice);
  currentRequest = undefined;
  notifySubscribers();
}

function notifySubscribers() {
  callbacks.forEach((callback) => callback());
}
