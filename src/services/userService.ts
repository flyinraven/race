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

export interface Submission {
  id: string;
  user_id: string;
  email: string;
  exam_type: string;
  score: string;
  max_score: string;
  time_taken: string;
  answers: any;
  created_at: string;
}

export async function submitExam(submission: {
  exam_type: string;
  score: string;
  max_score: string;
  time_taken: string;
  answers: any;
}): Promise<boolean> {
  try {
    await apiFetch('/submissions', {
      method: 'POST',
      body: JSON.stringify(submission)
    });
    return true;
  } catch (e) {
    console.error('submitExam error:', e);
    return false;
  }
}

export async function getSubmissions(): Promise<Submission[]> {
  try {
    return await apiFetch('/admin/submissions');
  } catch (error) {
    console.error('getSubmissions error:', error);
    return [];
  }
}

export async function deleteSubmission(id: string): Promise<boolean> {
  try {
    await apiFetch(`/admin/submissions/${id}`, {
      method: 'DELETE'
    });
    return true;
  } catch (e) {
    console.error('deleteSubmission error:', e);
    return false;
  }
}
