import { ByProtoCodec } from './codec';
import { validateByProtoEnvelope } from './validator';

export function parseByProtoMessage(messageText: string) {
  if (!ByProtoCodec.hasPayload(messageText)) return { text: messageText };
  const text = ByProtoCodec.strip(messageText);
  const envelope = validateByProtoEnvelope(ByProtoCodec.decode(messageText));
  return envelope ? { text, envelope } : { text };
}
