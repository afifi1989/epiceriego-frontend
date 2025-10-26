import { useEffect } from 'react';
import { useRouter } from 'expo-router';

export default function EpicierHomeScreen() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/(epicier)/dashboard');
  }, []);

  return null;
}
