import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { signOut } from "firebase/auth";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
} from "firebase/firestore";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Animated,
  Easing,
  FlatList,
  Image,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useAuth } from "../../utils/ctx";
import { auth, db } from "../../utils/firebase";

interface Transaction {
  id: string;
  tipo: "envio" | "recepcion" | "recarga" | "pago";
  monto: number;
  destinatario?: string;
  remitente?: string;
  razon?: string;
  fecha: any;
  estado: "completado" | "pendiente" | "fallido";
}

export default function PerfilScreen() {
  const { user } = useAuth();
  const [balance, setBalance] = useState(0);
  const [userName, setUserName] = useState("");
  const [userPhone, setUserPhone] = useState("");
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [cardCount, setCardCount] = useState(1);

  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;

  // Load user data - memoized
  const loadUserData = useCallback(async () => {
    if (!user) {
      console.log("❌ No user authenticated");
      return;
    }
    try {
      console.log("🔍 Loading user data for:", user.uid);
      const userDoc = await getDoc(doc(db, "usuarios", user.uid));
      if (userDoc.exists()) {
        const data = userDoc.data();
        setBalance(typeof data.balance === "number" ? data.balance : 0);
        setUserName(
          data.nombre && data.apellido
            ? `${data.nombre} ${data.apellido}`
            : "Usuario"
        );
        setUserPhone(data.celular || "");
        setCardCount(data.tarjeta ? 1 : 0);
        console.log("✅ User data loaded:", {
          balance: data.balance,
          name: `${data.nombre} ${data.apellido}`,
        });
      }
    } catch (error) {
      console.error("❌ Error loading user data:", error);
      setBalance(0);
    }
  }, [user]);

  // Load transactions from Firestore - memoized
  const loadTransactions = useCallback(async () => {
    if (!user) {
      console.log("❌ No user for transactions");
      return;
    }
    try {
      console.log("🔍 Loading transactions for user:", user.uid);
      const transactionsRef = collection(
        db,
        "usuarios",
        user.uid,
        "transacciones"
      );
      console.log("📂 Collection path:", `usuarios/${user.uid}/transacciones`);

      const q = query(transactionsRef, orderBy("fecha", "desc"), limit(20));
      const querySnapshot = await getDocs(q);

      console.log("📊 Documents found:", querySnapshot.size);

      const loadedTransactions: Transaction[] = [];
      querySnapshot.forEach((docSnap) => {
        const data = docSnap.data();
        console.log("📄 Transaction:", docSnap.id, data);
        loadedTransactions.push({ id: docSnap.id, ...data } as Transaction);
      });

      setTransactions(loadedTransactions);
      console.log("✅ Transactions loaded:", loadedTransactions.length);
    } catch (error) {
      console.error("❌ Error loading transactions:", error);
      setTransactions([]);
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Pull to refresh - memoized
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await Promise.all([loadUserData(), loadTransactions()]);
    setRefreshing(false);
  }, [loadUserData, loadTransactions]);

  // Initial load - runs only once when user changes
  useEffect(() => {
    let isMounted = true;

    const initialize = async () => {
      await loadUserData();
      await loadTransactions();

      // Animate in only if component is still mounted
      if (isMounted) {
        Animated.parallel([
          Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 600,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.spring(slideAnim, {
            toValue: 0,
            tension: 50,
            friction: 7,
            useNativeDriver: true,
          }),
        ]).start();
      }
    };

    if (user) {
      initialize();
    }

    return () => {
      isMounted = false;
    };
  }, [user]);

  // Real-time listener for balance updates
  useEffect(() => {
    if (!user) return;

    const unsubscribe = onSnapshot(
      doc(db, "usuarios", user.uid),
      (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          setBalance(typeof data.balance === "number" ? data.balance : 0);
          console.log("💰 Balance updated:", data.balance);
        }
      },
      (error) => {
        console.error("❌ Error listening to balance:", error);
      }
    );

    return () => unsubscribe();
  }, [user]);

  // Real-time listener for transactions updates
  useEffect(() => {
    if (!user) return;

    const transactionsRef = collection(
      db,
      "usuarios",
      user.uid,
      "transacciones"
    );
    const q = query(transactionsRef, orderBy("fecha", "desc"), limit(20));

    const unsubscribe = onSnapshot(
      q,
      (querySnapshot) => {
        const loadedTransactions: Transaction[] = [];
        querySnapshot.forEach((docSnap) => {
          loadedTransactions.push({
            id: docSnap.id,
            ...docSnap.data(),
          } as Transaction);
        });
        setTransactions(loadedTransactions);
        console.log(
          "🔄 Transactions updated in real-time:",
          loadedTransactions.length
        );
      },
      (error) => {
        console.error("❌ Error listening to transactions:", error);
      }
    );

    return () => unsubscribe();
  }, [user]);

  // Logout - memoized
  const logout = useCallback(async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert("Cerrar sesión", "¿Estás seguro?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Salir",
        onPress: async () => {
          try {
            await signOut(auth);
            router.replace("/login");
          } catch (e) {
            Alert.alert("Error", e instanceof Error ? e.message : "Error");
          }
        },
        style: "destructive",
      },
    ]);
  }, []);

  // Handle icon buttons
  const handleHelpPress = useCallback(async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    // No hace nada - solo visual
  }, []);

  const handleCallPress = useCallback(async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    // No hace nada - solo visual
  }, []);

  // Get transaction icon - memoized
  const getTransactionIcon = useCallback((tipo: string): string => {
    switch (tipo) {
      case "envio":
        return "arrow-up-circle";
      case "recepcion":
        return "arrow-down-circle";
      case "recarga":
        return "add-circle";
      case "pago":
        return "card";
      default:
        return "swap-horizontal";
    }
  }, []);

  // Get transaction color - memoized
  const getTransactionColor = useCallback((tipo: string): string => {
    switch (tipo) {
      case "envio":
      case "pago":
        return "#FF3B30";
      case "recepcion":
      case "recarga":
        return "#34C759";
      default:
        return "#bbb";
    }
  }, []);

  // Format date - memoized
  const formatDate = useCallback((timestamp: any): string => {
    if (!timestamp) return "";
    try {
      const date =
        timestamp.toDate instanceof Function
          ? timestamp.toDate()
          : new Date(timestamp);
      return new Intl.DateTimeFormat("es-ES", {
        month: "short",
        day: "numeric",
        year: "numeric",
      }).format(date);
    } catch {
      return "";
    }
  }, []);

  // Render skeleton loader - memoized
  const renderSkeleton = useMemo(
    () => (
      <View style={styles.skeletonContainer}>
        {[1, 2, 3].map((i) => (
          <View key={i} style={styles.skeletonItem}>
            <View style={styles.skeletonCircle} />
            <View style={styles.skeletonTextContainer}>
              <View style={styles.skeletonText} />
              <View style={[styles.skeletonText, { width: "60%" }]} />
            </View>
          </View>
        ))}
      </View>
    ),
    []
  );

  // Render empty state - memoized
  const renderEmptyState = useMemo(
    () => (
      <View style={styles.emptyContainer}>
        <Ionicons name="file-tray-outline" size={80} color="#777" />
        <Text style={styles.emptyTitle}>No hay transacciones</Text>
        <Text style={styles.emptySubtitle}>
          Realiza tu primera transferencia para ver el historial aquí
        </Text>
      </View>
    ),
    []
  );

  // Render transaction item - optimized
  const renderTransactionItem = useCallback(
    ({ item, index }: { item: Transaction; index: number }) => (
      <Animated.View
        style={[
          styles.transactionItem,
          {
            opacity: fadeAnim,
            transform: [
              {
                translateY: slideAnim.interpolate({
                  inputRange: [0, 50],
                  outputRange: [0, 50 + index * 10],
                }),
              },
            ],
          },
        ]}
      >
        <View
          style={[
            styles.transactionIcon,
            {
              backgroundColor: `${getTransactionColor(item.tipo)}15`,
            },
          ]}
        >
          <Ionicons
            name={getTransactionIcon(item.tipo) as any}
            size={24}
            color={getTransactionColor(item.tipo)}
          />
        </View>

        <View style={styles.transactionInfo}>
          <Text style={styles.transactionTitle}>
            {item.tipo === "envio" && `Enviado a ${item.destinatario}`}
            {item.tipo === "recepcion" &&
              `Recibido de ${item.remitente || "Usuario"}`}
            {item.tipo === "recarga" && "Recarga de saldo"}
            {item.tipo === "pago" && "Pago realizado"}
          </Text>
          <Text style={styles.transactionSubtitle}>
            {formatDate(item.fecha)}
            {item.razon ? ` • ${item.razon}` : ""}
          </Text>
        </View>

        <View style={styles.transactionRight}>
          <Text
            style={[
              styles.transactionAmount,
              { color: getTransactionColor(item.tipo) },
            ]}
          >
            {item.tipo === "envio" || item.tipo === "pago" ? "-" : "+"}$
            {Math.abs(item.monto).toFixed(2)}
          </Text>
          <View
            style={[
              styles.statusBadge,
              {
                backgroundColor:
                  item.estado === "completado"
                    ? "#1b5e20"
                    : item.estado === "pendiente"
                    ? "#e65100"
                    : "#b71c1c",
              },
            ]}
          >
            <Text
              style={[
                styles.statusText,
                {
                  color:
                    item.estado === "completado"
                      ? "#81c784"
                      : item.estado === "pendiente"
                      ? "#ffb74d"
                      : "#e57373",
                },
              ]}
            >
              {item.estado === "completado"
                ? "✓"
                : item.estado === "pendiente"
                ? "⏱"
                : "✗"}
            </Text>
          </View>
        </View>
      </Animated.View>
    ),
    [fadeAnim, slideAnim, getTransactionIcon, getTransactionColor, formatDate]
  );

  // List header component - memoized
  const ListHeaderComponent = useMemo(
    () => (
      <Animated.View
        style={{
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }],
        }}
      >
        {/* Header with Avatar */}
        <View style={styles.header}>
          <Image
            source={{
              uri: "https://cdn-icons-png.flaticon.com/512/4645/4645949.png",
            }}
            style={styles.avatar}
          />
          <View style={styles.headerText}>
            <Text style={styles.title}>{userName}</Text>
            <Text style={styles.email}>{user?.email}</Text>
            {userPhone ? <Text style={styles.phone}>{userPhone}</Text> : null}
          </View>
        </View>

        {/* Balance Card - Featured */}
        <View style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>Saldo Disponible</Text>
          <Text style={styles.balanceValue}>
            ${" "}
            {balance.toLocaleString("en-US", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </Text>
          <Text style={styles.balanceCurrency}>BTC</Text>
        </View>

        {/* Quick Stats */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <View style={styles.statIconContainer}>
              <Ionicons name="card-outline" size={24} color="#fff" />
            </View>
            <Text style={styles.statValue}>{cardCount}</Text>
            <Text style={styles.statLabel}>Tarjetas</Text>
          </View>

          <View style={styles.statCard}>
            <View style={styles.statIconContainer}>
              <Ionicons name="swap-horizontal" size={24} color="#fff" />
            </View>
            <Text style={styles.statValue}>{transactions.length}</Text>
            <Text style={styles.statLabel}>Movimientos</Text>
          </View>

          <View style={styles.statCard}>
            <View style={styles.statIconContainer}>
              <Ionicons name="checkmark-circle" size={24} color="#ffffffff" />
            </View>
            <Text style={styles.statValue}>
              {transactions.filter((t) => t.estado === "completado").length}
            </Text>
            <Text style={styles.statLabel}>Completados</Text>
          </View>
        </View>

        {/* Icon Buttons - Only Logout Works */}
        <View style={styles.iconButtonsRow}>
          <TouchableOpacity
            style={styles.iconButton}
            onPress={handleHelpPress}
          >
            <Ionicons name="help-circle-outline" size={28} color="#bbb" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.iconButton}
            onPress={handleCallPress}
          >
            <Ionicons name="call-outline" size={28} color="#bbb" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.iconButtonActive} onPress={logout}>
            <Ionicons name="log-out-outline" size={28} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* Section Title */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Actividad Reciente</Text>
          {transactions.length > 0 && (
            <TouchableOpacity>
              <Text style={styles.seeAllText}>Ver todo</Text>
            </TouchableOpacity>
          )}
        </View>
      </Animated.View>
    ),
    [
      fadeAnim,
      slideAnim,
      userName,
      user?.email,
      userPhone,
      balance,
      cardCount,
      transactions.length,
      handleHelpPress,
      handleCallPress,
      logout,
    ]
  );

  // NO List footer component (removed logout button)
  const ListFooterComponent = null;

  // List empty component
  const ListEmptyComponent = useMemo(
    () => (loading ? renderSkeleton : renderEmptyState),
    [loading, renderSkeleton, renderEmptyState]
  );

  // Key extractor - memoized
  const keyExtractor = useCallback((item: Transaction) => item.id, []);

  return (
    <View style={styles.container}>
      <FlatList
        data={transactions}
        keyExtractor={keyExtractor}
        renderItem={renderTransactionItem}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#fff"
            colors={["#000000ff"]}
          />
        }
        ListHeaderComponent={ListHeaderComponent}
        ListEmptyComponent={ListEmptyComponent}
        ListFooterComponent={ListFooterComponent}
        contentContainerStyle={styles.listContent}
        removeClippedSubviews={true}
        maxToRenderPerBatch={10}
        updateCellsBatchingPeriod={50}
        initialNumToRender={10}
        windowSize={10}
      />
    </View>
  );
}

