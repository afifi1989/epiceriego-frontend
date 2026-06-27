import { ErrorBoundaryProps } from 'expo-router';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

/**
 * Fallback de route Expo Router.
 *
 * Expo Router enveloppe automatiquement CHAQUE écran qui exporte un
 * `ErrorBoundary` dans un boundary React, rendu À L'INTÉRIEUR du navigateur :
 * une erreur de rendu d'un écran (ex. `item.orderId.toString()` sur un
 * `orderId` undefined dans un keyExtractor) n'éjecte plus que cet écran vers
 * ce fallback — la barre d'onglets et la navigation restent en place, et
 * l'application ne se ferme pas. `retry()` (fourni par Expo Router) re-monte
 * l'écran proprement.
 *
 * Chaque écran fait : `export { XxxErrorBoundary as ErrorBoundary } from
 * '@/src/components/errorBoundaries';` selon son rôle (couleur d'accent).
 */
function RouteErrorFallback({
  error,
  retry,
  accentColor,
}: ErrorBoundaryProps & { accentColor: string }) {
  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.icon}>😕</Text>
        <Text style={styles.title}>Une erreur est survenue</Text>
        <Text style={styles.subtitle}>
          Cet écran n'a pas pu s'afficher correctement. L'application reste
          active — vous pouvez réessayer ou revenir en arrière.
        </Text>
        {__DEV__ && error?.message ? (
          <Text style={styles.devDetail}>{error.message}</Text>
        ) : null}
        <TouchableOpacity
          style={[styles.button, { backgroundColor: accentColor }]}
          onPress={retry}
          accessibilityRole="button"
          accessibilityLabel="Réessayer"
        >
          <Text style={styles.buttonText}>Réessayer</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

/** Fallback écran client (accent vert). */
export function ClientErrorBoundary(props: ErrorBoundaryProps) {
  return <RouteErrorFallback {...props} accentColor="#4CAF50" />;
}

/** Fallback écran épicier (accent bleu). */
export function EpicierErrorBoundary(props: ErrorBoundaryProps) {
  return <RouteErrorFallback {...props} accentColor="#2196F3" />;
}

/** Fallback écran livreur (accent violet). */
export function LivreurErrorBoundary(props: ErrorBoundaryProps) {
  return <RouteErrorFallback {...props} accentColor="#9C27B0" />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingVertical: 40,
  },
  icon: {
    fontSize: 56,
    marginBottom: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  devDetail: {
    fontSize: 12,
    color: '#c62828',
    textAlign: 'center',
    marginBottom: 20,
    fontFamily: 'monospace',
  },
  button: {
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: 24,
  },
  buttonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
  },
});
