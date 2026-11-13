import { useCallback, useSyncExternalStore } from 'react'

export const MEDIA = {
  mobile: '(max-width: 767px)',
  tablet: '(min-width: 768px) and (max-width: 1279px)',
  desktop: '(min-width: 1280px)',
}

// Pantau apakah media query cocok dengan lebar layar saat ini
export function useMediaQuery(query) {
  const langganan = useCallback(
    (ubah) => {
      const media = window.matchMedia(query)
      media.addEventListener('change', ubah)
      return () => media.removeEventListener('change', ubah)
    },
    [query],
  )
  return useSyncExternalStore(langganan, () => window.matchMedia(query).matches)
}