/* STYLES */
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000000ff",
  },
  listContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 40,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 24,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    marginRight: 16,
    backgroundColor: "#333",
    borderWidth: 3,
    borderColor: "#1e1e1e",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontSize: 24,
    fontWeight: "800",
    color: "#fff",
    marginBottom: 4,
  },
  email: {
    fontSize: 14,
    color: "#ccc",
    marginBottom: 2,
  },
  phone: {
    fontSize: 13,
    color: "#bbb",
    marginTop: 2,
  },
  balanceCard: {
    backgroundColor: "#fff",
    borderRadius: 24,
    padding: 28,
    marginBottom: 24,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 10,
  },
  balanceLabel: {
    fontSize: 14,
    color: "#000",
    opacity: 0.7,
    marginBottom: 8,
    fontWeight: "500",
    letterSpacing: 0.5,
  },
  balanceValue: {
    fontSize: 48,
    fontWeight: "800",
    color: "#000",
    letterSpacing: -1,
  },
  balanceCurrency: {
    fontSize: 16,
    color: "#000",
    opacity: 0.6,
    marginTop: 4,
    fontWeight: "600",
  },
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    backgroundColor: "#1e1e1e",
    padding: 16,
    marginHorizontal: 4,
    borderRadius: 16,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 3,
  },
  statIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#2a2a2a",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  statValue: {
    fontSize: 22,
    fontWeight: "800",
    color: "#fff",
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: "#ccc",
    fontWeight: "500",
  },
  // ✨ NEW ICON BUTTONS ROW
  iconButtonsRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 32,
    gap: 20,
  },
  iconButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#1e1e1e",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 3,
  },
  iconButtonActive: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#9d0800ff",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000000ff",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 5,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  sectionTitle: {
    fontWeight: "700",
    fontSize: 18,
    color: "#fff",
  },
  seeAllText: {
    fontSize: 14,
    color: "#fff",
    fontWeight: "600",
  },
  transactionItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    backgroundColor: "#1e1e1e",
    borderRadius: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 2,
  },
  transactionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  transactionInfo: {
    flex: 1,
  },
  transactionTitle: {
    fontWeight: "600",
    fontSize: 15,
    color: "#fff",
    marginBottom: 4,
  },
  transactionSubtitle: {
    color: "#bbb",
    fontSize: 13,
  },
  transactionRight: {
    alignItems: "flex-end",
  },
  transactionAmount: {
    fontWeight: "700",
    fontSize: 16,
    marginBottom: 4,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  statusText: {
    fontSize: 12,
    fontWeight: "600",
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#ccc",
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: "#bbb",
    textAlign: "center",
    paddingHorizontal: 40,
  },
  skeletonContainer: {
    paddingVertical: 20,
  },
  skeletonItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    backgroundColor: "#1e1e1e",
    borderRadius: 16,
    marginBottom: 12,
  },
  skeletonCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#333",
    marginRight: 12,
  },
  skeletonTextContainer: {
    flex: 1,
  },
  skeletonText: {
    height: 12,
    backgroundColor: "#333",
    borderRadius: 6,
    marginBottom: 8,
  },
});
