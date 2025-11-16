import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  runTransaction,
  setDoc,
  where,
} from "firebase/firestore";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  Easing,
  Image,
  ImageBackground,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { auth, db } from "../../utils/firebase";
import generateCard from "../../utils/generateCard";

const { width, height } = Dimensions.get("window");

export default function IndexScreen() {
  const [card, setCard] = useState<any>(null);
  const [balance, setBalance] = useState(0);
  const [showBalance, setShowBalance] = useState(false);
  const [flipped, setFlipped] = useState(false);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);

  // Transfer modal states
  const [transferVisible, setTransferVisible] = useState(false);
  const [recipientPhone, setRecipientPhone] = useState("");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [transferLoading, setTransferLoading] = useState(false);
  const [transferSuccess, setTransferSuccess] = useState(false);
  const [recipientName, setRecipientName] = useState("");

  const flipAnim = useRef(new Animated.Value(0)).current;
  const modalAnim = useRef(new Animated.Value(0)).current;
  const transferModalAnim = useRef(new Animated.Value(0)).current;
  const successAnim = useRef(new Animated.Value(0)).current;
  const successScale = useRef(new Animated.Value(0)).current;

  const frontInterpolate = flipAnim.interpolate({
    inputRange: [0, 180],
    outputRange: ["0deg", "180deg"],
  });
  const backInterpolate = flipAnim.interpolate({
    inputRange: [0, 180],
    outputRange: ["180deg", "360deg"],
  });

  const flipCard = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Animated.timing(flipAnim, {
      toValue: flipped ? 0 : 180,
      duration: 700,
      easing: Easing.out(Easing.ease),
      useNativeDriver: true,
    }).start(() => setFlipped(!flipped));
  };

  const openModal = async () => {
    setModalVisible(true);
    modalAnim.setValue(0);
    Animated.timing(modalAnim, {
      toValue: 1,
      duration: 300,
      easing: Easing.out(Easing.ease),
      useNativeDriver: true,
    }).start();
  };

  const closeModal = async () => {
    Animated.timing(modalAnim, {
      toValue: 0,
      duration: 250,
      easing: Easing.in(Easing.ease),
      useNativeDriver: true,
    }).start(() => setModalVisible(false));
  };

  // Open transfer modal with animation
  const openTransferModal = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setTransferVisible(true);
    setTransferSuccess(false);
    transferModalAnim.setValue(height);
    Animated.spring(transferModalAnim, {
      toValue: 0,
      damping: 25,
      stiffness: 120,
      useNativeDriver: true,
    }).start();
  };

  // Close transfer modal with animation
  const closeTransferModal = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Animated.timing(transferModalAnim, {
      toValue: height,
      duration: 300,
      easing: Easing.in(Easing.ease),
      useNativeDriver: true,
    }).start(() => {
      setTransferVisible(false);
      setRecipientPhone("");
      setAmount("");
      setReason("");
      setRecipientName("");
      setTransferSuccess(false);
    });
  };

  // Success animation
  const showSuccessAnimation = () => {
    setTransferSuccess(true);
    successAnim.setValue(0);
    successScale.setValue(0);

    Animated.parallel([
      Animated.spring(successScale, {
        toValue: 1,
        damping: 10,
        stiffness: 100,
        useNativeDriver: true,
      }),
      Animated.timing(successAnim, {
        toValue: 1,
        duration: 400,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
    ]).start();

    // Close modal after success
    setTimeout(() => {
      closeTransferModal();
    }, 2500);
  };

  // Function to fetch or create user data (including balance)
  const fetchOrCreateCard = async () => {
    if (!auth.currentUser) return;
    const ref = doc(db, "usuarios", auth.currentUser.uid);
    const snap = await getDoc(ref);
    if (snap.exists()) {
      const data = snap.data();
      setBalance(data.balance ?? 0);
      if (data.tarjeta) {
        setCard(data.tarjeta);
      } else {
        const newCard = generateCard(
          data.nombre ? `${data.nombre} ${data.apellido}` : ""
        );
        await setDoc(ref, { ...data, tarjeta: newCard }, { merge: true });
        setCard(newCard);
      }
    }
    setLoading(false);
  };

  // ✨✨✨ HANDLE TRANSFER - CON GUARDADO DE TRANSACCIONES ✨✨✨
  const handleTransfer = async () => {
    const phone = recipientPhone.trim();
    const transferAmount = parseFloat(amount);

    if (!phone || !amount) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("Error", "Completa todos los campos requeridos");
      return;
    }
    if (transferAmount <= 0 || transferAmount > balance) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("Error", "Cantidad inválida o saldo insuficiente");
      return;
    }

    setTransferLoading(true);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      console.log("🔍 Buscando destinatario con teléfono:", phone);

      // Query for recipient by phone
      const q = query(
        collection(db, "usuarios"),
        where("celular", "==", phone)
      );
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        await Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Error
        );
        Alert.alert("Error", "Usuario no encontrado con ese número de celular");
        setTransferLoading(false);
        return;
      }

      const recipientUid = querySnapshot.docs[0].id;
      const recipientData = querySnapshot.docs[0].data();
      const recipientFullName = `${recipientData.nombre || ""} ${
        recipientData.apellido || ""
      }`.trim();
      setRecipientName(recipientFullName);

      console.log("✅ Destinatario encontrado:", recipientFullName, recipientUid);

      // Get sender data BEFORE transaction
      const senderDoc = await getDoc(
        doc(db, "usuarios", auth.currentUser!.uid)
      );
      const senderData = senderDoc.data();
      const senderFullName = `${senderData?.nombre || ""} ${
        senderData?.apellido || ""
      }`.trim();

      console.log("👤 Remitente:", senderFullName, auth.currentUser!.uid);
      console.log("💸 Iniciando transacción de $", transferAmount);

      // ✨✨✨ TRANSACTION CON GUARDADO DE TRANSACCIONES ✨✨✨
      await runTransaction(db, async (transaction) => {
        const senderRef = doc(db, "usuarios", auth.currentUser!.uid);
        const senderSnap = await transaction.get(senderRef);

        if (!senderSnap.exists()) throw new Error("Usuario no encontrado");

        const currentSenderData = senderSnap.data();
        const currentBalance = currentSenderData.balance ?? 0;

        if (transferAmount > currentBalance)
          throw new Error("Saldo insuficiente");

        const recipientRef = doc(db, "usuarios", recipientUid);
        const recipientSnap = await transaction.get(recipientRef);

        if (!recipientSnap.exists())
          throw new Error("Destinatario no encontrado");

        console.log("💰 Actualizando balances...");

        // Update balances
        transaction.update(senderRef, {
          balance: currentBalance - transferAmount,
        });

        transaction.update(recipientRef, {
          balance: (recipientSnap.data().balance ?? 0) + transferAmount,
        });

        console.log("✅ Balances actualizados");

        // ✨ GUARDAR TRANSACCIÓN DEL REMITENTE (ENVÍO)
        const senderTransactionRef = doc(
          collection(db, "usuarios", auth.currentUser!.uid, "transacciones")
        );

        console.log("📤 Guardando transacción de envío...");
        transaction.set(senderTransactionRef, {
          tipo: "envio",
          monto: transferAmount,
          destinatario: recipientFullName || phone,
          razon: reason || "",
          fecha: new Date(),
          estado: "completado",
        });
        console.log("✅ Transacción de envío guardada");

        // ✨ GUARDAR TRANSACCIÓN DEL DESTINATARIO (RECEPCIÓN)
        const recipientTransactionRef = doc(
          collection(db, "usuarios", recipientUid, "transacciones")
        );

        console.log("📥 Guardando transacción de recepción...");
        transaction.set(recipientTransactionRef, {
          tipo: "recepcion",
          monto: transferAmount,
          remitente: senderFullName || "Usuario",
          razon: reason || "",
          fecha: new Date(),
          estado: "completado",
        });
        console.log("✅ Transacción de recepción guardada");
      });

      console.log("🎉 ¡Transferencia completada exitosamente!");

      // Success
      await Haptics.notificationAsync(
        Haptics.NotificationFeedbackType.Success
      );
      await fetchOrCreateCard(); // Update local balance
      showSuccessAnimation();
    } catch (error) {
      console.error("❌ Error en transferencia:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Error en la transferencia";
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("Error", errorMessage);
    } finally {
      setTransferLoading(false);
    }
  };

  useEffect(() => {
    fetchOrCreateCard();
  }, []);

  const formatBalance = (v: number) =>
    v.toLocaleString("en-US", { minimumFractionDigits: 2 });

  const maskedBalance = balance
    .toLocaleString("en-US", { minimumFractionDigits: 2 })
    .replace(/\d/g, "*");

  if (loading)
    return (
      <ActivityIndicator
        size="large"
        color="#007AFF"
        style={{ marginTop: 100 }}
      />
    );

  return (
    <View style={styles.container}>
      {/* SMALL CARD - At the top */}
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={openModal}
        style={styles.cardContainer}
      >
        <ImageBackground
          source={{
            uri: "https://w.wallhaven.cc/full/n6/wallhaven-n68mj6.jpg",
          }}
          resizeMode="cover"
          style={styles.cardBg}
          imageStyle={{ borderRadius: 20 }}
        >
          <Image
            source={{
              uri: "https://upload.wikimedia.org/wikipedia/commons/5/5e/Visa_2021.svg",
            }}
            style={styles.logo}
            resizeMode="contain"
          />
          <Text
            style={styles.cardNumber}
            numberOfLines={1}
            ellipsizeMode="clip"
          >
            {card.numero.slice(0, 4)} **** **** ****
          </Text>
          <View style={styles.cardBottom}>
            <View>
              <Text style={styles.label}>Cardholder</Text>
              <Text style={styles.valueDark}>{card.titular}</Text>
            </View>
            <View>
              <Text style={styles.label}>Expires</Text>
              <Text style={styles.valueDark}>{card.fechaExp}</Text>
            </View>
          </View>
        </ImageBackground>
      </TouchableOpacity>

      {/* TRANSFER BUTTON WITH ICON */}
      <TouchableOpacity
        style={styles.transferBtn}
        onPress={openTransferModal}
        disabled={balance <= 0}
      >
        <Ionicons
          name="arrow-up-circle-outline"
          size={22}
          color="#fff"
          style={{ marginRight: 6 }}
        />
        <Text style={styles.transferText}>Transfer</Text>
      </TouchableOpacity>

      {/* FULL SCREEN TRANSFER MODAL */}
      <Modal visible={transferVisible} transparent animationType="none">
        <Animated.View
          style={[
            styles.fullScreenModal,
            { transform: [{ translateY: transferModalAnim }] },
          ]}
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            style={{ flex: 1 }}
          >
            {/* Header */}
            <View style={styles.modalHeader}>
              <TouchableOpacity
                onPress={closeTransferModal}
                style={styles.modalCloseBtn}
              >
                <Ionicons name="close" size={28} color="#000" />
              </TouchableOpacity>
              <Text style={styles.modalHeaderTitle}>Send Money</Text>
              <View style={{ width: 28 }} />
            </View>

            {/* Success View */}
            {transferSuccess ? (
              <Animated.View
                style={[
                  styles.successContainer,
                  {
                    opacity: successAnim,
                    transform: [{ scale: successScale }],
                  },
                ]}
              >
                <View style={styles.successCheckmark}>
                  <Ionicons name="checkmark" size={60} color="#fff" />
                </View>
                <Text style={styles.successTitle}>Transfer Successful!</Text>
                <Text style={styles.successAmount}>${amount}</Text>
                <Text style={styles.successRecipient}>
                  Sent to {recipientName || recipientPhone}
                </Text>
                {reason ? (
                  <Text style={styles.successReason}>"{reason}"</Text>
                ) : null}
              </Animated.View>
            ) : (
              <ScrollView
                style={styles.modalContent}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
              >
                {/* Amount Input */}
                <View style={styles.amountSection}>
                  <Text style={styles.amountLabel}>Amount</Text>
                  <View style={styles.amountInputContainer}>
                    <Text style={styles.currencySymbol}>$</Text>
                    <TextInput
                      style={styles.amountInput}
                      placeholder="0"
                      placeholderTextColor="#d0d0d0"
                      keyboardType="decimal-pad"
                      value={amount}
                      onChangeText={setAmount}
                      maxLength={10}
                    />
                    <Text style={styles.currencyCode}>BTC</Text>
                  </View>
                  <Text style={styles.availableBalance}>
                    Available: ${formatBalance(balance)}
                  </Text>
                </View>

                {/* Recipient Phone Input */}
                <View style={styles.inputSection}>
                  <Text style={styles.inputLabel}>To</Text>
                  <View style={styles.inputWrapper}>
                    <Ionicons
                      name="call-outline"
                      size={20}
                      color="#666"
                      style={styles.inputIcon}
                    />
                    <TextInput
                      style={styles.textInput}
                      placeholder="Recipient's phone number"
                      placeholderTextColor="#999"
                      keyboardType="phone-pad"
                      value={recipientPhone}
                      onChangeText={setRecipientPhone}
                    />
                  </View>
                </View>

                {/* Reason Input */}
                <View style={styles.inputSection}>
                  <Text style={styles.inputLabel}>What's this for?</Text>
                  <View style={styles.inputWrapper}>
                    <Ionicons
                      name="chatbubble-outline"
                      size={20}
                      color="#666"
                      style={styles.inputIcon}
                    />
                    <TextInput
                      style={styles.textInput}
                      placeholder="Add a note (optional)"
                      placeholderTextColor="#999"
                      value={reason}
                      onChangeText={setReason}
                      maxLength={100}
                    />
                  </View>
                </View>

                {/* Info Card */}
                <View style={styles.infoCard}>
                  <Ionicons
                    name="information-circle"
                    size={24}
                    color="#007AFF"
                  />
                  <Text style={styles.infoText}>
                    Transfers are instant and secure. The recipient will receive
                    the money immediately.
                  </Text>
                </View>
              </ScrollView>
            )}

            {/* Bottom Button */}
            {!transferSuccess && (
              <View style={styles.modalBottom}>
                <TouchableOpacity
                  style={[
                    styles.sendButton,
                    (transferLoading || !amount || !recipientPhone) &&
                      styles.sendButtonDisabled,
                  ]}
                  onPress={handleTransfer}
                  disabled={transferLoading || !amount || !recipientPhone}
                >
                  {transferLoading ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <>
                      <Ionicons
                        name="send"
                        size={22}
                        color="#fff"
                        style={{ marginRight: 8 }}
                      />
                      <Text style={styles.sendButtonText}>
                        Send ${amount || "0.00"}
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            )}
          </KeyboardAvoidingView>
        </Animated.View>
      </Modal>

      {/* MODAL FULL CARD */}
      <Modal visible={modalVisible} transparent>
        <Animated.View
          style={[
            styles.modalBg,
            {
              opacity: modalAnim,
              transform: [
                {
                  scale: modalAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.95, 1],
                  }),
                },
              ],
            },
          ]}
        >
          <TouchableOpacity onPress={closeModal} style={styles.closeBtn}>
            <Ionicons name="arrow-back" size={30} color="#fff" />
          </TouchableOpacity>

          <TouchableOpacity onPress={flipCard} style={styles.flipIcon}>
            <Ionicons
              name={flipped ? "card" : "card-outline"}
              size={30}
              color="#fff"
            />
          </TouchableOpacity>

          <View style={styles.modalCardWrapper}>
            {/* FRONT */}
            <Animated.View
              style={[
                styles.fullCard,
                { transform: [{ rotateY: frontInterpolate }] },
              ]}
            >
              <ImageBackground
                source={{
                  uri: "https://w.wallhaven.cc/full/n6/wallhaven-n68mj6.jpg",
                }}
                resizeMode="cover"
                style={styles.fullCardBg}
                imageStyle={{ borderRadius: 20 }}
              >
                <Image
                  source={{
                    uri: "https://upload.wikimedia.org/wikipedia/commons/5/5e/Visa_2021.svg",
                  }}
                  style={styles.fullLogo}
                  resizeMode="contain"
                />

                <View style={styles.numberPlate}>
                  <Text style={styles.fullNumber}>{card.numero}</Text>
                </View>

                <View style={styles.cardBottom}>
                  <View>
                    <Text style={styles.label}>Cardholder</Text>
                    <Text style={styles.valueDarkModal}>{card.titular}</Text>
                  </View>
                  <View>
                    <Text style={styles.label}>Expires</Text>
                    <Text style={styles.valueDarkModal}>{card.fechaExp}</Text>
                  </View>
                </View>
              </ImageBackground>
            </Animated.View>

            {/* BACK */}
            <Animated.View
              style={[
                styles.fullCard,
                styles.fullCardBack,
                { transform: [{ rotateY: backInterpolate }] },
              ]}
            >
              <ImageBackground
                source={{
                  uri: "https://w.wallhaven.cc/full/n6/wallhaven-n68mj6.jpg",
                }}
                resizeMode="cover"
                style={styles.fullCardBg}
                imageStyle={{ borderRadius: 20 }}
              >
                <View style={styles.blackStrip} />
                <View style={styles.cvvRow}>
                  <Text style={styles.cvvLabel}>CVV</Text>
                  <Text style={styles.cvvValue}>{card.cvv}</Text>
                </View>
              </ImageBackground>
            </Animated.View>
          </View>
        </Animated.View>
      </Modal>
    </View>
  );
}

