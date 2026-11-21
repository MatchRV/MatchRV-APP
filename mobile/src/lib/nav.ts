import { router } from 'expo-router';

export function openRv(unitId: string) {
  router.push({ pathname: '/rv/[id]', params: { id: unitId } });
}
