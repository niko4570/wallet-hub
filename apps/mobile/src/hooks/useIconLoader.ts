import { useState, useEffect, useCallback } from 'react';
import { iconService } from '../services/iconService';
import { IconLoadingState } from '../types/icon';

interface UseIconLoaderOptions {
  preload?: boolean;
  size?: number;
}

export const useIconLoader = (
  walletId: string,
  options: UseIconLoaderOptions = {}
) => {
  const { preload = true } = options;
  
  const [state, setState] = useState<IconLoadingState>({
    url: null,
    isLoading: true,
    error: null,
    lastUpdated: null,
  });

  const loadIcon = useCallback(async () => {
    setState(prev => ({
      ...prev,
      isLoading: true,
      error: null,
    }));

    try {
      const iconUrl = await iconService.getWalletIcon(walletId);
      setState({
        url: iconUrl,
        isLoading: false,
        error: null,
        lastUpdated: Date.now(),
      });
      return iconUrl;
    } catch (error) {
      console.warn(`Error loading icon for ${walletId}:`, error);
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error as Error,
      }));
      return null;
    }
  }, [walletId]);

  const refreshIcon = useCallback(async () => {
    return loadIcon();
  }, [loadIcon]);

  const getFallbackIcon = useCallback(() => {
    try {
      return iconService.getIconSource(walletId).url;
    } catch {
      return '💳';
    }
  }, [walletId]);

  // Preload icon if requested
  useEffect(() => {
    if (preload && walletId) {
      loadIcon();
    }
  }, [preload, walletId, loadIcon]);

  return {
    ...state,
    refreshIcon,
    getFallbackIcon,
    // Helper for determining if the icon is an emoji (fallback) or URL
    isFallbackIcon: !state.url || (state.url.length < 10 && !state.url.startsWith('http')),
    // Helper for getting the display value (either URL or emoji)
    displayValue: state.url || getFallbackIcon(),
  };
};
