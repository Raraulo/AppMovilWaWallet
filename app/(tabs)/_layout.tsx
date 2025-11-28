import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur"; // 🔥 IMPORTA ESTO
import * as Haptics from "expo-haptics";
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
        headerTitleStyle: {
          fontWeight: "700",
          fontSize: 18,
          letterSpacing: 0.5,
        },
        headerShadowVisible: false,

        tabBarActiveTintColor: "#fff",
        tabBarInactiveTintColor: "#555",
        tabBarStyle: styles.tabBar,
        tabBarShowLabel: false,

        // 🔥 AQUÍ ESTÁ EL LIQUID GLASS
        tabBarBackground: () => (
          <BlurView
            intensity={80} // Intensidad del blur (40-100)
            tint="dark" // Tono oscuro
            style={styles.blurContainer}
          >
            <View style={styles.tabBarBackground} />
          </BlurView>
        ),
      }}
    >
      <Tabs.Screen
        name="transacciones"
        options={{
          title: "Transactions",
          tabBarIcon: ({ color, focused }) => (
            <View style={styles.iconContainer}>
              {focused && <View style={styles.activeOval} />}
              <Ionicons
                name={focused ? "receipt" : "receipt-outline"}
                size={30}
                color={color}
              />
            </View>
          ),
        }}
        listeners={{
          tabPress: () => Haptics.selectionAsync(),
        }}
      />

      <Tabs.Screen
        name="index"
        options={{
          title: "Wallet",
          tabBarIcon: ({ color, focused }) => (
            <View style={styles.iconContainer}>
              {focused && <View style={styles.activeOval} />}
              <Ionicons
                name={focused ? "wallet" : "wallet-outline"}
                size={32}
                color={color}
              />
            </View>
          ),
        }}
        listeners={{
          tabPress: () => Haptics.selectionAsync(),
        }}
      />

      <Tabs.Screen
        name="perfil"
        options={{
          title: "Profile",
          tabBarIcon: ({ color, focused }) => (
            <View style={styles.iconContainer}>
              {focused && <View style={styles.activeOval} />}
              <Ionicons
                name={focused ? "person" : "person-outline"}
                size={30}
                color={color}
              />
            </View>
          ),
        }}
        listeners={{
          tabPress: () => Haptics.selectionAsync(),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
    elevation: 0,
    height: Platform.OS === 'ios' ? 70 : 65,
    borderTopWidth: 0,
    backgroundColor: 'transparent',
    borderRadius: 25,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    overflow: 'hidden', // 🔥 Importante para el blur
  },
  // 🔥 NUEVO: Contenedor del BlurView
  blurContainer: {
    flex: 1,
    borderRadius: 25,
    overflow: 'hidden',
  },
  tabBarBackground: {
    flex: 1,
    backgroundColor: "rgba(10, 10, 10, 0.6)", // 🔥 Más transparente para ver el blur
    borderRadius: 25,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)", // 🔥 Borde más visible
  },
  iconContainer: {
    alignItems: "center",
    justifyContent: "center",
    height: 84,
    width: 84,
    top: Platform.OS === 'ios' ? 1 : 13,
  },
  activeOval: {
    position: 'absolute',
    width: 104,
    height: 54,
    borderRadius: 27,
    backgroundColor: "rgba(255, 255, 255, 0.08)", // 🔥 Un poco de color
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.25)", // 🔥 Borde más visible
    shadowColor: "#fff",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
  },
});
