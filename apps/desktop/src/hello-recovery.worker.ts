import { runRecovery, type RecoveryReply } from './hello-recovery.ts';
const pending = new Map<number, { resolve: (r: RecoveryReply) => void; reject: () => void }>();
let next = 0;
self.onmessage = (event: MessageEvent) => {
  const p = pending.get(event.data?.id);
  if (!p) return;
  pending.delete(event.data.id);
  if (event.data.ok) p.resolve(event.data.reply);
  else p.reject();
};
void runRecovery((action, ticket) => new Promise((resolve, reject) => {
  const id = ++next;
  pending.set(id, { resolve, reject });
  self.postMessage({ kind: 'native', id, action, ticket });
})).then(report => self.postMessage({ kind: 'result', report }));
