import { useEffect, useState } from 'react';
import { onlineManager } from '@tanstack/react-query';

export function useOnline(): boolean {
  const [online, setOnline] = useState(onlineManager.isOnline());
  useEffect(() => onlineManager.subscribe(setOnline), []);
  return online;
}
