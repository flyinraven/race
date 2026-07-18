export const apiFetch = async (url: string, options: RequestInit = {}) => {
  const token = localStorage.getItem('siteground_token');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const apiBase = import.meta.env.VITE_API_URL || '';
  const res = await fetch(`${apiBase}/api${url}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'API Request Failed');
  }
  return res.json();
};
