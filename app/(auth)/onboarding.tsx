import { useRouter } from 'expo-router';
import React, { useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';

const { width, height } = Dimensions.get('window');

interface OnboardingSlide {
  id: string;
  title: string;
  description: string;
  emoji: string;
  bgColor: string;
}

const slides: OnboardingSlide[] = [
  {
    id: '1',
    title: 'Bienvenue à EpicerieGo! 👋',
    description:
      'Découvrez une nouvelle façon de faire vos courses. Achetez directement auprès de vos épiceries locales en quelques clics.',
    emoji: '🛒',
    bgColor: '#4CAF50',
  },
  {
    id: '2',
    title: 'Support Local 🏪',
    description:
      'Aidez vos épiceries locales à prospérer en commandant directement. Chaque achat soutient votre communauté.',
    emoji: '🏘️',
    bgColor: '#2196F3',
  },
  {
    id: '3',
    title: 'Livraison Rapide ⚡',
    description:
      'Faites vos courses maintenant et recevez votre commande dans les meilleurs délais avec nos livreurs de confiance.',
    emoji: '🚴',
    bgColor: '#FF9800',
  },
  {
    id: '4',
    title: 'IA Intelligente 🤖',
    description:
      'Utilisez notre assistant IA pour trouver rapidement les produits que vous cherchez. C\'est magique!',
    emoji: '✨',
    bgColor: '#9C27B0',
  },
  {
    id: '5',
    title: 'Prêt à commencer? 🚀',
    description:
      'Rejoignez des milliers de clients satisfaits. Créez votre compte ou connectez-vous maintenant.',
    emoji: '🎉',
    bgColor: '#E91E63',
  },
];

export default function OnboardingScreen() {
  const router = useRouter();
  const flatListRef = useRef<FlatList>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const scrollX = useRef(new Animated.Value(0)).current;

  const handleViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: any[] }) => {
      if (viewableItems.length > 0) {
        setCurrentIndex(viewableItems[0].index);
      }
    }
  ).current;

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 50,
  }).current;

  const handleNext = () => {
    if (currentIndex < slides.length - 1) {
      flatListRef.current?.scrollToIndex({
        index: currentIndex + 1,
        animated: true,
      });
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      flatListRef.current?.scrollToIndex({
        index: currentIndex - 1,
        animated: true,
      });
    }
  };

  const handleGetStarted = () => {
    router.push('/(auth)/login');
  };

  const renderSlide = ({ item }: { item: OnboardingSlide }) => (
    <View style={[styles.slide, { backgroundColor: item.bgColor }]}>
      <View style={styles.slideContent}>
        <Text style={styles.largeEmoji}>{item.emoji}</Text>

        <Text style={styles.title}>{item.title}</Text>

        <Text style={styles.description}>{item.description}</Text>
      </View>
    </View>
  );

  const renderPagination = () => {
    return (
      <View style={styles.paginationContainer}>
        {slides.map((_, index) => (
          <View
            key={index}
            style={[
              styles.paginationDot,
              {
                backgroundColor:
                  index === currentIndex
                    ? '#fff'
                    : 'rgba(255, 255, 255, 0.5)',
                width: index === currentIndex ? 30 : 10,
              },
            ]}
          />
        ))}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Slides - Fixed height */}
      <View style={styles.slidesContainer}>
        <FlatList
          ref={flatListRef}
          data={slides}
          renderItem={renderSlide}
          keyExtractor={(item) => item.id}
          horizontal
          pagingEnabled
          scrollEnabled
          onScroll={Animated.event(
            [{ nativeEvent: { contentOffset: { x: scrollX } } }],
            { useNativeDriver: false }
          )}
          onViewableItemsChanged={handleViewableItemsChanged}
          viewabilityConfig={viewabilityConfig}
          showsHorizontalScrollIndicator={false}
          scrollEventThrottle={16}
        />
      </View>

      {/* Bottom Section - Fixed at bottom */}
      <View style={styles.bottomSection}>
        {/* Pagination */}
        {renderPagination()}

        {/* Navigation Buttons */}
        <View style={styles.buttonContainer}>
          {currentIndex > 0 && (
            <TouchableOpacity
              style={[styles.button, styles.prevButton]}
              onPress={handlePrev}
            >
              <Text style={styles.buttonText}>← Retour</Text>
            </TouchableOpacity>
          )}

          {currentIndex < slides.length - 1 ? (
            <TouchableOpacity
              style={[styles.button, styles.nextButton]}
              onPress={handleNext}
            >
              <Text style={styles.buttonText}>Suivant →</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.button, styles.startButton]}
              onPress={handleGetStarted}
            >
              <Text style={styles.startButtonText}>Commencer 🚀</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Skip Button - Always visible except on last slide */}
        {currentIndex < slides.length - 1 && (
          <TouchableOpacity
            style={styles.skipButton}
            onPress={handleGetStarted}
          >
            <Text style={styles.skipButtonText}>Passer</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    flexDirection: 'column',
  },
  slidesContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  bottomSection: {
    backgroundColor: '#fff',
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 20,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  slide: {
    width,
    height: height * 0.7,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  slideContent: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  largeEmoji: {
    fontSize: 120,
    marginBottom: 30,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 20,
  },
  description: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.9)',
    textAlign: 'center',
    lineHeight: 24,
    marginHorizontal: 10,
  },
  paginationContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 8,
  },
  paginationDot: {
    height: 10,
    borderRadius: 5,
    marginHorizontal: 4,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
    marginVertical: 10,
  },
  button: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  prevButton: {
    backgroundColor: '#e8e8e8',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  nextButton: {
    backgroundColor: '#4CAF50',
  },
  buttonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  startButton: {
    flex: 1,
    backgroundColor: '#4CAF50',
  },
  startButtonText: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#fff',
  },
  skipButton: {
    alignSelf: 'center',
    paddingVertical: 8,
    paddingHorizontal: 20,
    marginVertical: 5,
  },
  skipButtonText: {
    fontSize: 13,
    color: '#999',
    fontWeight: '500',
  },
});
