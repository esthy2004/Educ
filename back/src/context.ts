import { AsyncLocalStorage } from 'node:async_hooks';
import type { Role } from './types';

export interface RequestContext {
  userId: string;
  role: Role;
  establishmentId: string | null;
}

/**
 * Contexte de requête utilisé par le stockage pour ne jamais exposer les
 * données d'un établissement à un utilisateur d'un autre établissement.
 */
export const requestContext = new AsyncLocalStorage<RequestContext>();

export function currentRequestContext(): RequestContext | undefined {
  return requestContext.getStore();
}
