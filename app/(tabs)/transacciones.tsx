import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import {
  collection,
  doc,
  getDoc,
  limit,
  onSnapshot,
  orderBy,
  query,
} from "firebase/firestore";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  Modal,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useAuth } from "../../utils/ctx";
import { db } from "../../utils/firebase";

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

type FilterType = "all" | "income" | "expense";

export default function TransaccionesScreen() {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTransaction, setSelectedTransaction] =
    useState<Transaction | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [sharingPDF, setSharingPDF] = useState(false);
  const [activeFilter, setActiveFilter] = useState<FilterType>("all");

  // Cargar transacciones en tiempo real
  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    const transactionsRef = collection(
      db,
      "usuarios",
      user.uid,
      "transacciones"
    );
    const q = query(transactionsRef, orderBy("fecha", "desc"), limit(50));

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
        setLoading(false);
      },
      (error) => {
        console.error("❌ Error loading transactions:", error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user]);

  // Filtrar transacciones
  const filteredTransactions = useMemo(() => {
    if (activeFilter === "all") return transactions;

    if (activeFilter === "income") {
      return transactions.filter(
        (t) => t.tipo === "recepcion" || t.tipo === "recarga"
      );
    }

    if (activeFilter === "expense") {
      return transactions.filter((t) => t.tipo === "envio" || t.tipo === "pago");
    }

    return transactions;
  }, [transactions, activeFilter]);

  // Calcular totales
  const totals = useMemo(() => {
    const income = transactions
      .filter((t) => t.tipo === "recepcion" || t.tipo === "recarga")
      .reduce((sum, t) => sum + t.monto, 0);

    const expense = transactions
      .filter((t) => t.tipo === "envio" || t.tipo === "pago")
      .reduce((sum, t) => sum + t.monto, 0);

    return { income, expense, total: income - expense };
  }, [transactions]);

  // Cambiar filtro
  const handleFilterChange = async (filter: FilterType) => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setActiveFilter(filter);
  };

  // Abrir modal
  const openTransactionModal = async (transaction: Transaction) => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSelectedTransaction(transaction);
    setModalVisible(true);
  };

  // Cerrar modal
  const closeModal = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setModalVisible(false);
    setTimeout(() => setSelectedTransaction(null), 300);
  };

  // Compartir PDF
  const shareTransactionPDF = async () => {
    if (!selectedTransaction) return;

    try {
      setSharingPDF(true);
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      const isNegative =
        selectedTransaction.tipo === "envio" ||
        selectedTransaction.tipo === "pago";
      const color = getTransactionColor(selectedTransaction.tipo);

      let senderName = "Usuario";
      if (user) {
        try {
          const userDoc = await getDoc(doc(db, "usuarios", user.uid));
          if (userDoc.exists()) {
            const userData = userDoc.data();
            senderName =
              `${userData.nombre || ""} ${userData.apellido || ""}`.trim() ||
              "Usuario";
          }
        } catch (error) {
          console.error("Error obteniendo nombre del usuario:", error);
        }
      }

      let transactionFlow = "";
      if (selectedTransaction.tipo === "envio") {
        transactionFlow = `
          <div class="flow-item">
            <div class="flow-label">De:</div>
            <div class="flow-value">${senderName}</div>
          </div>
          <div class="flow-arrow">→</div>
          <div class="flow-item">
            <div class="flow-label">Para:</div>
            <div class="flow-value">${
              selectedTransaction.destinatario || "Destinatario"
            }</div>
          </div>
        `;
      } else if (selectedTransaction.tipo === "recepcion") {
        transactionFlow = `
          <div class="flow-item">
            <div class="flow-label">De:</div>
            <div class="flow-value">${
              selectedTransaction.remitente || "Remitente"
            }</div>
          </div>
          <div class="flow-arrow">→</div>
          <div class="flow-item">
            <div class="flow-label">Para:</div>
            <div class="flow-value">${senderName}</div>
          </div>
        `;
      } else if (selectedTransaction.tipo === "recarga") {
        transactionFlow = `
          <div class="flow-item">
            <div class="flow-label">Realizada por:</div>
            <div class="flow-value">${senderName}</div>
          </div>
        `;
      } else if (selectedTransaction.tipo === "pago") {
        transactionFlow = `
          <div class="flow-item">
            <div class="flow-label">De:</div>
            <div class="flow-value">${senderName}</div>
          </div>
          <div class="flow-arrow">→</div>
          <div class="flow-item">
            <div class="flow-label">Para:</div>
            <div class="flow-value">${
              selectedTransaction.destinatario || "Comercio"
            }</div>
          </div>
        `;
      }

      let formattedDate = "";
      let formattedTime = "";
      try {
        const date =
          selectedTransaction.fecha.toDate instanceof Function
            ? selectedTransaction.fecha.toDate()
            : new Date(selectedTransaction.fecha);

        formattedDate = new Intl.DateTimeFormat("es-ES", {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
        }).format(date);

        formattedTime = new Intl.DateTimeFormat("es-ES", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: false,
        }).format(date);
      } catch (error) {
        console.error("Error formateando fecha:", error);
        formattedDate = "Fecha no disponible";
        formattedTime = "Hora no disponible";
      }

      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 40px; background: #ffffff; color: #000; line-height: 1.6; }
            .header { text-align: center; margin-bottom: 40px; padding-bottom: 25px; border-bottom: 3px solid ${color}; }
            .company-name { font-size: 36px; font-weight: bold; color: #000; margin-bottom: 5px; letter-spacing: 1px; }
            .document-type { font-size: 14px; color: #666; text-transform: uppercase; letter-spacing: 2px; font-weight: 600; }
            .transaction-header { background: linear-gradient(135deg, ${color}15 0%, ${color}05 100%); padding: 30px; border-radius: 12px; margin-bottom: 30px; border-left: 5px solid ${color}; }
            .transaction-number { font-size: 12px; color: #666; margin-bottom: 15px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; }
            .amount-display { font-size: 52px; font-weight: bold; color: ${color}; margin-bottom: 10px; line-height: 1; }
            .transaction-description { font-size: 18px; color: #333; font-weight: 600; margin-bottom: 20px; }
            .transaction-flow { background: #ffffff; padding: 20px; border-radius: 8px; border: 1px solid #e0e0e0; display: flex; align-items: center; justify-content: center; gap: 20px; }
            .flow-item { text-align: center; }
            .flow-label { font-size: 12px; color: #666; font-weight: 600; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 1px; }
            .flow-value { font-size: 16px; color: #000; font-weight: 700; }
            .flow-arrow { font-size: 24px; color: ${color}; font-weight: bold; }
            .status-section { text-align: center; margin-bottom: 35px; }
            .status-badge { display: inline-block; padding: 10px 24px; border-radius: 25px; font-size: 14px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; background: ${
              selectedTransaction.estado === "completado"
                ? "#E8F5E9"
                : "#FFF3E0"
            }; color: ${
        selectedTransaction.estado === "completado" ? "#2E7D32" : "#F57C00"
      }; border: 2px solid ${
        selectedTransaction.estado === "completado" ? "#2E7D32" : "#F57C00"
      }; }
            .details-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 30px; }
            .detail-item { background: #f9f9f9; padding: 20px; border-radius: 10px; border-left: 4px solid ${color}; }
            .detail-label { font-size: 11px; color: #777; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px; font-weight: 700; }
            .detail-value { font-size: 15px; color: #000; font-weight: 600; word-wrap: break-word; }
            .full-width-detail { grid-column: 1 / -1; }
            .footer { margin-top: 50px; padding-top: 25px; border-top: 2px solid #e0e0e0; text-align: center; }
            .footer-title { font-size: 12px; color: #000; font-weight: 700; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 1px; }
            .footer-text { font-size: 11px; color: #666; margin-bottom: 5px; }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="company-name">WaWallet</div>
            <div class="document-type">Comprobante de Transacción</div>
          </div>
          <div class="transaction-header">
            <div class="transaction-number">Operación #${selectedTransaction.id
              .slice(0, 8)
              .toUpperCase()}</div>
            <div class="amount-display">${isNegative ? "- " : "+ "}$${Math.abs(
        selectedTransaction.monto
      ).toFixed(2)}</div>
            <div class="transaction-description">${getTransactionTitle(
              selectedTransaction
            )}</div>
            <div class="transaction-flow">${transactionFlow}</div>
          </div>
          <div class="status-section"><div class="status-badge">${
            selectedTransaction.estado.charAt(0).toUpperCase() +
            selectedTransaction.estado.slice(1)
          }</div></div>
          <div class="details-grid">
            <div class="detail-item"><div class="detail-label">Fecha</div><div class="detail-value">${formattedDate}</div></div>
            <div class="detail-item"><div class="detail-label">Hora</div><div class="detail-value">${formattedTime}</div></div>
          </div>
          <div class="footer">
            <div class="footer-title">WaWallet Inc.</div>
            <div class="footer-text">Documento oficial de transacción</div>
          </div>
        </body>
        </html>
      `;

      const { uri } = await Print.printToFileAsync({ html, base64: false });

      const isAvailable = await Sharing.isAvailableAsync();
      if (isAvailable) {
        await Sharing.shareAsync(uri, {
          mimeType: "application/pdf",
          dialogTitle: "Compartir Comprobante",
          UTI: "com.adobe.pdf",
        });
        await Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Success
        );
      } else {
        Alert.alert("Error", "No se puede compartir en este dispositivo");
      }
    } catch (error) {
      console.error("❌ Error al compartir PDF:", error);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("Error", "No se pudo generar el PDF");
    } finally {
      setSharingPDF(false);
    }
  };

  // Obtener icono
  const getTransactionIcon = (tipo: string): string => {
    switch (tipo) {
      case "envio":
        return "arrow-up-circle";
      case "recepcion":
        return "arrow-down-circle";
      case "recarga":
        return "wallet";
      case "pago":
        return "cart";
      default:
        return "swap-horizontal";
    }
  };

  // Obtener color
  const getTransactionColor = (tipo: string): string => {
    switch (tipo) {
      case "envio":
      case "pago":
        return "#ff4757";
      case "recepcion":
      case "recarga":
        return "#2ecc71";
      default:
        return "#666";
    }
  };

  // Obtener título
  const getTransactionTitle = (item: Transaction): string => {
    switch (item.tipo) {
      case "envio":
        return `Enviado a ${item.destinatario || "Usuario"}`;
      case "recepcion":
        return `Recibido de ${item.remitente || "Usuario"}`;
      case "recarga":
        return "Recarga de saldo";
      case "pago":
        return `Pago a ${item.destinatario || "Tienda"}`;
      default:
        return "Transacción";
    }
  };

  // Formatear fecha
  const formatDate = (timestamp: any): string => {
    if (!timestamp) return "";
    try {
      const date =
        timestamp.toDate instanceof Function
          ? timestamp.toDate()
          : new Date(timestamp);
      return new Intl.DateTimeFormat("es-ES", {
        month: "short",
        day: "numeric",
      }).format(date);
    } catch {
      return "";
    }
  };

  // Formatear fecha completa
  const formatFullDate = (timestamp: any): string => {
    if (!timestamp) return "";
    try {
      const date =
        timestamp.toDate instanceof Function
          ? timestamp.toDate()
          : new Date(timestamp);
      return new Intl.DateTimeFormat("es-ES", {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }).format(date);
    } catch {
      return "";
    }
  };

  // Renderizar item
  const renderTransaction = ({ item }: { item: Transaction }) => {
    const isNegative = item.tipo === "envio" || item.tipo === "pago";
    const color = getTransactionColor(item.tipo);

    return (
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={() => openTransactionModal(item)}
        style={styles.transactionItem}
      >
        <View style={[styles.iconContainer, { backgroundColor: `${color}15` }]}>
          <Ionicons
            name={getTransactionIcon(item.tipo) as any}
            size={24}
            color={color}
          />
        </View>

        <View style={styles.transactionInfo}>
          <Text style={styles.transactionTitle} numberOfLines={1}>
            {getTransactionTitle(item)}
          </Text>
          <Text style={styles.transactionDate}>{formatDate(item.fecha)}</Text>
        </View>

        <View style={styles.transactionRight}>
          <Text style={[styles.transactionAmount, { color }]}>
            {isNegative ? "-" : "+"}${Math.abs(item.monto).toFixed(2)}
          </Text>
          <Ionicons name="chevron-forward" size={20} color="#666" />
        </View>
      </TouchableOpacity>
    );
  };

  // Empty state
  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <View style={styles.emptyIconContainer}>
        <Ionicons name="receipt-outline" size={64} color="#333" />
      </View>
      <Text style={styles.emptyTitle}>No hay transacciones</Text>
      <Text style={styles.emptySubtitle}>
        {activeFilter === "income"
          ? "No tienes ingresos registrados aún"
          : activeFilter === "expense"
          ? "No tienes gastos registrados aún"
          : "Realiza tu primera transacción"}
      </Text>
    </View>
  );

  if (loading) {
    return (
      <LinearGradient
        colors={["#000000", "#0a0a0a"]}
        style={[styles.container, { justifyContent: "center" }]}
      >
        <ActivityIndicator size="large" color="#fff" />
        <Text style={styles.loadingText}>Cargando transacciones...</Text>
      </LinearGradient>
    );
  }

  return (
    <>
      <StatusBar barStyle="light-content" />
      <LinearGradient colors={["#000000", "#0a0a0a"]} style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Tus Transacciones</Text>
          <Text style={styles.headerSubtitle}>
            {filteredTransactions.length}{" "}
            {activeFilter === "all"
              ? "operaciones"
              : activeFilter === "income"
              ? "ingresos"
              : "gastos"}
          </Text>
        </View>

        {/* Filters */}
        <View style={styles.filtersContainer}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filtersScroll}
          >
            <TouchableOpacity
              style={[
                styles.filterChip,
                activeFilter === "all" && styles.filterChipActive,
              ]}
              onPress={() => handleFilterChange("all")}
            >
              <Ionicons
                name="apps"
                size={18}
                color={activeFilter === "all" ? "#000" : "#999"}
              />
              <Text
                style={[
                  styles.filterText,
                  activeFilter === "all" && styles.filterTextActive,
                ]}
              >
                Todas
              </Text>
              <View
                style={[
                  styles.filterBadge,
                  activeFilter === "all" && styles.filterBadgeActive,
                ]}
              >
                <Text
                  style={[
                    styles.filterBadgeText,
                    activeFilter === "all" && styles.filterBadgeTextActive,
                  ]}
                >
                  {transactions.length}
                </Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.filterChip,
                activeFilter === "income" && styles.filterChipActive,
              ]}
              onPress={() => handleFilterChange("income")}
            >
              <Ionicons
                name="trending-up"
                size={18}
                color={activeFilter === "income" ? "#000" : "#2ecc71"}
              />
              <Text
                style={[
                  styles.filterText,
                  activeFilter === "income" && styles.filterTextActive,
                ]}
              >
                Ingresos
              </Text>
              <View
                style={[
                  styles.filterBadge,
                  activeFilter === "income" && styles.filterBadgeActive,
                ]}
              >
                <Text
                  style={[
                    styles.filterBadgeText,
                    activeFilter === "income" && styles.filterBadgeTextActive,
                  ]}
                >
                  {
                    transactions.filter(
                      (t) => t.tipo === "recepcion" || t.tipo === "recarga"
                    ).length
                  }
                </Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.filterChip,
                activeFilter === "expense" && styles.filterChipActive,
              ]}
              onPress={() => handleFilterChange("expense")}
            >
              <Ionicons
                name="trending-down"
                size={18}
                color={activeFilter === "expense" ? "#000" : "#ff4757"}
              />
              <Text
                style={[
                  styles.filterText,
                  activeFilter === "expense" && styles.filterTextActive,
                ]}
              >
                Gastos
              </Text>
              <View
                style={[
                  styles.filterBadge,
                  activeFilter === "expense" && styles.filterBadgeActive,
                ]}
              >
                <Text
                  style={[
                    styles.filterBadgeText,
                    activeFilter === "expense" && styles.filterBadgeTextActive,
                  ]}
                >
                  {
                    transactions.filter(
                      (t) => t.tipo === "envio" || t.tipo === "pago"
                    ).length
                  }
                </Text>
              </View>
            </TouchableOpacity>
          </ScrollView>
        </View>

        {/* Summary Cards - EN UNA LÍNEA */}
        <View style={styles.summaryContainer}>
          <View style={styles.summaryCard}>
            <View style={styles.summaryRow}>
              <View style={styles.summaryItem}>
                <Ionicons name="arrow-down" size={18} color="#2ecc71" />
                <View style={styles.summaryTextContainer}>
                  <Text style={styles.summaryLabel}>Ingresos</Text>
                  <Text style={[styles.summaryValue, { color: "#2ecc71" }]}>
                    ${totals.income.toFixed(2)}
                  </Text>
                </View>
              </View>

              <View style={styles.summaryDivider} />

              <View style={styles.summaryItem}>
                <Ionicons name="arrow-up" size={18} color="#ff4757" />
                <View style={styles.summaryTextContainer}>
                  <Text style={styles.summaryLabel}>Gastos</Text>
                  <Text style={[styles.summaryValue, { color: "#ff4757" }]}>
                    ${totals.expense.toFixed(2)}
                  </Text>
                </View>
              </View>
            </View>
          </View>
        </View>

        {/* Lista */}
        <FlatList
          data={filteredTransactions}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          renderItem={renderTransaction}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={renderEmpty}
        />

        {/* MODAL */}
        <Modal
          visible={modalVisible}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={closeModal}
        >
          {selectedTransaction && (
            <View style={styles.modalContainer}>
              <View style={styles.modalHeader}>
                <TouchableOpacity
                  onPress={closeModal}
                  style={styles.closeButton}
                >
                  <Ionicons name="close" size={28} color="#000" />
                </TouchableOpacity>
                <Text style={styles.modalHeaderTitle}>Detalles</Text>
                <View style={{ width: 28 }} />
              </View>

              <ScrollView
                style={styles.modalContent}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 40 }}
              >
                <View style={styles.modalMainSection}>
                  <View
                    style={[
                      styles.modalIconLarge,
                      {
                        backgroundColor: `${getTransactionColor(
                          selectedTransaction.tipo
                        )}20`,
                      },
                    ]}
                  >
                    <Ionicons
                      name={
                        getTransactionIcon(selectedTransaction.tipo) as any
                      }
                      size={60}
                      color={getTransactionColor(selectedTransaction.tipo)}
                    />
                  </View>

                  <Text
                    style={[
                      styles.modalAmount,
                      {
                        color: getTransactionColor(selectedTransaction.tipo),
                      },
                    ]}
                  >
                    {selectedTransaction.tipo === "envio" ||
                    selectedTransaction.tipo === "pago"
                      ? "-"
                      : "+"}
                    ${Math.abs(selectedTransaction.monto).toFixed(2)}
                  </Text>

                  <Text style={styles.modalTitle}>
                    {getTransactionTitle(selectedTransaction)}
                  </Text>

                  <View
                    style={[
                      styles.statusBadgeLarge,
                      {
                        backgroundColor:
                          selectedTransaction.estado === "completado"
                            ? "#E8F5E9"
                            : "#FFF3E0",
                      },
                    ]}
                  >
                    <Ionicons
                      name={
                        selectedTransaction.estado === "completado"
                          ? "checkmark-circle"
                          : "time-outline"
                      }
                      size={18}
                      color={
                        selectedTransaction.estado === "completado"
                          ? "#2E7D32"
                          : "#F57C00"
                      }
                    />
                    <Text
                      style={[
                        styles.statusTextLarge,
                        {
                          color:
                            selectedTransaction.estado === "completado"
                              ? "#2E7D32"
                              : "#F57C00",
                        },
                      ]}
                    >
                      {selectedTransaction.estado.charAt(0).toUpperCase() +
                        selectedTransaction.estado.slice(1)}
                    </Text>
                  </View>
                </View>

                <View style={styles.detailsSection}>
                  <View style={styles.detailCard}>
                    <View style={styles.detailCardHeader}>
                      <Ionicons
                        name="calendar-outline"
                        size={22}
                        color="#000"
                      />
                      <Text style={styles.detailCardTitle}>Fecha</Text>
                    </View>
                    <Text style={styles.detailCardValue}>
                      {formatFullDate(selectedTransaction.fecha)}
                    </Text>
                  </View>

                  <View style={styles.detailCard}>
                    <View style={styles.detailCardHeader}>
                      <Ionicons name="list-outline" size={22} color="#000" />
                      <Text style={styles.detailCardTitle}>Tipo</Text>
                    </View>
                    <Text style={styles.detailCardValue}>
                      {selectedTransaction.tipo.charAt(0).toUpperCase() +
                        selectedTransaction.tipo.slice(1)}
                    </Text>
                  </View>

                  {(selectedTransaction.destinatario ||
                    selectedTransaction.remitente) && (
                    <View style={styles.detailCard}>
                      <View style={styles.detailCardHeader}>
                        <Ionicons
                          name="person-outline"
                          size={22}
                          color="#000"
                        />
                        <Text style={styles.detailCardTitle}>
                          {selectedTransaction.tipo === "envio" ||
                          selectedTransaction.tipo === "pago"
                            ? "Destinatario"
                            : "Remitente"}
                        </Text>
                      </View>
                      <Text style={styles.detailCardValue}>
                        {selectedTransaction.destinatario ||
                          selectedTransaction.remitente}
                      </Text>
                    </View>
                  )}

                  {selectedTransaction.razon && (
                    <View style={styles.detailCard}>
                      <View style={styles.detailCardHeader}>
                        <Ionicons
                          name="chatbubble-outline"
                          size={22}
                          color="#000"
                        />
                        <Text style={styles.detailCardTitle}>Concepto</Text>
                      </View>
                      <Text style={styles.detailCardValue}>
                        {selectedTransaction.razon}
                      </Text>
                    </View>
                  )}

                  <View style={styles.detailCard}>
                    <View style={styles.detailCardHeader}>
                      <Ionicons
                        name="receipt-outline"
                        size={22}
                        color="#000"
                      />
                      <Text style={styles.detailCardTitle}>ID</Text>
                    </View>
                    <Text
                      style={[
                        styles.detailCardValue,
                        { fontFamily: "monospace", fontSize: 13 },
                      ]}
                    >
                      {selectedTransaction.id}
                    </Text>
                  </View>
                </View>

                <TouchableOpacity
                  style={styles.shareButton}
                  onPress={shareTransactionPDF}
                  disabled={sharingPDF}
                >
                  {sharingPDF ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <>
                      <Ionicons name="share-outline" size={22} color="#fff" />
                      <Text style={styles.shareButtonText}>
                        Compartir como PDF
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              </ScrollView>
            </View>
          )}
        </Modal>
      </LinearGradient>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: Platform.OS === "ios" ? 30 : 20, // ⬆️ MÁS ARRIBA
  },
  header: {
    paddingHorizontal: 20,
    marginBottom: 16, // ⬆️ Reducido
  },
  headerTitle: {
    fontSize: 34,
    fontWeight: "900",
    color: "#fff",
    marginBottom: 4,
    letterSpacing: -1.5,
  },
  headerSubtitle: {
    fontSize: 15,
    color: "#666",
    fontWeight: "600",
  },
  filtersContainer: {
    marginBottom: 16, // ⬆️ Reducido
  },
  filtersScroll: {
    paddingHorizontal: 20,
    gap: 10,
  },
  filterChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1a1a1a",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#222",
    gap: 8,
  },
  filterChipActive: {
    backgroundColor: "#fff",
    borderColor: "#fff",
  },
  filterText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#999",
  },
  filterTextActive: {
    color: "#000",
  },
  filterBadge: {
    backgroundColor: "#222",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    minWidth: 22,
    alignItems: "center",
  },
  filterBadgeActive: {
    backgroundColor: "#000",
  },
  filterBadgeText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#666",
  },
  filterBadgeTextActive: {
    color: "#fff",
  },
  summaryContainer: {
    paddingHorizontal: 20,
    marginBottom: 16, // ⬆️ Reducido
  },
  summaryCard: {
    backgroundColor: "#1a1a1a",
    padding: 18,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#222",
  },
  summaryRow: {
    flexDirection: "row", // ← EN UNA LÍNEA
    alignItems: "center",
    justifyContent: "space-between",
  },
  summaryItem: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    gap: 12,
  },
  summaryTextContainer: {
    flex: 1,
  },
  summaryLabel: {
    fontSize: 11,
    color: "#666",
    fontWeight: "600",
    marginBottom: 4,
  },
  summaryValue: {
    fontSize: 18, // ← MÁS GRANDE
    fontWeight: "800",
  },
  summaryDivider: {
    width: 1,
    height: 40,
    backgroundColor: "#222",
    marginHorizontal: 16,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 120, // ⚠️ Espacio para navbar flotante
  },
  transactionItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1a1a1a",
    padding: 16,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#222",
  },
  iconContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },
  transactionInfo: {
    flex: 1,
  },
  transactionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#fff",
    marginBottom: 5,
  },
  transactionDate: {
    fontSize: 13,
    color: "#666",
    fontWeight: "500",
  },
  transactionRight: {
    alignItems: "flex-end",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  transactionAmount: {
    fontSize: 17,
    fontWeight: "800",
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 100,
  },
  emptyIconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "#1a1a1a",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
    borderWidth: 1,
    borderColor: "#222",
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: "#fff",
    marginBottom: 10,
  },
  emptySubtitle: {
    fontSize: 15,
    color: "#666",
    textAlign: "center",
    paddingHorizontal: 40,
    lineHeight: 22,
  },
  loadingText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
    marginTop: 12,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: "#f8f9fa",
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: Platform.OS === "ios" ? 60 : 40,
    paddingBottom: 20,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#e8e8e8",
  },
  closeButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  modalHeaderTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#000",
  },
  modalContent: {
    flex: 1,
  },
  modalMainSection: {
    alignItems: "center",
    paddingVertical: 50,
    paddingHorizontal: 20,
    backgroundColor: "#fff",
  },
  modalIconLarge: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
  },
  modalAmount: {
    fontSize: 56,
    fontWeight: "900",
    marginBottom: 14,
    letterSpacing: -2,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#333",
    textAlign: "center",
    marginBottom: 18,
  },
  statusBadgeLarge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 20,
    gap: 8,
  },
  statusTextLarge: {
    fontSize: 16,
    fontWeight: "700",
  },
  detailsSection: {
    padding: 20,
  },
  detailCard: {
    backgroundColor: "#fff",
    borderRadius: 18,
    padding: 20,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#e8e8e8",
  },
  detailCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  detailCardTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: "#666",
    marginLeft: 10,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  detailCardValue: {
    fontSize: 17,
    fontWeight: "700",
    color: "#000",
    lineHeight: 24,
  },
  shareButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#000",
    borderRadius: 16,
    paddingVertical: 18,
    marginHorizontal: 20,
    marginTop: 10,
    gap: 10,
  },
  shareButtonText: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "800",
  },
});
