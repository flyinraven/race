import { apiFetch } from '../lib/apiClient';

export interface UserProfile {
  id: string;
  email: string;
  first_name?: string;
  last_name?: string;
  target_exam?: string;
  exam_date?: string;
  avatar_url?: string;
}

export async function getUsers(): Promise<UserProfile[]> {
  try {
    const res = await apiFetch('/profiles');
    // For admin, we should have an endpoint returning all users
    // For now, let's just assume we return the current user's profile
    return res;
  } catch (error) {
    console.error('getUsers error:', error);
    return [];
  }
}

export async function addUser(email: string, role: string, tier: string): Promise<boolean> {
  // Not fully implemented for custom admin auth yet
  console.warn("addUser not implemented for custom auth");
  return false;
}

export async function updateUser(profile: UserProfile): Promise<boolean> {
  try {
    await apiFetch('/profiles', {
      method: 'POST',
      body: JSON.stringify(profile)
    });
    return true;
  } catch (error) {
    console.error('updateUser error:', error);
    return false;
  }
}

export async function deleteUser(id: string): Promise<boolean> {
  // Not fully implemented for custom admin auth yet
  console.warn("deleteUser not implemented for custom auth");
  return false;
}

export async function syncUserSubscriptionTier(userId: string, tier: 'free' | 'pro'): Promise<boolean> {
  // Mocking tier update
  return true;
}
