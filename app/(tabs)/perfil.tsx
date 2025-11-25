import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { signOut } from "firebase/auth";
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
} from "firebase/firestore";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Animated,
  Dimensions,
  Easing,
  Image,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Svg, { Circle, Defs, Line, Path, Stop, LinearGradient as SvgLinearGradient, Text as SvgText } from "react-native-svg";
import { useAuth } from "../../utils/ctx";
import { auth, db } from "../../utils/firebase";

const { width } = Dimensions.get("window");

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

interface DayData {
  date: string;
  gastos: number;
  ingresos: number;
  transacciones: number;
}

// 🎨 CUSTOM LINE CHART COMPONENT
const CustomLineChart = ({ data, width, height }: { data: DayData[]; width: number; height: number }) => {
  const padding = { top: 20, bottom: 30, left: 10, right: 10 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  // Calcular valores máximo y mínimo
  const values = data.map(d => d.gastos);
  const maxValue = Math.max(...values, 10);
  const minValue = 0;

  // Crear puntos del gráfico
  const points = data.map((d, index) => {
    const x = padding.left + (index / (data.length - 1)) * chartWidth;
    const y = padding.top + chartHeight - ((d.gastos - minValue) / (maxValue - minValue)) * chartHeight;
    return { x, y, value: d.gastos, date: d.date };
  });

  // Crear path para la línea con curvas suaves (Bezier)
  const createSmoothPath = () => {
    if (points.length === 0) return "";

    let path = `M ${points[0].x} ${points[0].y}`;

    for (let i = 0; i < points.length - 1; i++) {
      const current = points[i];
      const next = points[i + 1];
      const controlX = (current.x + next.x) / 2;

      path += ` Q ${controlX} ${current.y}, ${(current.x + next.x) / 2} ${(current.y + next.y) / 2}`;
      path += ` Q ${controlX} ${next.y}, ${next.x} ${next.y}`;
    }

    return path;
  };

  // Crear área de relleno
  const createAreaPath = () => {
    const linePath = createSmoothPath();
    const bottomY = padding.top + chartHeight;
    return `${linePath} L ${points[points.length - 1].x} ${bottomY} L ${points[0].x} ${bottomY} Z`;
  };

  const hasData = values.some(v => v > 0);

  if (!hasData) {
    return (
      <View style={{ width, height, justifyContent: 'center', alignItems: 'center' }}>
        <Ionicons name="analytics-outline" size={64} color="#333" />
        <Text style={{ fontSize: 16, fontWeight: '700', color: '#666', marginTop: 16 }}>
          Sin datos de gastos
        </Text>
        <Text style={{ fontSize: 13, color: "#444", marginTop: 8, textAlign: 'center' }}>
          Realiza transacciones para ver estadísticas
        </Text>
      </View>
    );
  }

  return (
    <Svg width={width} height={height}>
      <Defs>
        <SvgLinearGradient id="gradient" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0%" stopColor="#ff4757" stopOpacity="0.3" />
          <Stop offset="100%" stopColor="#ff4757" stopOpacity="0.05" />
        </SvgLinearGradient>
      </Defs>

      {/* Grid lines horizontales */}
      {[0, 0.25, 0.5, 0.75, 1].map((ratio, index) => {
        const y = padding.top + chartHeight * ratio;
        return (
          <Line
            key={`grid-${index}`}
            x1={padding.left}
            y1={y}
            x2={padding.left + chartWidth}
            y2={y}
            stroke="#222"
            strokeWidth="1"
            strokeDasharray="4,4"
          />
        );
      })}

      {/* Área de relleno con gradiente */}
      <Path
        d={createAreaPath()}
        fill="url(#gradient)"
      />

      {/* Línea principal */}
      <Path
        d={createSmoothPath()}
        stroke="#ff4757"
        strokeWidth="3"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Puntos en la línea */}
      {points.map((point, index) => {
        if (point.value === 0) return null;
        const isMax = point.value === Math.max(...values);

        return (
          <React.Fragment key={`point-${index}`}>
            <Circle
              cx={point.x}
              cy={point.y}
              r={isMax ? 8 : 6}
              fill="#1a1a1a"
              stroke="#ff4757"
              strokeWidth={isMax ? 3 : 2}
            />
            {isMax && (
              <Circle
                cx={point.x}
                cy={point.y}
                r={3}
                fill="#ff4757"
              />
            )}
          </React.Fragment>
        );
      })}

      {/* Labels del eje X (días) */}
      {points.map((point, index) => {
        if (index % 2 !== 0 && data.length > 7) return null;

        const day = new Date(point.date).getDate();
        return (
          <SvgText
            key={`label-${index}`}
            x={point.x}
            y={height - 10}
            fontSize="11"
            fill="#666"
            textAnchor="middle"
            fontWeight="600"
          >
            {day}
          </SvgText>
        );
      })}
    </Svg>
  );
};

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
  const chartAnim = useRef(new Animated.Value(0)).current;

  // Load user data
  const loadUserData = useCallback(async () => {
    if (!user) return;
    try {
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
      }
    } catch (error) {
      console.error("Error loading user:", error);
      setBalance(0);
    }
  }, [user]);

  // Pull to refresh
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await loadUserData();
    setRefreshing(false);
  }, [loadUserData]);

  // Initial animations
  useEffect(() => {
    let isMounted = true;

    const initialize = async () => {
      await loadUserData();

      if (isMounted) {
        Animated.parallel([
          Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 800,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.spring(slideAnim, {
            toValue: 0,
            tension: 40,
            friction: 8,
            useNativeDriver: true,
          }),
          Animated.timing(chartAnim, {
            toValue: 1,
            duration: 1200,
            delay: 400,
            easing: Easing.out(Easing.cubic),
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

  // Real-time balance listener
  useEffect(() => {
    if (!user) return;

    const unsubscribe = onSnapshot(
      doc(db, "usuarios", user.uid),
      (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          setBalance(typeof data.balance === "number" ? data.balance : 0);
        }
      }
    );

    return () => unsubscribe();
  }, [user]);

  // Real-time transactions listener
  useEffect(() => {
    if (!user) return;

    const transactionsRef = collection(
      db,
      "usuarios",
      user.uid,
      "transacciones"
    );
    const q = query(transactionsRef, orderBy("fecha", "desc"));

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const loadedTransactions: Transaction[] = [];
      querySnapshot.forEach((docSnap) => {
        loadedTransactions.push({
          id: docSnap.id,
          ...docSnap.data(),
        } as Transaction);
      });
      setTransactions(loadedTransactions);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  // Logout
  const logout = useCallback(async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
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

  // Process chart data - últimos 10 días
  const chartData = useMemo(() => {
    const last10Days: DayData[] = [];
    const today = new Date();

    for (let i = 9; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split("T")[0];

      last10Days.push({
        date: dateStr,
        gastos: 0,
        ingresos: 0,
        transacciones: 0,
      });
    }

    transactions.forEach((t) => {
      if (!t.fecha || t.estado !== "completado") return;

      try {
        const transDate =
          t.fecha.toDate instanceof Function
            ? t.fecha.toDate()
            : new Date(t.fecha);
        const dateStr = transDate.toISOString().split("T")[0];

        const dayData = last10Days.find((d) => d.date === dateStr);
        if (dayData) {
          dayData.transacciones++;
          if (t.tipo === "envio" || t.tipo === "pago") {
            dayData.gastos += t.monto;
          } else if (t.tipo === "recepcion" || t.tipo === "recarga") {
            dayData.ingresos += t.monto;
          }
        }
      } catch (e) {
        console.error("Error processing transaction date:", e);
      }
    });

    return last10Days;
  }, [transactions]);

  // Analytics
  const analytics = useMemo(() => {
    const totalGastos = chartData.reduce((sum, d) => sum + d.gastos, 0);
    const totalIngresos = chartData.reduce((sum, d) => sum + d.ingresos, 0);
    const promedioGastos = totalGastos / chartData.length;

    const dayWithMaxSpending = chartData.reduce(
      (max, day) => (day.gastos > max.gastos ? day : max),
      chartData[0]
    );

    const diasConGastos = chartData.filter((d) => d.gastos > 0).length;

    return {
      totalGastos,
      totalIngresos,
      promedioGastos,
      maxDay: dayWithMaxSpending,
      diasActivos: diasConGastos,
      netChange: totalIngresos - totalGastos,
    };
  }, [chartData]);

  return (
    <>
      <StatusBar barStyle="light-content" />
      <LinearGradient
        colors={["#000000", "#0a0a0a", "#000000"]}
        style={styles.container}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#fff"
            />
          }
          contentContainerStyle={styles.scrollContent}
        >
          {/* Header Profile */}
          <Animated.View
            style={[
              styles.profileSection,
              {
                opacity: fadeAnim,
                transform: [{ translateY: slideAnim }],
              },
            ]}
          >
            <View style={styles.profileHeader}>
              <View style={styles.avatarContainer}>
                <Image
                  source={{
                    uri: "https://cdn-icons-png.flaticon.com/512/4645/4645949.png",
                  }}
                  style={styles.avatar}
                />
                <View style={styles.statusDot} />
              </View>
              <View style={styles.profileInfo}>
                <Text style={styles.userName}>{userName}</Text>
                <Text style={styles.userEmail}>{user?.email}</Text>
                {userPhone ? (
                  <Text style={styles.userPhone}>{userPhone}</Text>
                ) : null}
              </View>
              <TouchableOpacity style={styles.logoutBtn} onPress={logout}>
                <Ionicons name="power" size={24} color="#ff4757" />
              </TouchableOpacity>
            </View>
          </Animated.View>

          {/* Balance Card */}
          <Animated.View
            style={[
              styles.balanceCard,
              {
                opacity: fadeAnim,
                transform: [
                  {
                    scale: fadeAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.95, 1],
                    }),
                  },
                ],
              },
            ]}
          >
            <LinearGradient
              colors={["#ffffff", "#f0f0f0"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.balanceGradient}
            >
              <View style={styles.balanceHeader}>
                <Text style={styles.balanceLabel}>Balance Disponible</Text>
                <View style={styles.cardBadge}>
                  <Ionicons name="shield-checkmark" size={16} color="#2ecc71" />
                  <Text style={styles.cardBadgeText}>Verificado</Text>
                </View>
              </View>

              <Text style={styles.balanceAmount}>
                ${balance.toLocaleString("en-US", { minimumFractionDigits: 2 })}
              </Text>

              <View style={styles.balanceFooter}>
                <View style={styles.balanceChange}>
                  <Ionicons
                    name={
                      analytics.netChange >= 0
                        ? "trending-up"
                        : "trending-down"
                    }
                    size={20}
                    color={analytics.netChange >= 0 ? "#2ecc71" : "#ff4757"}
                  />
                  <Text
                    style={[
                      styles.balanceChangeText,
                      {
                        color:
                          analytics.netChange >= 0 ? "#2ecc71" : "#ff4757",
                      },
                    ]}
                  >
                    ${Math.abs(analytics.netChange).toFixed(2)}
                  </Text>
                  <Text style={styles.balanceChangePeriod}>últimos 10 días</Text>
                </View>
              </View>
            </LinearGradient>
          </Animated.View>

          {/* Analytics Cards Grid */}
          <Animated.View
            style={[
              styles.analyticsGrid,
              {
                opacity: fadeAnim,
                transform: [{ translateY: slideAnim }],
              },
            ]}
          >
            <View style={styles.analyticsCard}>
              <View style={styles.analyticsIconContainer}>
                <Ionicons name="arrow-up-circle" size={28} color="#ff4757" />
              </View>
              <Text style={styles.analyticsValue}>
                ${analytics.totalGastos.toFixed(2)}
              </Text>
              <Text style={styles.analyticsLabel}>Total Gastado</Text>
              <Text style={styles.analyticsSubtext}>10 días</Text>
            </View>

            <View style={styles.analyticsCard}>
              <View style={styles.analyticsIconContainer}>
                <Ionicons name="calendar" size={28} color="#ffa502" />
              </View>
              <Text style={styles.analyticsValue}>
                ${analytics.promedioGastos.toFixed(2)}
              </Text>
              <Text style={styles.analyticsLabel}>Promedio Diario</Text>
              <Text style={styles.analyticsSubtext}>
                {analytics.diasActivos} días activos
              </Text>
            </View>

            <View style={styles.analyticsCard}>
              <View style={styles.analyticsIconContainer}>
                <Ionicons name="flame" size={28} color="#ff6348" />
              </View>
              <Text style={styles.analyticsValue}>
                ${analytics.maxDay.gastos.toFixed(2)}
              </Text>
              <Text style={styles.analyticsLabel}>Día Mayor</Text>
              <Text style={styles.analyticsSubtext}>
                {new Date(analytics.maxDay.date).toLocaleDateString("es-ES", {
                  day: "numeric",
                  month: "short",
                })}
              </Text>
            </View>

            <View style={styles.analyticsCard}>
              <View style={styles.analyticsIconContainer}>
                <Ionicons name="arrow-down-circle" size={28} color="#2ecc71" />
              </View>
              <Text style={styles.analyticsValue}>
                ${analytics.totalIngresos.toFixed(2)}
              </Text>
              <Text style={styles.analyticsLabel}>Total Recibido</Text>
              <Text style={styles.analyticsSubtext}>10 días</Text>
            </View>
          </Animated.View>

          {/* Custom Spending Chart */}
          <Animated.View
            style={[
              styles.chartSection,
              {
                opacity: chartAnim,
                transform: [
                  {
                    translateY: chartAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [30, 0],
                    }),
                  },
                ],
              },
            ]}
          >
            <View style={styles.chartHeader}>
              <View>
                <Text style={styles.chartTitle}>Análisis de Gastos</Text>
                <Text style={styles.chartSubtitle}>
                  Últimos 10 días de actividad
                </Text>
              </View>
              <TouchableOpacity style={styles.chartFilterBtn}>
                <Ionicons name="analytics" size={20} color="#fff" />
              </TouchableOpacity>
            </View>

            <View style={styles.chartContainer}>
              <CustomLineChart
                data={chartData}
                width={width - 80}
                height={240}
              />
            </View>
          </Animated.View>

          {/* Quick Stats Summary */}
          <Animated.View
            style={[
              styles.statsSection,
              {
                opacity: fadeAnim,
              },
            ]}
          >
            <View style={styles.statRow}>
              <View style={styles.statItem}>
                <Ionicons name="card" size={20} color="#666" />
                <Text style={styles.statItemLabel}>Tarjetas</Text>
                <Text style={styles.statItemValue}>{cardCount}</Text>
              </View>

              <View style={styles.statDivider} />

              <View style={styles.statItem}>
                <Ionicons name="repeat" size={20} color="#666" />
                <Text style={styles.statItemLabel}>Transacciones</Text>
                <Text style={styles.statItemValue}>{transactions.length}</Text>
              </View>

              <View style={styles.statDivider} />

              <View style={styles.statItem}>
                <Ionicons name="checkmark-circle" size={20} color="#666" />
                <Text style={styles.statItemLabel}>Completadas</Text>
                <Text style={styles.statItemValue}>
                  {
                    transactions.filter((t) => t.estado === "completado")
                      .length
                  }
                </Text>
              </View>
            </View>
          </Animated.View>
        </ScrollView>
      </LinearGradient>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 30, // ⬆️ MÁS ARRIBA (era 60)
    paddingHorizontal: 20,
    paddingBottom: 120, // ⚠️ Espacio para navbar flotante
  },
  profileSection: {
    marginBottom: 20, // ⬆️ Reducido (era 24)
  },
  profileHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  avatarContainer: {
    position: "relative",
    marginRight: 16,
  },
  avatar: {
    width: 70,
    height: 70,
    borderRadius: 35,
    borderWidth: 3,
    borderColor: "#1a1a1a",
  },
  statusDot: {
    position: "absolute",
    bottom: 2,
    right: 2,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "#2ecc71",
    borderWidth: 3,
    borderColor: "#000",
  },
  profileInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 22,
    fontWeight: "800",
    color: "#fff",
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 13,
    color: "#999",
    marginBottom: 2,
  },
  userPhone: {
    fontSize: 12,
    color: "#666",
  },
  logoutBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#1a1a1a",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#222",
  },
  balanceCard: {
    marginBottom: 20, // ⬆️ Reducido (era 24)
    borderRadius: 24,
    overflow: "hidden",
  },
  balanceGradient: {
    padding: 24,
  },
  balanceHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  balanceLabel: {
    fontSize: 14,
    color: "#666",
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  cardBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#e8f8f0",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  cardBadgeText: {
    fontSize: 11,
    color: "#2ecc71",
    fontWeight: "700",
    marginLeft: 4,
  },
  balanceAmount: {
    fontSize: 48,
    fontWeight: "900",
    color: "#000",
    letterSpacing: -2,
    marginBottom: 16,
  },
  balanceFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  balanceChange: {
    flexDirection: "row",
    alignItems: "center",
  },
  balanceChangeText: {
    fontSize: 18,
    fontWeight: "700",
    marginLeft: 6,
  },
  balanceChangePeriod: {
    fontSize: 13,
    color: "#999",
    marginLeft: 8,
    fontWeight: "500",
  },
  analyticsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginBottom: 20, // ⬆️ Reducido (era 24)
    gap: 12,
  },
  analyticsCard: {
    width: (width - 52) / 2,
    backgroundColor: "#1a1a1a",
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: "#222",
  },
  analyticsIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#0a0a0a",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  analyticsValue: {
    fontSize: 24,
    fontWeight: "800",
    color: "#fff",
    marginBottom: 4,
  },
  analyticsLabel: {
    fontSize: 13,
    color: "#999",
    fontWeight: "600",
    marginBottom: 4,
  },
  analyticsSubtext: {
    fontSize: 11,
    color: "#666",
    fontWeight: "500",
  },
  chartSection: {
    backgroundColor: "#1a1a1a",
    borderRadius: 24,
    padding: 20,
    marginBottom: 20, // ⬆️ Reducido (era 24)
    borderWidth: 1,
    borderColor: "#222",
  },
  chartHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 24,
  },
  chartTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#fff",
    marginBottom: 4,
  },
  chartSubtitle: {
    fontSize: 13,
    color: "#666",
    fontWeight: "500",
  },
  chartFilterBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#0a0a0a",
    justifyContent: "center",
    alignItems: "center",
  },
  chartContainer: {
    alignItems: "center",
  },
  statsSection: {
    backgroundColor: "#1a1a1a",
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: "#222",
    marginBottom: 20, // ⬆️ Espacio extra para navbar
  },
  statRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  statItem: {
    flex: 1,
    alignItems: "center",
  },
  statItemLabel: {
    fontSize: 11,
    color: "#666",
    fontWeight: "600",
    marginTop: 8,
    marginBottom: 4,
  },
  statItemValue: {
    fontSize: 20,
    fontWeight: "800",
    color: "#fff",
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: "#222",
  },
});
