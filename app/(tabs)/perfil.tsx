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
  Modal,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Svg, {
  Circle,
  Defs,
  Line,
  Path,
  Stop,
  LinearGradient as SvgLinearGradient,
  Text as SvgText,
} from "react-native-svg";
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
const CustomLineChart = ({
  data,
  width,
  height,
}: {
  data: DayData[];
  width: number;
  height: number;
}) => {
  const padding = { top: 20, bottom: 30, left: 10, right: 10 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  const values = data.map((d) => d.gastos);
  const maxValue = Math.max(...values, 10);
  const minValue = 0;

  const points = data.map((d, index) => {
    const x = padding.left + (index / (data.length - 1)) * chartWidth;
    const y =
      padding.top +
      chartHeight -
      ((d.gastos - minValue) / (maxValue - minValue)) * chartHeight;
    return { x, y, value: d.gastos, date: d.date };
  });

  const createSmoothPath = () => {
    if (points.length === 0) return "";

    let path = `M ${points[0].x} ${points[0].y}`;

    for (let i = 0; i < points.length - 1; i++) {
      const current = points[i];
      const next = points[i + 1];
      const controlX = (current.x + next.x) / 2;

      path += ` Q ${controlX} ${current.y}, ${(current.x + next.x) / 2} ${(current.y + next.y) / 2
        }`;
      path += ` Q ${controlX} ${next.y}, ${next.x} ${next.y}`;
    }

    return path;
  };

  const createAreaPath = () => {
    const linePath = createSmoothPath();
    const bottomY = padding.top + chartHeight;
    return `${linePath} L ${points[points.length - 1].x} ${bottomY} L ${points[0].x
      } ${bottomY} Z`;
  };

  const hasData = values.some((v) => v > 0);

  if (!hasData) {
    return (
      <View
        style={{
          width,
          height,
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <Ionicons name="analytics-outline" size={64} color="#333" />
        <Text
          style={{
            fontSize: 16,
            fontWeight: "700",
            color: "#666",
            marginTop: 16,
          }}
        >
          Sin datos de gastos
        </Text>
        <Text
          style={{
            fontSize: 13,
            color: "#444",
            marginTop: 8,
            textAlign: "center",
          }}
        >
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
      <Path d={createAreaPath()} fill="url(#gradient)" />

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
              <Circle cx={point.x} cy={point.y} r={3} fill="#ff4757" />
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

// 🍩 DONUT CHART COMPONENT
const DonutChart = ({
  ingresos,
  gastos,
  size = 140,
}: {
  ingresos: number;
  gastos: number;
  size?: number;
}) => {
  const total = ingresos + gastos;
  const ingresosPercentage = total > 0 ? (ingresos / total) * 100 : 50;
  const gastosPercentage = total > 0 ? (gastos / total) * 100 : 50;

  const strokeWidth = 18;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  const ingresosLength = (ingresosPercentage / 100) * circumference;
  const gastosLength = (gastosPercentage / 100) * circumference;

  return (
    <View
      style={{
        width: size,
        height: size,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Svg width={size} height={size}>
        <Defs>
          <SvgLinearGradient id="ingresosGradient" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0%" stopColor="#34C759" stopOpacity="1" />
            <Stop offset="100%" stopColor="#2ecc71" stopOpacity="1" />
          </SvgLinearGradient>
          <SvgLinearGradient id="gastosGradient" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0%" stopColor="#ff4757" stopOpacity="1" />
            <Stop offset="100%" stopColor="#ff6348" stopOpacity="1" />
          </SvgLinearGradient>
        </Defs>

        {/* Background circle */}
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="#222"
          strokeWidth={strokeWidth}
          fill="none"
        />

        {/* Gastos segment */}
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="url(#gastosGradient)"
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={`${gastosLength} ${circumference}`}
          strokeDashoffset={0}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />

        {/* Ingresos segment */}
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="url(#ingresosGradient)"
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={`${ingresosLength} ${circumference}`}
          strokeDashoffset={-gastosLength}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>

      {/* Center text */}
      <View style={{ position: "absolute", alignItems: "center" }}>
        <Text
          style={{
            fontSize: 10,
            color: "#666",
            fontWeight: "600",
            marginBottom: 2,
          }}
        >
          Balance
        </Text>
        <Text
          style={{ fontSize: 18, fontWeight: "800", color: "#fff" }}
        >
          ${((ingresos - gastos) / 1).toFixed(0)}
        </Text>
      </View>
    </View>
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
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const chartAnim = useRef(new Animated.Value(0)).current;
  const logoutModalAnim = useRef(new Animated.Value(0)).current;
  const logoutModalScale = useRef(new Animated.Value(0.9)).current;

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

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await loadUserData();
    setRefreshing(false);
  }, [loadUserData]);

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

  useEffect(() => {
    if (!user) return;

    const unsubscribe = onSnapshot(doc(db, "usuarios", user.uid), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setBalance(typeof data.balance === "number" ? data.balance : 0);
      }
    });

    return () => unsubscribe();
  }, [user]);

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

  const logout = useCallback(async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setShowLogoutModal(true);
    logoutModalAnim.setValue(0);
    logoutModalScale.setValue(0.9);

    Animated.parallel([
      Animated.timing(logoutModalAnim, {
        toValue: 1,
        duration: 200,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(logoutModalScale, {
        toValue: 1,
        duration: 200,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const closeLogoutModal = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Animated.timing(logoutModalAnim, {
      toValue: 0,
      duration: 200,
      easing: Easing.in(Easing.ease),
      useNativeDriver: true,
    }).start(() => {
      setShowLogoutModal(false);
    });
  };

  const confirmLogout = async () => {
    try {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await signOut(auth);
      router.replace("/login");
    } catch (e) {
      Alert.alert("Error", e instanceof Error ? e.message : "Error");
    }
  };

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
          {/* ✨ HEADER PROFILE CON INICIALES - SIN IMAGEN URL NI ESTRELLA */}
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
              <View style={styles.profileInfo}>
                <View style={styles.nameContainer}>
                  <Text style={styles.userName}>{userName}</Text>
                  <Ionicons name="checkmark-circle" size={20} color="#34C759" />
                </View>
                <Text style={styles.userEmail}>{user?.email}</Text>
                {userPhone ? (
                  <View style={styles.phoneContainer}>
                    <Ionicons name="call" size={12} color="#666" />
                    <Text style={styles.userPhone}>{userPhone}</Text>
                  </View>
                ) : null}
              </View>
            </View>


          </Animated.View>

          {/* Quick Stats */}
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
                <Ionicons name="card" size={24} color="#ffa502" />
                <Text style={styles.statItemLabel}>Tarjetas</Text>
                <Text style={styles.statItemValue}>{cardCount}</Text>
              </View>

              <View style={styles.statDivider} />

              <View style={styles.statItem}>
                <Ionicons name="repeat" size={24} color="#5f27cd" />
                <Text style={styles.statItemLabel}>Transacciones</Text>
                <Text style={styles.statItemValue}>{transactions.length}</Text>
              </View>

              <View style={styles.statDivider} />

              <View style={styles.statItem}>
                <Ionicons name="checkmark-circle" size={24} color="#2ecc71" />
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

          {/* Financial Insights with Donut Chart */}
          <Animated.View
            style={[
              styles.insightsCard,
              {
                opacity: fadeAnim,
                transform: [{ translateY: slideAnim }],
              },
            ]}
          >
            <View style={styles.insightsHeader}>
              <View>
                <Text style={styles.insightsTitle}>Financial Overview</Text>
                <Text style={styles.insightsSubtitle}>Income vs Expenses</Text>
              </View>
              <View style={styles.insightsBadge}>
                <Ionicons name="trending-up" size={16} color="#34C759" />
                <Text style={styles.insightsBadgeText}>10 days</Text>
              </View>
            </View>

            <View style={styles.donutContainer}>
              <DonutChart
                ingresos={analytics.totalIngresos}
                gastos={analytics.totalGastos}
                size={160}
              />

              <View style={styles.donutLegend}>
                <View style={styles.legendItem}>
                  <View
                    style={[styles.legendDot, { backgroundColor: "#34C759" }]}
                  />
                  <View style={styles.legendInfo}>
                    <Text style={styles.legendLabel}>Income</Text>
                    <Text style={styles.legendValue}>
                      ${analytics.totalIngresos.toFixed(2)}
                    </Text>
                    <Text style={styles.legendPercentage}>
                      {analytics.totalIngresos + analytics.totalGastos > 0
                        ? (
                          (analytics.totalIngresos /
                            (analytics.totalIngresos +
                              analytics.totalGastos)) *
                          100
                        ).toFixed(1)
                        : "0"}
                      %
                    </Text>
                  </View>
                </View>

                <View style={styles.legendDivider} />

                <View style={styles.legendItem}>
                  <View
                    style={[styles.legendDot, { backgroundColor: "#ff4757" }]}
                  />
                  <View style={styles.legendInfo}>
                    <Text style={styles.legendLabel}>Expenses</Text>
                    <Text style={styles.legendValue}>
                      ${analytics.totalGastos.toFixed(2)}
                    </Text>
                    <Text style={styles.legendPercentage}>
                      {analytics.totalIngresos + analytics.totalGastos > 0
                        ? (
                          (analytics.totalGastos /
                            (analytics.totalIngresos +
                              analytics.totalGastos)) *
                          100
                        ).toFixed(1)
                        : "0"}
                      %
                    </Text>
                  </View>
                </View>
              </View>
            </View>

            {/* Weekly Activity Stats */}
            <View style={styles.weeklyStats}>
              <View style={styles.weeklyStatItem}>
                <Ionicons name="calendar-outline" size={18} color="#ffa502" />
                <Text style={styles.weeklyStatLabel}>Active Days</Text>
                <View style={styles.weeklyStatValueContainer}>
                  <Text style={styles.weeklyStatValue}>
                    {analytics.diasActivos}
                  </Text>
                  <Text style={styles.weeklyStatMax}>/10</Text>
                </View>
              </View>

              <View style={styles.weeklyStatDivider} />

              <View style={styles.weeklyStatItem}>
                <Ionicons name="pulse-outline" size={18} color="#5f27cd" />
                <Text style={styles.weeklyStatLabel}>Avg/Day</Text>
                <Text style={styles.weeklyStatValue}>
                  ${analytics.promedioGastos.toFixed(0)}
                </Text>
              </View>
            </View>
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
            {/* Total Gastado Card */}
            <View style={styles.analyticsCard}>
              <LinearGradient
                colors={["rgba(255, 71, 87, 0.15)", "rgba(255, 71, 87, 0.05)"]}
                style={styles.analyticsGradient}
              >
                <View style={styles.analyticsIconContainer}>
                  <Ionicons name="arrow-up-circle" size={28} color="#ff4757" />
                </View>
                <Text style={styles.analyticsValue}>
                  ${analytics.totalGastos.toFixed(2)}
                </Text>
                <Text style={styles.analyticsLabel}>Total Gastado</Text>
                <Text style={styles.analyticsSubtext}>10 días</Text>
              </LinearGradient>
            </View>

            {/* Promedio Diario Card */}
            <View style={styles.analyticsCard}>
              <LinearGradient
                colors={["rgba(255, 165, 2, 0.15)", "rgba(255, 165, 2, 0.05)"]}
                style={styles.analyticsGradient}
              >
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
              </LinearGradient>
            </View>

            {/* Día Mayor Card */}
            <View style={styles.analyticsCard}>
              <LinearGradient
                colors={["rgba(255, 99, 72, 0.15)", "rgba(255, 99, 72, 0.05)"]}
                style={styles.analyticsGradient}
              >
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
              </LinearGradient>
            </View>

            {/* Total Recibido Card */}
            <View style={styles.analyticsCard}>
              <LinearGradient
                colors={[
                  "rgba(46, 204, 113, 0.15)",
                  "rgba(46, 204, 113, 0.05)",
                ]}
                style={styles.analyticsGradient}
              >
                <View style={styles.analyticsIconContainer}>
                  <Ionicons
                    name="arrow-down-circle"
                    size={28}
                    color="#2ecc71"
                  />
                </View>
                <Text style={styles.analyticsValue}>
                  ${analytics.totalIngresos.toFixed(2)}
                </Text>
                <Text style={styles.analyticsLabel}>Total Recibido</Text>
                <Text style={styles.analyticsSubtext}>10 días</Text>
              </LinearGradient>
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

          {/* Logout Button */}
          <Animated.View
            style={[
              styles.logoutContainer,
              {
                opacity: fadeAnim,
              },
            ]}
          >
            <TouchableOpacity
              style={styles.logoutButton}
              onPress={logout}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={["#1a1a1a", "#0a0a0a"]}
                style={styles.logoutGradient}
              >
                <Ionicons name="power" size={28} color="#ff4757" />
              </LinearGradient>
            </TouchableOpacity>
          </Animated.View>
        </ScrollView>

        {/* Custom Logout Confirmation Modal */}
        <Modal
          visible={showLogoutModal}
          transparent
          animationType="none"
          onRequestClose={closeLogoutModal}
        >
          <Animated.View
            style={[
              styles.logoutModalOverlay,
              {
                opacity: logoutModalAnim,
              },
            ]}
          >
            <TouchableOpacity
              style={styles.logoutModalBackdrop}
              activeOpacity={1}
              onPress={closeLogoutModal}
            />

            <Animated.View
              style={[
                styles.logoutModalContainer,
                {
                  opacity: logoutModalAnim,
                  transform: [{ scale: logoutModalScale }],
                },
              ]}
            >
              <LinearGradient
                colors={["#1a1a1a", "#0a0a0a"]}
                style={styles.logoutModalContent}
              >
                {/* Icon */}
                <View style={styles.logoutModalIcon}>
                  <LinearGradient
                    colors={["#ff4757", "#ff6348"]}
                    style={styles.logoutModalIconGradient}
                  >
                    <Ionicons name="power" size={40} color="#fff" />
                  </LinearGradient>
                </View>

                {/* Title */}
                <Text style={styles.logoutModalTitle}>Cerrar Sesión</Text>

                {/* Message */}
                <Text style={styles.logoutModalMessage}>
                  ¿Estás seguro que deseas salir de tu cuenta?
                </Text>
                <Text style={styles.logoutModalSubmessage}>
                  Tendrás que volver a iniciar sesión para acceder
                </Text>

                {/* Buttons */}
                <View style={styles.logoutModalButtons}>
                  <TouchableOpacity
                    style={styles.logoutModalCancelBtn}
                    onPress={closeLogoutModal}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.logoutModalCancelText}>Cancelar</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.logoutModalConfirmBtn}
                    onPress={confirmLogout}
                    activeOpacity={0.8}
                  >
                    <LinearGradient
                      colors={["#ff4757", "#ff6348"]}
                      style={styles.logoutModalConfirmGradient}
                    >
                      <Text style={styles.logoutModalConfirmText}>
                        Cerrar Sesión
                      </Text>
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
              </LinearGradient>
            </Animated.View>
          </Animated.View>
        </Modal>
      </LinearGradient>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 30,
    paddingHorizontal: 20,
    paddingBottom: 120,
  },
  profileSection: {
    marginBottom: 20,
  },
  profileHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10, // Añade esto para espaciado
  },

  profileInfo: {
    flex: 1,
    paddingLeft: 20,
  },
  nameContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
    gap: 6,
  },
  userName: {
    fontSize: 22,
    fontWeight: "800",
    color: "#fff",
  },

  userEmail: {
    fontSize: 13,
    color: "#999",
    marginBottom: 4,
  },
  phoneContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  userPhone: {
    fontSize: 12,
    color: "#666",
  },
  statsSection: {
    backgroundColor: "#1a1a1a",
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: "#222",
    marginBottom: 20,
  },
  statRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  statItem: {
    flex: 1,
    alignItems: "center",
    gap: 8,
  },
  statItemLabel: {
    fontSize: 12,
    color: "#666",
    fontWeight: "600",
    marginTop: 4,
  },
  statItemValue: {
    fontSize: 24,
    fontWeight: "800",
    color: "#fff",
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: "#222",
  },
  insightsCard: {
    backgroundColor: "#1a1a1a",
    borderRadius: 24,
    padding: 24,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#222",
  },
  insightsHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 24,
  },
  insightsTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#fff",
    marginBottom: 4,
  },
  insightsSubtitle: {
    fontSize: 13,
    color: "#666",
    fontWeight: "500",
  },
  insightsBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(52, 199, 89, 0.1)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    gap: 4,
  },
  insightsBadgeText: {
    fontSize: 11,
    color: "#34C759",
    fontWeight: "700",
  },
  donutContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  donutLegend: {
    flex: 1,
    marginLeft: 20,
    gap: 16,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
  },
  legendDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 10,
  },
  legendInfo: {
    flex: 1,
  },
  legendLabel: {
    fontSize: 12,
    color: "#666",
    fontWeight: "600",
    marginBottom: 4,
  },
  legendValue: {
    fontSize: 18,
    fontWeight: "800",
    color: "#fff",
    marginBottom: 2,
  },
  legendPercentage: {
    fontSize: 11,
    color: "#999",
    fontWeight: "500",
  },
  legendDivider: {
    height: 1,
    backgroundColor: "#222",
    marginVertical: 4,
  },
  weeklyStats: {
    flexDirection: "row",
    backgroundColor: "#0a0a0a",
    borderRadius: 16,
    padding: 16,
    gap: 16,
  },
  weeklyStatItem: {
    flex: 1,
    alignItems: "center",
    gap: 6,
  },
  weeklyStatLabel: {
    fontSize: 11,
    color: "#666",
    fontWeight: "600",
  },
  weeklyStatValueContainer: {
    flexDirection: "row",
    alignItems: "baseline",
  },
  weeklyStatValue: {
    fontSize: 20,
    fontWeight: "800",
    color: "#fff",
  },
  weeklyStatMax: {
    fontSize: 14,
    fontWeight: "600",
    color: "#666",
    marginLeft: 2,
  },
  weeklyStatDivider: {
    width: 1,
    backgroundColor: "#222",
  },
  analyticsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginBottom: 20,
    gap: 12,
  },
  analyticsCard: {
    width: (width - 52) / 2,
    borderRadius: 20,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#222",
  },
  analyticsGradient: {
    padding: 20,
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
    marginBottom: 20,
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
  logoutContainer: {
    alignItems: "center",
    marginBottom: 40,
  },
  logoutButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#222",
  },
  logoutGradient: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  logoutModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.85)",
    justifyContent: "center",
    alignItems: "center",
  },
  logoutModalBackdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  logoutModalContainer: {
    width: width - 80,
    maxWidth: 340,
  },
  logoutModalContent: {
    borderRadius: 28,
    padding: 32,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#222",
  },
  logoutModalIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    marginBottom: 24,
    overflow: "hidden",
  },
  logoutModalIconGradient: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  logoutModalTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: "#fff",
    marginBottom: 12,
  },
  logoutModalMessage: {
    fontSize: 15,
    color: "#999",
    textAlign: "center",
    marginBottom: 8,
    lineHeight: 22,
  },
  logoutModalSubmessage: {
    fontSize: 13,
    color: "#666",
    textAlign: "center",
    marginBottom: 32,
    lineHeight: 20,
  },
  logoutModalButtons: {
    flexDirection: "row",
    gap: 12,
    width: "100%",
  },
  logoutModalCancelBtn: {
    flex: 1,
    backgroundColor: "#0a0a0a",
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#222",
  },
  logoutModalCancelText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#fff",
  },
  logoutModalConfirmBtn: {
    flex: 1,
    borderRadius: 16,
    overflow: "hidden",
  },
  logoutModalConfirmGradient: {
    paddingVertical: 16,
    alignItems: "center",
  },
  logoutModalConfirmText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#fff",
  },
});
