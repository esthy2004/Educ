import { useEffect, useState } from 'react';

/** Incrémente à chaque écriture dans la base locale pour recharger les écrans. */
export function useDataVersion(): number {
  const [version, setVersion] = useState(0);
  useEffect(() => {
    const handler = () => setVersion((current) => current + 1);
    window.addEventListener('eduflow:data-changed', handler);
    return () => window.removeEventListener('eduflow:data-changed', handler);
  }, []);
  return version;
}
