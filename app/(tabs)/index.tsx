import { LinearGradient } from 'expo-linear-gradient';
import { Frown, Heart, Meh, Smile, TrendingUp } from 'lucide-react-native';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function MoodScreen() {
  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#10B981', '#059669']}
        style={styles.header}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}>
        <Text style={styles.greeting}>Good afternoon</Text>
        <Text style={styles.title}>How are you feeling?</Text>
        <View style={styles.streakContainer}>
          <TrendingUp size={16} color="#FFF" />
          <Text style={styles.streakText}>7 day streak</Text>
        </View>
      </LinearGradient>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Rate your mood</Text>
          <Text style={styles.cardSubtitle}>Quick daily check in</Text>

          <View style={styles.moodGrid}>
            <TouchableOpacity style={styles.moodButton}>
              <Smile size={32} color="#10B981" strokeWidth={2.5} />
              <Text style={styles.moodLabel}>Great</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.moodButton}>
              <Heart size={32} color="#3B82F6" strokeWidth={2.5} />
              <Text style={styles.moodLabel}>Good</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.moodButton}>
              <Meh size={32} color="#F59E0B" strokeWidth={2.5} />
              <Text style={styles.moodLabel}>Okay</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.moodButton}>
              <Frown size={32} color="#EF4444" strokeWidth={2.5} />
              <Text style={styles.moodLabel}>Low</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    paddingTop: 60,
    paddingHorizontal: 24,
    paddingBottom: 32,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  greeting: {
    fontSize: 16,
    color: '#FFFFFF',
    opacity: 0.9,
    marginBottom: 4,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 12,
  },
  streakContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff33',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    alignSelf: 'flex-start',
  },
  streakText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginTop: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  cardSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 20,
  },
  moodGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  moodButton: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: 16,
    padding: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F3F4F6',
  },
  moodLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
    marginTop: 8,
  },
});