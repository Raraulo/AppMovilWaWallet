import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import {
  collection,
  doc,
  getDoc, // ← IMPORTANTE
  limit,
  onSnapshot,
  orderBy,
  query,
} from "firebase/firestore";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useAuth } from "../../utils/ctx";
import { db } from "../../utils/firebase";


const { width, height } = Dimensions.get("window");

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

export default function TransaccionesScreen() {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTransaction, setSelectedTransaction] =
    useState<Transaction | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [sharingPDF, setSharingPDF] = useState(false);

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
        console.log("✅ Transactions loaded:", loadedTransactions.length);
      },
      (error) => {
        console.error("❌ Error loading transactions:", error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user]);

  // Abrir modal con transacción seleccionada
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

// ✨ COMPARTIR COMO PDF - VERSIÓN PROFESIONAL CORREGIDA
const shareTransactionPDF = async () => {
  if (!selectedTransaction) return;

  try {
    setSharingPDF(true);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const isNegative =
      selectedTransaction.tipo === "envio" ||
      selectedTransaction.tipo === "pago";
    const color = getTransactionColor(selectedTransaction.tipo);

    // ✅ OBTENER NOMBRE REAL DEL USUARIO ACTUAL
    let senderName = "Usuario";
    if (user) {
      try {
        const userDoc = await getDoc(doc(db, "usuarios", user.uid));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          senderName = `${userData.nombre || ""} ${userData.apellido || ""}`.trim() || "Usuario";
        }
      } catch (error) {
        console.error("Error obteniendo nombre del usuario:", error);
      }
    }

    // ✅ DETERMINAR FLUJO DE TRANSACCIÓN CON NOMBRES REALES
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
          <div class="flow-value">${selectedTransaction.destinatario || "Destinatario"}</div>
        </div>
      `;
    } else if (selectedTransaction.tipo === "recepcion") {
      transactionFlow = `
        <div class="flow-item">
          <div class="flow-label">De:</div>
          <div class="flow-value">${selectedTransaction.remitente || "Remitente"}</div>
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
          <div class="flow-value">${selectedTransaction.destinatario || "Comercio"}</div>
        </div>
      `;
    }

    // ✅ FORMATEAR FECHA Y HORA CORRECTAMENTE
    let formattedDate = "";
    let formattedTime = "";
    try {
      const date = selectedTransaction.fecha.toDate instanceof Function
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

    // HTML PROFESIONAL PARA EL PDF
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            padding: 40px;
            background: #ffffff;
            color: #000;
            line-height: 1.6;
          }
          .header {
            text-align: center;
            margin-bottom: 40px;
            padding-bottom: 25px;
            border-bottom: 3px solid ${color};
          }
          .company-name {
            font-size: 36px;
            font-weight: bold;
            color: #000;
            margin-bottom: 5px;
            letter-spacing: 1px;
          }
          .document-type {
            font-size: 14px;
            color: #666;
            text-transform: uppercase;
            letter-spacing: 2px;
            font-weight: 600;
          }
          
          .transaction-header {
            background: linear-gradient(135deg, ${color}15 0%, ${color}05 100%);
            padding: 30px;
            border-radius: 12px;
            margin-bottom: 30px;
            border-left: 5px solid ${color};
          }
          .transaction-number {
            font-size: 12px;
            color: #666;
            margin-bottom: 15px;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 1px;
          }
          .amount-display {
            font-size: 52px;
            font-weight: bold;
            color: ${color};
            margin-bottom: 10px;
            line-height: 1;
          }
          .transaction-description {
            font-size: 18px;
            color: #333;
            font-weight: 600;
            margin-bottom: 20px;
          }
          .transaction-flow {
            background: #ffffff;
            padding: 20px;
            border-radius: 8px;
            border: 1px solid #e0e0e0;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 20px;
          }
          .flow-item {
            text-align: center;
          }
          .flow-label {
            font-size: 12px;
            color: #666;
            font-weight: 600;
            margin-bottom: 8px;
            text-transform: uppercase;
            letter-spacing: 1px;
          }
          .flow-value {
            font-size: 16px;
            color: #000;
            font-weight: 700;
          }
          .flow-arrow {
            font-size: 24px;
            color: ${color};
            font-weight: bold;
          }
          
          .status-section {
            text-align: center;
            margin-bottom: 35px;
          }
          .status-badge {
            display: inline-block;
            padding: 10px 24px;
            border-radius: 25px;
            font-size: 14px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 1px;
            background: ${
              selectedTransaction.estado === "completado"
                ? "#E8F5E9"
                : selectedTransaction.estado === "pendiente"
                ? "#FFF3E0"
                : "#FFEBEE"
            };
            color: ${
              selectedTransaction.estado === "completado"
                ? "#2E7D32"
                : selectedTransaction.estado === "pendiente"
                ? "#F57C00"
                : "#C62828"
            };
            border: 2px solid ${
              selectedTransaction.estado === "completado"
                ? "#2E7D32"
                : selectedTransaction.estado === "pendiente"
                ? "#F57C00"
                : "#C62828"
            };
          }
          
          .details-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 20px;
            margin-bottom: 30px;
          }
          .detail-item {
            background: #f9f9f9;
            padding: 20px;
            border-radius: 10px;
            border-left: 4px solid ${color};
          }
          .detail-label {
            font-size: 11px;
            color: #777;
            text-transform: uppercase;
            letter-spacing: 1px;
            margin-bottom: 8px;
            font-weight: 700;
          }
          .detail-value {
            font-size: 15px;
            color: #000;
            font-weight: 600;
            word-wrap: break-word;
          }
          
          .full-width-detail {
            grid-column: 1 / -1;
          }
          
          .concept-section {
            background: #fffbf0;
            padding: 20px;
            border-radius: 10px;
            margin-bottom: 30px;
            border: 1px dashed #e0c068;
          }
          .concept-label {
            font-size: 11px;
            color: #8b7355;
            text-transform: uppercase;
            letter-spacing: 1px;
            margin-bottom: 10px;
            font-weight: 700;
          }
          .concept-value {
            font-size: 16px;
            color: #333;
            font-style: italic;
            line-height: 1.6;
          }
          
          .transaction-id-section {
            background: #f0f0f0;
            padding: 20px;
            border-radius: 10px;
            margin-bottom: 30px;
            border: 2px solid #d0d0d0;
          }
          .id-label {
            font-size: 11px;
            color: #666;
            text-transform: uppercase;
            letter-spacing: 1px;
            margin-bottom: 10px;
            font-weight: 700;
          }
          .id-value {
            font-family: 'Courier New', Courier, monospace;
            font-size: 13px;
            color: #000;
            word-break: break-all;
            padding: 12px;
            background: #ffffff;
            border-radius: 6px;
            border: 1px solid #d0d0d0;
          }
          
          .footer {
            margin-top: 50px;
            padding-top: 25px;
            border-top: 2px solid #e0e0e0;
            text-align: center;
          }
          .footer-title {
            font-size: 12px;
            color: #000;
            font-weight: 700;
            margin-bottom: 8px;
            text-transform: uppercase;
            letter-spacing: 1px;
          }
          .footer-text {
            font-size: 11px;
            color: #666;
            margin-bottom: 5px;
          }
          .generation-date {
            font-size: 10px;
            color: #999;
            margin-top: 15px;
            font-style: italic;
          }
          
          .divider {
            height: 2px;
            background: linear-gradient(to right, transparent, #e0e0e0, transparent);
            margin: 30px 0;
          }
        </style>
      </head>
      <body>
        <!-- Header -->
        <div class="header">
          <div class="company-name">WaWallet</div>
          <div class="document-type">Comprobante de Transacción</div>
        </div>

        <!-- Transaction Header -->
        <div class="transaction-header">
          <div class="transaction-number">Operación #${selectedTransaction.id.slice(
            0,
            8
          ).toUpperCase()}</div>
          <div class="amount-display">${isNegative ? "- " : "+ "}$${Math.abs(
      selectedTransaction.monto
    ).toFixed(2)} BTC</div>
          <div class="transaction-description">${getTransactionTitle(
            selectedTransaction
          )}</div>
          <div class="transaction-flow">${transactionFlow}</div>
        </div>

        <!-- Status Badge -->
        <div class="status-section">
          <div class="status-badge">
            ${
              selectedTransaction.estado.charAt(0).toUpperCase() +
              selectedTransaction.estado.slice(1)
            }
          </div>
        </div>

        <div class="divider"></div>

        <!-- Details Grid -->
        <div class="details-grid">
          <div class="detail-item">
            <div class="detail-label">Fecha de Transacción</div>
            <div class="detail-value">${formattedDate}</div>
          </div>

          <div class="detail-item">
            <div class="detail-label">Hora</div>
            <div class="detail-value">${formattedTime}</div>
          </div>

          <div class="detail-item">
            <div class="detail-label">Tipo de Operación</div>
            <div class="detail-value">${
              selectedTransaction.tipo.charAt(0).toUpperCase() +
              selectedTransaction.tipo.slice(1)
            }</div>
          </div>

          <div class="detail-item">
            <div class="detail-label">Método</div>
            <div class="detail-value">Transferencia Digital</div>
          </div>
        </div>

        ${
          selectedTransaction.razon
            ? `
        <!-- Concepto Section -->
        <div class="concept-section">
          <div class="concept-label">Concepto / Descripción</div>
          <div class="concept-value">${selectedTransaction.razon}</div>
        </div>
        `
            : ""
        }

        <!-- Transaction ID -->
        <div class="transaction-id-section">
          <div class="id-label">Identificador de Transacción</div>
          <div class="id-value">${selectedTransaction.id}</div>
        </div>

        <div class="divider"></div>

        <!-- Footer -->
        <div class="footer">
          <div class="footer-title">WaWallet Inc.</div>
          <div class="footer-text">Documento oficial de transacción</div>
          <div class="footer-text">Este comprobante certifica la operación realizada</div>
          <div class="generation-date">
            Documento generado el ${new Date().toLocaleDateString("es-ES", {
              year: "numeric",
              month: "long",
              day: "numeric",
            })} a las ${new Date().toLocaleTimeString("es-ES", {
      hour: "2-digit",
      minute: "2-digit",
    })}
          </div>
        </div>
      </body>
      </html>
    `;

    // Generar PDF
    const { uri } = await Print.printToFileAsync({
      html,
      base64: false,
    });

    console.log("✅ PDF generado:", uri);

    // Verificar si se puede compartir
    const isAvailable = await Sharing.isAvailableAsync();
    if (isAvailable) {
      await Sharing.shareAsync(uri, {
        mimeType: "application/pdf",
        dialogTitle: "Compartir Comprobante de Transacción",
        UTI: "com.adobe.pdf",
      });
      await Haptics.notificationAsync(
        Haptics.NotificationFeedbackType.Success
      );
    } else {
      Alert.alert(
        "Error",
        "La función de compartir no está disponible en este dispositivo"
      );
    }
  } catch (error) {
    console.error("❌ Error al compartir PDF:", error);
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    Alert.alert("Error", "No se pudo generar el PDF. Intenta de nuevo.");
  } finally {
    setSharingPDF(false);
  }
};


  // Obtener icono según tipo de transacción
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

  // Obtener color según tipo
  const getTransactionColor = (tipo: string): string => {
    switch (tipo) {
      case "envio":
      case "pago":
        return "#FF3B30";
      case "recepcion":
      case "recarga":
        return "#34C759";
      default:
        return "#666";
    }
  };

  // Obtener título según tipo
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
        year: "numeric",
      }).format(date);
    } catch {
      return "";
    }
  };

  // Formatear fecha completa para modal
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

  // Renderizar item de transacción
  const renderTransaction = ({ item }: { item: Transaction }) => {
    const isNegative = item.tipo === "envio" || item.tipo === "pago";

    return (
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={() => openTransactionModal(item)}
        style={styles.transactionItem}
      >
        <View style={styles.iconWrapper}>
          <Ionicons
            name={getTransactionIcon(item.tipo) as any}
            size={26}
            color="#e87400"
          />
        </View>

        <View style={styles.info}>
          <Text style={styles.itemTitle}>{getTransactionTitle(item)}</Text>
          <Text style={styles.itemDate}>{formatDate(item.fecha)}</Text>
        </View>

        <View style={styles.rightSection}>
          <Text
            style={[
              styles.amount,
              { color: isNegative ? "#ff3b30" : "#34c759" },
            ]}
          >
            {isNegative ? "-" : "+"}${Math.abs(item.monto).toFixed(2)}
          </Text>
          <Ionicons
            name="chevron-forward"
            size={20}
            color="#999"
            style={{ marginTop: 4 }}
          />
        </View>
      </TouchableOpacity>
    );
  };

  // Empty state
  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="receipt-outline" size={80} color="#555" />
      <Text style={styles.emptyTitle}>No hay transacciones</Text>
      <Text style={styles.emptySubtitle}>
        Realiza tu primera transferencia para ver el historial aquí
      </Text>
    </View>
  );

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: "center" }]}>
        <ActivityIndicator size="large" color="#e87400" />
        <Text style={styles.loadingText}>Cargando transacciones...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>All your Transactions</Text>
      </View>

      {/* Lista de transacciones */}
      <FlatList
        data={transactions}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingVertical: 15 }}
        renderItem={renderTransaction}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={renderEmpty}
      />

      {/* MODAL DE DETALLES */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={closeModal}
      >
        {selectedTransaction && (
          <View style={styles.modalContainer}>
            {/* Modal Header */}
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
            >
              {/* Icono y Monto Grande */}
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
                    name={getTransactionIcon(selectedTransaction.tipo) as any}
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

                {/* Estado Badge */}
                <View
                  style={[
                    styles.statusBadgeLarge,
                    {
                      backgroundColor:
                        selectedTransaction.estado === "completado"
                          ? "#E8F5E9"
                          : selectedTransaction.estado === "pendiente"
                          ? "#FFF3E0"
                          : "#FFEBEE",
                    },
                  ]}
                >
                  <Ionicons
                    name={
                      selectedTransaction.estado === "completado"
                        ? "checkmark-circle"
                        : selectedTransaction.estado === "pendiente"
                        ? "time-outline"
                        : "close-circle"
                    }
                    size={18}
                    color={
                      selectedTransaction.estado === "completado"
                        ? "#2E7D32"
                        : selectedTransaction.estado === "pendiente"
                        ? "#F57C00"
                        : "#C62828"
                    }
                  />
                  <Text
                    style={[
                      styles.statusTextLarge,
                      {
                        color:
                          selectedTransaction.estado === "completado"
                            ? "#2E7D32"
                            : selectedTransaction.estado === "pendiente"
                            ? "#F57C00"
                            : "#C62828",
                      },
                    ]}
                  >
                    {selectedTransaction.estado.charAt(0).toUpperCase() +
                      selectedTransaction.estado.slice(1)}
                  </Text>
                </View>
              </View>

              {/* Detalles en Cards */}
              <View style={styles.detailsSection}>
                {/* Fecha */}
                <View style={styles.detailCard}>
                  <View style={styles.detailCardHeader}>
                    <Ionicons
                      name="calendar-outline"
                      size={22}
                      color="#e87400"
                    />
                    <Text style={styles.detailCardTitle}>Fecha</Text>
                  </View>
                  <Text style={styles.detailCardValue}>
                    {formatFullDate(selectedTransaction.fecha)}
                  </Text>
                </View>

                {/* Tipo */}
                <View style={styles.detailCard}>
                  <View style={styles.detailCardHeader}>
                    <Ionicons name="list-outline" size={22} color="#e87400" />
                    <Text style={styles.detailCardTitle}>Tipo</Text>
                  </View>
                  <Text style={styles.detailCardValue}>
                    {selectedTransaction.tipo.charAt(0).toUpperCase() +
                      selectedTransaction.tipo.slice(1)}
                  </Text>
                </View>

                {/* Destinatario o Remitente */}
                {(selectedTransaction.destinatario ||
                  selectedTransaction.remitente) && (
                  <View style={styles.detailCard}>
                    <View style={styles.detailCardHeader}>
                      <Ionicons
                        name="person-outline"
                        size={22}
                        color="#e87400"
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

                {/* Razón */}
                {selectedTransaction.razon && (
                  <View style={styles.detailCard}>
                    <View style={styles.detailCardHeader}>
                      <Ionicons
                        name="chatbubble-outline"
                        size={22}
                        color="#e87400"
                      />
                      <Text style={styles.detailCardTitle}>Concepto</Text>
                    </View>
                    <Text style={styles.detailCardValue}>
                      {selectedTransaction.razon}
                    </Text>
                  </View>
                )}

                {/* ID de Transacción */}
                <View style={styles.detailCard}>
                  <View style={styles.detailCardHeader}>
                    <Ionicons
                      name="receipt-outline"
                      size={22}
                      color="#e87400"
                    />
                    <Text style={styles.detailCardTitle}>
                      ID de Transacción
                    </Text>
                  </View>
                  <Text
                    style={[
                      styles.detailCardValue,
                      { fontFamily: "monospace" },
                    ]}
                  >
                    {selectedTransaction.id}
                  </Text>
                </View>
              </View>

              {/* Botón de Compartir PDF */}
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
    </View>
  );
}

/* ESTILOS - Sin cambios */
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000000ff", paddingHorizontal: 20, paddingTop: 15 },
  header: { backgroundColor: "#000000ff", borderRadius: 20, flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 20, paddingHorizontal: 24, shadowColor: "#000000ff", shadowOpacity: 0.25, shadowRadius: 10, shadowOffset: { width: 0, height: 5 }, marginBottom: 20 },
  title: { color: "#fff", fontSize: 22, fontWeight: "700", letterSpacing: 0.5 },
  transactionItem: { flexDirection: "row", alignItems: "center", paddingVertical: 14, paddingHorizontal: 10, backgroundColor: "#f8f8f8", borderRadius: 14 },
  iconWrapper: { backgroundColor: "rgba(232,116,0,0.1)", borderRadius: 12, padding: 10, marginRight: 14 },
  info: { flex: 1 },
  itemTitle: { fontSize: 16, fontWeight: "600", color: "#000" },
  itemDate: { fontSize: 13, color: "#777", marginTop: 2 },
  rightSection: { alignItems: "flex-end" },
  amount: { fontSize: 17, fontWeight: "700" },
  separator: { height: 12 },
  emptyContainer: { alignItems: "center", justifyContent: "center", paddingVertical: 100 },
  emptyTitle: { fontSize: 20, fontWeight: "700", color: "#999", marginTop: 16, marginBottom: 8 },
  emptySubtitle: { fontSize: 14, color: "#777", textAlign: "center", paddingHorizontal: 40 },
  loadingText: { color: "#e87400", fontSize: 16, fontWeight: "600", marginTop: 12, textAlign: "center" },
  modalContainer: { flex: 1, backgroundColor: "#f8f9fa" },
  modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingTop: Platform.OS === "ios" ? 60 : 40, paddingBottom: 20, backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#e8e8e8" },
  closeButton: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  modalHeaderTitle: { fontSize: 20, fontWeight: "700", color: "#000" },
  modalContent: { flex: 1 },
  modalMainSection: { alignItems: "center", paddingVertical: 40, paddingHorizontal: 20, backgroundColor: "#fff" },
  modalIconLarge: { width: 120, height: 120, borderRadius: 60, alignItems: "center", justifyContent: "center", marginBottom: 24 },
  modalAmount: { fontSize: 48, fontWeight: "800", marginBottom: 12 },
  modalTitle: { fontSize: 20, fontWeight: "600", color: "#333", textAlign: "center", marginBottom: 16 },
  statusBadgeLarge: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
  statusTextLarge: { fontSize: 16, fontWeight: "700", marginLeft: 8 },
  detailsSection: { padding: 20 },
  detailCard: { backgroundColor: "#fff", borderRadius: 16, padding: 20, marginBottom: 16, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  detailCardHeader: { flexDirection: "row", alignItems: "center", marginBottom: 12 },
  detailCardTitle: { fontSize: 14, fontWeight: "600", color: "#666", marginLeft: 10, textTransform: "uppercase", letterSpacing: 0.5 },
  detailCardValue: { fontSize: 17, fontWeight: "600", color: "#000", lineHeight: 24 },
  shareButton: { flexDirection: "row", alignItems: "center", justifyContent: "center", backgroundColor: "#000000ff", borderRadius: 16, paddingVertical: 16, marginHorizontal: 20, marginTop: 10, marginBottom: 40, shadowColor: "#000000ff", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 5 },
  shareButtonText: { color: "#fff", fontSize: 17, fontWeight: "700", marginLeft: 10 },
});
