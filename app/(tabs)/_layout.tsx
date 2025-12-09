import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { Redirect, Tabs } from "expo-router";
import { Platform, StyleSheet, Text, View } from "react-native";
import { useAuth } from "../../utils/ctx";


export default function TabsLayout() {
  const { user, isLoading } = useAuth();


  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#000" }}>
        <Text style={{ color: "#fff" }}>Cargando...</Text>
      </View>
    );
  }
  if (!user) return <Redirect href="/login" />;


  return (
    <Tabs
      screenOptions={{
        headerStyle: {
          backgroundColor: "#000",
          shadowColor: "transparent",
          elevation: 0,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: "#222",
        },
        headerTintColor: "#fff",
        headerTitleStyle: { fontWeight: "700", fontSize: 18 },
        headerShadowVisible: false,


        tabBarActiveTintColor: "#fff",
        tabBarInactiveTintColor: "#fefefeff",
        tabBarStyle: styles.tabBar,
        tabBarShowLabel: false,


        tabBarBackground: () => (
          <View style={styles.glassContainer}>
            <BlurView intensity={95} tint="dark" style={StyleSheet.absoluteFill} />
            <LinearGradient
              colors={['rgba(0, 0, 0, 1)', 'rgba(0, 0, 0, 1)']}
              start={{ x: 0.5, y: 0 }}
              end={{ x: 0.5, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
          </View>
        ),
      }}
    >
      <Tabs.Screen
        name="transacciones"
        options={{
          title: "Transactions",
          tabBarIcon: ({ color, focused }) => (
            <View style={styles.iconContainer}>
              {focused && <GlassOval />}
              <Ionicons name={focused ? "receipt" : "receipt-outline"} size={32} color={color} />
            </View>
          ),
        }}
        listeners={{ tabPress: () => Haptics.selectionAsync() }}
      />


      <Tabs.Screen
        name="index"
        options={{
          title: "Wallet",
          tabBarIcon: ({ color, focused }) => (
            <View style={styles.iconContainer}>
              {focused && <GlassOval />}
              <Ionicons name={focused ? "wallet" : "wallet-outline"} size={34} color={color} />
            </View>
          ),
        }}
        listeners={{ tabPress: () => Haptics.selectionAsync() }}
      />


      <Tabs.Screen
        name="perfil"
        options={{
          title: "Profile",
          tabBarIcon: ({ color, focused }) => (
            <View style={styles.iconContainer}>
              {focused && <GlassOval />}
              <Ionicons name={focused ? "person" : "person-outline"} size={32} color={color} />
            </View>
          ),
        }}
        listeners={{ tabPress: () => Haptics.selectionAsync() }}
      />
    </Tabs>
  );
}


const GlassOval = () => (
  <LinearGradient
    colors={['rgba(0, 0, 0, 1)', 'rgba(0, 0, 0, 1)']}
    start={{ x: 0, y: 0 }}
    end={{ x: 0, y: 1 }}
    style={styles.activeOval}
  />
);


const styles = StyleSheet.create({
  tabBar: {
    position: 'absolute',
    bottom: 5,  // ✅ CAMBIO: Era 20, ahora 5 (más abajo)
    left: 15,
    right: 15,
    height: Platform.OS === 'ios' ? 70 : 65,
    elevation: 0,
    borderTopWidth: 0,
    backgroundColor: 'transparent',
    borderRadius: 35,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
  },
  glassContainer: {
    flex: 1,
    borderRadius: 35,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
  },
  iconContainer: {
    alignItems: "center",
    justifyContent: "center",
    height: 70,
    width: 80,
    top: Platform.OS === 'ios' ? 25 : 15,
  },
  activeOval: {
    position: 'absolute',
    width: 100,
    height: 55,
    borderRadius: 30,
    borderWidth: 1.5,
    borderColor: "rgba(255, 255, 255, 0.15)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    transform: [{ translateY: -0.9 }],
  },
});
