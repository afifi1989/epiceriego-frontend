/**
 * Composant Image avec fallback automatique
 * Essaie plusieurs URLs en cas d'échec de chargement
 */

import React, { useState } from 'react';
import { Image, ImageProps, Text, View } from 'react-native';

interface FallbackImageProps extends Omit<ImageProps, 'source'> {
  urls: string[];
  showLoading?: boolean;
}

export const FallbackImage: React.FC<FallbackImageProps> = ({
  urls,
  showLoading = true,
  style,
  onError,
  onLoadStart,
  onLoadEnd,
  ...props
}) => {
  const [currentUrlIndex, setCurrentUrlIndex] = useState(0);
  const [allFailed, setAllFailed] = useState(false);

  const handleError = (error: any) => {
    console.log(`[FallbackImage] Failed to load URL: ${urls[currentUrlIndex]}`);
    const nextIndex = currentUrlIndex + 1;

    if (nextIndex < urls.length) {
      console.log(`[FallbackImage] Trying next URL (${nextIndex + 1}/${urls.length}): ${urls[nextIndex]}`);
      setCurrentUrlIndex(nextIndex);
    } else {
      console.error('[FallbackImage] All URLs failed to load:', urls);
      setAllFailed(true);
      // Call parent's onError callback if provided
      if (onError) {
        onError(error);
      }
    }
  };

  const handleLoadEnd = () => {
    console.log(`[FallbackImage] Successfully loaded URL (${currentUrlIndex + 1}/${urls.length}): ${urls[currentUrlIndex]}`);
    // Call parent's onLoadEnd callback if provided
    if (onLoadEnd) {
      onLoadEnd?.();
    }
  };

  const handleLoadStart = () => {
    console.log(`[FallbackImage] Loading URL (${currentUrlIndex + 1}/${urls.length}): ${urls[currentUrlIndex]}`);
    // Call parent's onLoadStart callback if provided
    if (onLoadStart) {
      onLoadStart?.();
    }
  };

  if (urls.length === 0) {
    console.error('[FallbackImage] No URLs provided');
    return null;
  }

  // If all URLs failed, show a placeholder/empty view instead of null
  // This ensures the image container remains visible in the UI
  if (allFailed) {
    console.error('[FallbackImage] All URLs failed to load, showing placeholder');
    return (
      <View style={[style, { backgroundColor: '#f5f5f5', justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={{ fontSize: 32, color: '#ccc' }}>⚠️</Text>
      </View>
    );
  }

  return (
    <Image
      key={`fallback-image-${currentUrlIndex}`}
      source={{ uri: urls[currentUrlIndex] }}
      style={style}
      onError={handleError}
      onLoadStart={handleLoadStart}
      onLoadEnd={handleLoadEnd}
      {...props}
    />
  );
};