/* STYLES */
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000", padding: 20 },
  transferBtn: { flexDirection: "row", alignItems: "center", backgroundColor: "#000000ff", borderRadius: 14, paddingVertical: 12, paddingHorizontal: 30, marginTop: 26, alignSelf: "center" },
  transferText: { color: "#fff", fontSize: 18, fontWeight: "600" },
  fullScreenModal: { flex: 1, backgroundColor: "#f8f9fa" },
  modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingTop: Platform.OS === "ios" ? 60 : 40, paddingBottom: 20, backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#e8e8e8" },
  modalCloseBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  modalHeaderTitle: { fontSize: 20, fontWeight: "700", color: "#000", letterSpacing: 0.3 },
  modalContent: { flex: 1, paddingHorizontal: 20 },
  amountSection: { alignItems: "center", paddingVertical: 40, backgroundColor: "#fff", borderRadius: 24, marginTop: 20, marginBottom: 24, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 3 },
  amountLabel: { fontSize: 16, color: "#666", fontWeight: "500", marginBottom: 12 },
  amountInputContainer: { flexDirection: "row", alignItems: "center", justifyContent: "center" },
  currencySymbol: { fontSize: 48, fontWeight: "700", color: "#000", marginRight: 8 },
  amountInput: { fontSize: 56, fontWeight: "700", color: "#000", minWidth: 100, textAlign: "center", padding: 0 },
  currencyCode: { fontSize: 24, fontWeight: "600", color: "#999", marginLeft: 8 },
  availableBalance: { fontSize: 14, color: "#999", marginTop: 16, fontWeight: "500" },
  inputSection: { marginBottom: 24 },
  inputLabel: { fontSize: 14, fontWeight: "600", color: "#333", marginBottom: 10, marginLeft: 4 },
  inputWrapper: { flexDirection: "row", alignItems: "center", backgroundColor: "#fff", borderRadius: 16, paddingHorizontal: 16, paddingVertical: 4, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 6, elevation: 2 },
  inputIcon: { marginRight: 12 },
  textInput: { flex: 1, fontSize: 16, color: "#000", paddingVertical: 16, fontWeight: "500" },
  infoCard: { flexDirection: "row", alignItems: "center", backgroundColor: "#E8F4FF", borderRadius: 16, padding: 16, marginBottom: 20 },
  infoText: { flex: 1, fontSize: 13, color: "#007AFF", marginLeft: 12, lineHeight: 18, fontWeight: "500" },
  modalBottom: { padding: 20, paddingBottom: Platform.OS === "ios" ? 34 : 20, backgroundColor: "#fff", borderTopWidth: 1, borderTopColor: "#e8e8e8" },
  sendButton: { backgroundColor: "#000", borderRadius: 16, paddingVertical: 18, flexDirection: "row", alignItems: "center", justifyContent: "center", shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 5 },
  sendButtonDisabled: { backgroundColor: "#ccc" },
  sendButtonText: { color: "#fff", fontSize: 18, fontWeight: "700", letterSpacing: 0.5 },
  successContainer: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 40 },
  successCheckmark: { width: 120, height: 120, borderRadius: 60, backgroundColor: "#34C759", alignItems: "center", justifyContent: "center", marginBottom: 30, shadowColor: "#34C759", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 16, elevation: 8 },
  successTitle: { fontSize: 28, fontWeight: "700", color: "#000", marginBottom: 16 },
  successAmount: { fontSize: 48, fontWeight: "800", color: "#34C759", marginBottom: 12 },
  successRecipient: { fontSize: 18, color: "#666", fontWeight: "500", marginBottom: 8 },
  successReason: { fontSize: 16, color: "#999", fontStyle: "italic", marginTop: 8, textAlign: "center" },
  cardContainer: { marginTop: 20, width: width * 0.85, height: 190, borderRadius: 20, overflow: "hidden", alignSelf: "center" },
  cardBg: { flex: 1, padding: 20, justifyContent: "space-between" },
  logo: { width: 70, height: 40, alignSelf: "flex-end" },
  cardNumber: { color: "#fff", fontSize: 20, fontFamily: "monospace", letterSpacing: 3, textAlign: "center" },
  cardBottom: { flexDirection: "row", justifyContent: "space-between" },
  label: { color: "#fff", fontSize: 12, opacity: 0.7 },
  valueDark: { color: "#fff", fontSize: 18, fontWeight: "600" },
  modalBg: { flex: 1, backgroundColor: "rgba(0,0,0,0.95)", justifyContent: "center", alignItems: "center" },
  closeBtn: { position: "absolute", top: 50, left: 20, zIndex: 10 },
  flipIcon: { position: "absolute", top: 50, right: 20, zIndex: 10 },
  modalCardWrapper: { width: height * 0.7, height: width * 0.88, transform: [{ rotate: "90deg" }] },
  fullCard: { position: "absolute", width: "100%", height: "100%", backfaceVisibility: "hidden" },
  fullCardBack: { transform: [{ rotateY: "180deg" }] },
  fullCardBg: { flex: 1, padding: 30, justifyContent: "space-between", borderRadius: 20, overflow: "hidden" },
  numberPlate: { alignSelf: "center", backgroundColor: "rgba(0, 0, 0, 0.08)", paddingVertical: 8, paddingHorizontal: 20, borderRadius: 12, marginTop: 10, minWidth: "80%", alignItems: "center", justifyContent: "center" },
  fullLogo: { width: 120, height: 60, alignSelf: "flex-end" },
  fullNumber: { color: "#fff", fontSize: 35, fontFamily: "monospace", letterSpacing: 7, textAlign: "center" },
  valueDarkModal: { color: "#fff", fontSize: 20, fontWeight: "700" },
  blackStrip: { height: 40, backgroundColor: "#000", marginTop: 15, borderRadius: 4 },
  cvvRow: { backgroundColor: "#fff", borderRadius: 6, flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 12, alignItems: "center", height: 40, marginTop: 30 },
  cvvLabel: { color: "#000", fontWeight: "700", fontSize: 14 },
  cvvValue: { color: "#000", fontWeight: "600", fontSize: 16 },
});
