import { apiFetch } from '../lib/apiClient';

export interface UserProfile {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  role: string;
  tier: string;
  joined: string;
  tierExpiry?: string | null;
}

export async function getUsers(): Promise<UserProfile[]> {
  try {
    return await apiFetch('/admin/users');
  } catch (error) {
    console.error('getUsers error:', error);
    return [];
  }
}

export async function addUser(profile: { email: string; role: string; tier: string }): Promise<boolean> {
  try {
    await apiFetch('/admin/users', {
      method: 'POST',
      body: JSON.stringify(profile)
    });
    return true;
  } catch (e) {
    console.error('addUser error:', e);
    throw e;
  }
}

export async function updateUser(profile: UserProfile): Promise<boolean> {
  try {
    await apiFetch(`/admin/users/${profile.id}`, {
      method: 'PUT',
      body: JSON.stringify(profile)
    });
    return true;
  } catch (error) {
    console.error('updateUser error:', error);
    return false;
  }
}

export async function deleteUser(id: string): Promise<boolean> {
  try {
    await apiFetch(`/admin/users/${id}`, {
      method: 'DELETE'
    });
    return true;
  } catch (e) {
    console.error('deleteUser error:', e);
    return false;
  }
}

export async function syncUserSubscriptionTier(userId: string, tier: 'free' | 'pro'): Promise<boolean> {
  // Mocking tier update
  return true;
}
