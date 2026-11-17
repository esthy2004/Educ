import type { EstablishmentWithStats, UserAccount } from '@/types';
import { apiMutate, apiRequest } from '@/services/api';

export interface EstablishmentInput {
  name: string;
  code: string;
  type: string;
  address: string;
  city: string;
  country: string;
  phone: string;
  email: string;
  director: string;
}

export interface EstablishmentAdminInput {
  name: string;
  username: string;
  email: string;
  password: string;
  phone: string;
}

export interface CreateEstablishmentInput extends EstablishmentInput {
  admin: EstablishmentAdminInput;
}

export const schoolsService = {
  list: () => apiRequest<EstablishmentWithStats[]>('/schools'),

  create: (input: CreateEstablishmentInput) =>
    apiMutate<{ establishment: EstablishmentWithStats; admin: Omit<UserAccount, 'password'> }>(
      '/schools',
      { method: 'POST', body: JSON.stringify(input) },
    ),

  update: (id: string, input: Partial<EstablishmentInput> & { active?: boolean }) =>
    apiMutate<EstablishmentWithStats>(`/schools/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(input),
    }),

  createAdmin: (id: string, input: EstablishmentAdminInput) =>
    apiMutate<Omit<UserAccount, 'password'>>(`/schools/${encodeURIComponent(id)}/admins`, {
      method: 'POST',
      body: JSON.stringify(input),
    }),
};
