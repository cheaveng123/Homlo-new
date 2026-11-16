import FilterScreen from '@/04_FilterScreen';
import { useRouter } from 'expo-router';
import { Stack } from 'expo-router';

export default function FiltersRoute() {
  const router = useRouter();
  return (
    <>
      <Stack.Screen options={{ presentation: 'modal', animation: 'slide_from_bottom', headerShown: false }} />
      <FilterScreen onApply={() => router.back()} />
    </>
  );
}
