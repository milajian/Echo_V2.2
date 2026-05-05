import { useState, useEffect } from 'react';
import { getMe } from '../lib/localAuth';

export function useCollection<T>(collectionName: string, sortField: string = 'createdAt') {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      const res = await fetch(`/api/${collectionName}`, { credentials: 'include' });
      if (!res.ok) {
        if (res.status === 401) {
          window.dispatchEvent(new CustomEvent('auth-unauthorized'));
        }
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to fetch ${collectionName} (${res.status})`);
      }
      const items = await res.json();
      setData(items);
      setLoading(false);
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    
    // Listen for custom events to refresh data when updates occur
    const handleUpdate = () => fetchData();
    window.addEventListener('db-update', handleUpdate);
    return () => window.removeEventListener('db-update', handleUpdate);
  }, [collectionName]);

  return { data, loading, error, refresh: fetchData };
}

function notifyUpdate() {
  window.dispatchEvent(new CustomEvent('db-update'));
}

export async function addDocument(collectionName: string, data: any) {
  const res = await fetch(`/api/${collectionName}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
    credentials: 'include',
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(errorData.error || 'Failed to add document');
  }
  notifyUpdate();
  return res.json();
}

export async function updateDocument(collectionName: string, id: string, data: any) {
  const res = await fetch(`/api/${collectionName}/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
    credentials: 'include',
  });
  if (!res.ok) throw new Error('Failed to update document');
  notifyUpdate();
}

export async function deleteDocument(collectionName: string, id: string) {
  const res = await fetch(`/api/${collectionName}/${id}`, {
    method: 'DELETE',
    credentials: 'include',
  });
  if (!res.ok) throw new Error('Failed to delete document');
  notifyUpdate();
}
