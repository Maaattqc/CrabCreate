import { useState, useEffect } from 'react';
import { Lock } from 'lucide-react';
import { getFileLocks } from '../../api/tickets';
import type { FileLock } from '../../types';

export default function FileLockBanner() {
  const [locks, setLocks] = useState<FileLock[]>([]);

  useEffect(() => {
    getFileLocks().then(setLocks).catch(() => {});
    const interval = setInterval(() => {
      getFileLocks().then(setLocks).catch(() => {});
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  if (locks.length === 0) return null;

  return (
    <div className="mx-6 mt-3 px-4 py-2 bg-amber-500/10 border border-amber-500/20 rounded-lg flex items-center gap-3">
      <Lock size={14} className="text-amber-400 shrink-0" />
      <span className="text-xs text-amber-300">
        <strong>{locks.length} fichier(s) verrouillé(s) :</strong>{' '}
        {locks.slice(0, 3).map(l => `${l.file_path} (#${l.ticket_id})`).join(', ')}
        {locks.length > 3 && ` +${locks.length - 3} autres`}
      </span>
    </div>
  );
}
