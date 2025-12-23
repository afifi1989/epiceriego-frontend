import { useEffect } from 'react';
import { useRouter } from 'expo-router';

export default function ClientHomeScreen() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/(client)/home');
  }, []);

  return null;
}
