import { Tabs } from 'expo-router';
import { Heart, Activity, MessageCircle, User } from 'lucide-react-native';
 
export default function TabLayout() {
  return (
<Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#10B981',
        tabBarInactiveTintColor: '#9CA3AF',
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          borderTopWidth: 1,
          borderTopColor: '#E5E7EB',
          height: 65,
          paddingBottom: 10,
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '600',
        },
      }}>
<Tabs.Screen
        name="index"
        options={{
          title: 'Mood',
          tabBarIcon: ({ size, color }) => (
<Heart size={size} color={color} />
          ),
        }}
      />
<Tabs.Screen
        name="insights"
        options={{
          title: 'Insights',
          tabBarIcon: ({ size, color }) => (
<Activity size={size} color={color} />
          ),
        }}
      />
<Tabs.Screen
        name="chat"
        options={{
          title: 'Chat',
          tabBarIcon: ({ size, color }) => (
<MessageCircle size={size} color={color} />
          ),
        }}
      />
<Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ size, color }) => (
<User size={size} color={color} />
          ),
        }}
      />
</Tabs>
  );
}