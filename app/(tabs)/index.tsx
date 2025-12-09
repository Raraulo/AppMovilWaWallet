import { Ionicons } from "@expo/vector-icons";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
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
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import QRCode from "react-native-qrcode-svg";
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
  const [showQR, setShowQR] = useState(false);
  const [userData, setUserData] = useState<any>(null);

  // QR Receive Modal
  const [qrModalVisible, setQrModalVisible] = useState(false);

  // Camera permissions for QR scanner
  const [permission, requestPermission] = useCameraPermissions();
  const [scanning, setScanning] = useState(false);
  const [scanned, setScanned] = useState(false);

  // Transfer modal states
  const [transferVisible, setTransferVisible] = useState(false);
  const [recipientPhone, setRecipientPhone] = useState("");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [transferLoading, setTransferLoading] = useState(false);
  const [transferSuccess, setTransferSuccess] = useState(false);
  const [recipientName, setRecipientName] = useState("");
  const [scannedData, setScannedData] = useState<any>(null);

  // Copy feedback
  const [copied, setCopied] = useState(false);

  // Animations
  const flipAnim = useRef(new Animated.Value(0)).current;
  const modalAnim = useRef(new Animated.Value(0)).current;
  const qrModalAnim = useRef(new Animated.Value(0)).current;
  const transferModalAnim = useRef(new Animated.Value(0)).current;
  const successAnim = useRef(new Animated.Value(0)).current;
  const successScale = useRef(new Animated.Value(0)).current;
  const qrScale = useRef(new Animated.Value(0)).current;
  const copyAnim = useRef(new Animated.Value(0)).current;
  const scanLineAnim = useRef(new Animated.Value(0)).current;

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
    setShowQR(false);
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
    }).start(() => {
      setModalVisible(false);
      setShowQR(false);
      setFlipped(false);
      flipAnim.setValue(0);
    });
  };

  // Open QR Receive Modal
  const openQRModal = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setQrModalVisible(true);
    qrModalAnim.setValue(0);
    qrScale.setValue(0);
    Animated.parallel([
      Animated.timing(qrModalAnim, {
        toValue: 1,
        duration: 300,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.spring(qrScale, {
        toValue: 1,
        tension: 50,
        friction: 7,
        useNativeDriver: true,
      }),
    ]).start();
  };

  // Close QR Receive Modal
  const closeQRModal = async () => {
    Animated.timing(qrModalAnim, {
      toValue: 0,
      duration: 250,
      easing: Easing.in(Easing.ease),
      useNativeDriver: true,
    }).start(() => {
      setQrModalVisible(false);
    });
  };

  // Toggle QR view with animation
  const toggleQR = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setShowQR(!showQR);
    qrScale.setValue(0);
    Animated.spring(qrScale, {
      toValue: 1,
      tension: 50,
      friction: 7,
      useNativeDriver: true,
    }).start();
  };

  // Copy card number to clipboard
  const copyCardNumber = async () => {
    if (!card) return;
    await Clipboard.setStringAsync(card.numero);
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setCopied(true);

    copyAnim.setValue(0);
    Animated.sequence([
      Animated.timing(copyAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.delay(1500),
      Animated.timing(copyAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => setCopied(false));
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
      setScannedData(null);
      setScanning(false);
      setScanned(false);
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

    setTimeout(() => {
      closeTransferModal();
    }, 2500);
  };

  // Start scanning animation
  const startScanLineAnimation = () => {
    scanLineAnim.setValue(0);
    Animated.loop(
      Animated.sequence([
        Animated.timing(scanLineAnim, {
          toValue: 1,
          duration: 2000,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
        Animated.timing(scanLineAnim, {
          toValue: 0,
          duration: 2000,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
      ])
    ).start();
  };

  // Handle QR code scan
  const handleBarCodeScanned = async ({ data }: { data: string }) => {
    if (scanned) return;
    setScanned(true);
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    try {
      const parsed = JSON.parse(data);
      if (parsed.app === "WaWallet" && parsed.uid) {
        // ✅ Validar que no sea la misma cuenta
        if (parsed.uid === auth.currentUser?.uid) {
          Alert.alert("Error", "No puedes transferirte dinero a ti mismo");
          setScanned(false);
          setScanning(false);
          return;
        }
        setScannedData(parsed);
        setRecipientName(parsed.name || "Usuario");
        setScanning(false);
      } else {
        Alert.alert("Error", "Código QR no válido");
        setScanned(false);
      }
    } catch (error) {
      Alert.alert("Error", "No se pudo leer el código QR");
      setScanned(false);
    }
  };

  // Start QR scanner
  const startScanning = async () => {
    if (!permission?.granted) {
      const result = await requestPermission();
      if (!result.granted) {
        Alert.alert("Error", "Se necesita permiso de cámara");
        return;
      }
    }
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setScanning(true);
    setScanned(false);
    startScanLineAnimation();
  };

  // 🔥 ACTUALIZACIÓN EN TIEMPO REAL DEL BALANCE
  useEffect(() => {
    if (!auth.currentUser) return;

    const userRef = doc(db, "usuarios", auth.currentUser.uid);
    const unsubscribe = onSnapshot(
      userRef,
      (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          // ✅ Asegurar que balance nunca sea negativo
          setBalance(Math.max(0, data.balance ?? 0));
          setUserData(data);

          if (data.tarjeta) {
            setCard(data.tarjeta);
          } else {
            const newCard = generateCard(
              data.nombre ? `${data.nombre} ${data.apellido}` : ""
            );
            setDoc(userRef, { ...data, tarjeta: newCard }, { merge: true });
            setCard(newCard);
          }
        }
        setLoading(false);
      },
      (error) => {
        console.error("Error syncing user data:", error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  // Handle transfer (phone or QR)
  const handleTransfer = async () => {
    const transferAmount = parseFloat(amount);
    const recipientUid = scannedData?.uid || null;

    // ✅ Validaciones mejoradas
    if (!amount || amount.trim() === "") {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("Error", "Ingresa una cantidad");
      return;
    }

    if (isNaN(transferAmount) || transferAmount <= 0) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("Error", "Ingresa una cantidad válida mayor a 0");
      return;
    }

    if (transferAmount > balance) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("Error", "Saldo insuficiente");
      return;
    }

    if (!recipientUid && !recipientPhone.trim()) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("Error", "Ingresa un número de teléfono o escanea un QR");
      return;
    }

    setTransferLoading(true);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      let finalRecipientUid = recipientUid;
      let finalRecipientName = recipientName;

      if (!recipientUid) {
        const phone = recipientPhone.trim();
        const q = query(
          collection(db, "usuarios"),
          where("celular", "==", phone)
        );
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
          await Haptics.notificationAsync(
            Haptics.NotificationFeedbackType.Error
          );
          Alert.alert(
            "Error",
            "Usuario no encontrado con ese número de celular"
          );
          setTransferLoading(false);
          return;
        }

        finalRecipientUid = querySnapshot.docs[0].id;
        const recipientData = querySnapshot.docs[0].data();
        finalRecipientName = `${recipientData.nombre || ""} ${recipientData.apellido || ""
          }`.trim();
        setRecipientName(finalRecipientName);
      }

      // ✅ Validar que no sea transferencia a sí mismo
      if (finalRecipientUid === auth.currentUser!.uid) {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        Alert.alert("Error", "No puedes transferirte dinero a ti mismo");
        setTransferLoading(false);
        return;
      }

      const senderDoc = await getDoc(
        doc(db, "usuarios", auth.currentUser!.uid)
      );
      const senderData = senderDoc.data();
      const senderFullName = `${senderData?.nombre || ""} ${senderData?.apellido || ""
        }`.trim();

      await runTransaction(db, async (transaction) => {
        const senderRef = doc(db, "usuarios", auth.currentUser!.uid);
        const senderSnap = await transaction.get(senderRef);

        if (!senderSnap.exists()) throw new Error("Usuario no encontrado");

        const currentSenderData = senderSnap.data();
        const currentBalance = currentSenderData.balance ?? 0;

        // ✅ Doble verificación de saldo
        if (transferAmount > currentBalance)
          throw new Error("Saldo insuficiente");

        const recipientRef = doc(db, "usuarios", finalRecipientUid);
        const recipientSnap = await transaction.get(recipientRef);

        if (!recipientSnap.exists())
          throw new Error("Destinatario no encontrado");

        // ✅ Asegurar que el nuevo balance nunca sea negativo
        const newSenderBalance = Math.max(0, currentBalance - transferAmount);
        const newRecipientBalance = Math.max(
          0,
          (recipientSnap.data().balance ?? 0) + transferAmount
        );

        transaction.update(senderRef, {
          balance: newSenderBalance,
        });

        transaction.update(recipientRef, {
          balance: newRecipientBalance,
        });

        const senderTransactionRef = doc(
          collection(db, "usuarios", auth.currentUser!.uid, "transacciones")
        );

        transaction.set(senderTransactionRef, {
          tipo: "envio",
          monto: transferAmount,
          destinatario: finalRecipientName || recipientPhone,
          razon: reason || "Transferencia",
          fecha: new Date(),
          estado: "completado",
        });

        const recipientTransactionRef = doc(
          collection(db, "usuarios", finalRecipientUid, "transacciones")
        );

        transaction.set(recipientTransactionRef, {
          tipo: "recepcion",
          monto: transferAmount,
          remitente: senderFullName || "Usuario",
          razon: reason || "Transferencia",
          fecha: new Date(),
          estado: "completado",
        });
      });

      await Haptics.notificationAsync(
        Haptics.NotificationFeedbackType.Success
      );
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

  const formatBalance = (v: number) =>
    v.toLocaleString("es-EC", { minimumFractionDigits: 2 });

  const qrData = JSON.stringify({
    app: "WaWallet",
    uid: auth.currentUser?.uid,
    name: userData
      ? `${userData.nombre || ""} ${userData.apellido || ""}`.trim()
      : "Usuario",
  });

  const scanLineTranslate = scanLineAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 240],
  });

  if (loading)
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#fff" />
      </View>
    );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* Welcome Header - MEJORADO */}


      {/* Balance Card */}
      <TouchableOpacity
        style={styles.balanceCard}
        onPress={() => setShowBalance(!showBalance)}
        activeOpacity={0.8}
      >
        <View style={styles.balanceHeader}>
          <Text style={styles.balanceLabel}>Saldo Total</Text>
          <TouchableOpacity onPress={() => setShowBalance(!showBalance)}>
            <Ionicons
              name={showBalance ? "eye-off-outline" : "eye-outline"}
              size={20}
              color="rgba(255,255,255,0.7)"
            />
          </TouchableOpacity>
        </View>
        <Text style={styles.balanceAmount}>
          {showBalance ? `$ ${formatBalance(balance)}` : "*  *  *  *  *  *"}
        </Text>
        <View style={styles.balanceFooter}>
          <View style={styles.balanceChange}>
            <Ionicons name="shield-checkmark" size={14} color="#34C759" />
            <Text style={styles.balanceChangeText}>Cuenta verificada</Text>
          </View>
        </View>
      </TouchableOpacity>

      {/* MIS TARJETAS - NUEVO */}
      <Text style={styles.sectionTitle}>Mi Tarjeta Digital</Text>

      {/* CARD */}
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
          <View style={styles.cardOverlay} />
          <Image
            source={{
              uri: "https://upload.wikimedia.org/wikipedia/commons/5/5e/Visa_2021.svg",
            }}
            style={styles.logo}
            resizeMode="contain"
          />
          <Text style={styles.cardNumber} numberOfLines={1} ellipsizeMode="clip">
            {card.numero.slice(0, 4)} **** **** ****
          </Text>
          <View style={styles.cardBottom}>
            <View>
              <Text style={styles.label}>Titular</Text>
              <Text style={styles.valueDark}>{card.titular}</Text>
            </View>
            <View>
              <Text style={styles.label}>Vence</Text>
              <Text style={styles.valueDark}>{card.fechaExp}</Text>
            </View>
          </View>
        </ImageBackground>
      </TouchableOpacity>

      {/* Quick Actions Title */}
      <Text style={styles.sectionTitle}>Acciones Rápidas</Text>

      {/* ACTION BUTTONS */}
      <View style={styles.actionsContainer}>
        <TouchableOpacity
          style={[styles.actionButton, styles.transferButton]}
          onPress={openTransferModal}
          disabled={balance <= 0}
        >
          <View style={styles.actionIconWrapper}>
            <Ionicons name="paper-plane" size={24} color="#000" />
          </View>
          <Text style={styles.actionButtonText}>Enviar</Text>
          <Text style={styles.actionButtonSubtext}>Transferir dinero</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, styles.receiveButton]}
          onPress={openQRModal}
        >
          <View style={[styles.actionIconWrapper, styles.receiveIconWrapper]}>
            <Ionicons name="qr-code" size={24} color="#fff" />
          </View>
          <Text style={[styles.actionButtonText, { color: "#fff" }]}>
            Recibir
          </Text>
          <Text
            style={[
              styles.actionButtonSubtext,
              { color: "rgba(255,255,255,0.7)" },
            ]}
          >
            Mostrar QR
          </Text>
        </TouchableOpacity>
      </View>

      {/* QR RECEIVE MODAL */}
      <Modal visible={qrModalVisible} transparent animationType="none">
        <Animated.View
          style={[
            styles.qrReceiveModal,
            {
              opacity: qrModalAnim,
              transform: [
                {
                  scale: qrModalAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.95, 1],
                  }),
                },
              ],
            },
          ]}
        >
          <View style={styles.qrReceiveHeader}>
            <TouchableOpacity onPress={closeQRModal} style={styles.closeBtn}>
              <Ionicons name="close" size={30} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.qrReceiveTitle}>Mi Código QR</Text>
            <View style={{ width: 30 }} />
          </View>

          <Animated.View
            style={[
              styles.qrReceiveContent,
              { transform: [{ scale: qrScale }] },
            ]}
          >
            <View style={styles.qrWrapper}>
              <View style={styles.qrInner}>
                <QRCode value={qrData} size={240} backgroundColor="#fff" />
              </View>
              <View style={[styles.qrCorner, styles.qrCornerTL]} />
              <View style={[styles.qrCorner, styles.qrCornerTR]} />
              <View style={[styles.qrCorner, styles.qrCornerBL]} />
              <View style={[styles.qrCorner, styles.qrCornerBR]} />
            </View>

            <Text style={styles.qrReceiveName}>
              {userData
                ? `${userData.nombre || ""} ${userData.apellido || ""}`.trim()
                : "Usuario"}
            </Text>

            <View style={styles.qrInfoCard}>
              <Ionicons name="information-circle" size={20} color="#fff" />
              <Text style={styles.qrInfoText}>
                Comparte este código para recibir dinero de forma segura
              </Text>
            </View>
          </Animated.View>
        </Animated.View>
      </Modal>

      {/* TRANSFER MODAL */}
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
            <View style={styles.modalHeader}>
              <TouchableOpacity
                onPress={closeTransferModal}
                style={styles.modalCloseBtn}
              >
                <Ionicons name="close" size={28} color="#fff" />
              </TouchableOpacity>
              <Text style={styles.modalHeaderTitle}>Enviar Dinero</Text>
              <View style={{ width: 28 }} />
            </View>

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
                <Text style={styles.successTitle}>¡Transferencia Exitosa!</Text>
                <Text style={styles.successAmount}>${amount}</Text>
                <Text style={styles.successRecipient}>
                  Enviado a {recipientName || recipientPhone}
                </Text>
                {reason ? (
                  <Text style={styles.successReason}>"{reason}"</Text>
                ) : null}
              </Animated.View>
            ) : scanning ? (
              <View style={styles.scannerContainer}>
                <CameraView
                  style={styles.camera}
                  onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
                  barcodeScannerSettings={{
                    barcodeTypes: ["qr"],
                  }}
                >
                  <View style={styles.scanOverlay}>
                    <View style={styles.scanFrame}>
                      <Animated.View
                        style={[
                          styles.scanLine,
                          { transform: [{ translateY: scanLineTranslate }] },
                        ]}
                      />
                      <View style={[styles.scanCorner, styles.scanCornerTL]} />
                      <View style={[styles.scanCorner, styles.scanCornerTR]} />
                      <View style={[styles.scanCorner, styles.scanCornerBL]} />
                      <View style={[styles.scanCorner, styles.scanCornerBR]} />
                    </View>

                    <Text style={styles.scanText}>
                      Escanea el código QR del destinatario
                    </Text>

                    <TouchableOpacity
                      style={styles.cancelScanBtn}
                      onPress={() => {
                        setScanning(false);
                        setScanned(false);
                      }}
                    >
                      <Text style={styles.cancelScanText}>Cancelar</Text>
                    </TouchableOpacity>
                  </View>
                </CameraView>
              </View>
            ) : (
              <ScrollView
                style={styles.modalContent}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
              >
                {scannedData && (
                  <View style={styles.recipientCard}>
                    <Ionicons name="person-circle" size={60} color="#fff" />
                    <Text style={styles.recipientCardName}>
                      {recipientName}
                    </Text>
                    <TouchableOpacity
                      style={styles.changeRecipientBtn}
                      onPress={() => {
                        setScannedData(null);
                        setRecipientName("");
                      }}
                    >
                      <Text style={styles.changeRecipientText}>Cambiar</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {!scannedData && (
                  <TouchableOpacity
                    style={styles.qrScanBtn}
                    onPress={startScanning}
                  >
                    <Ionicons
                      name="qr-code-outline"
                      size={24}
                      color="#fff"
                      style={{ marginRight: 10 }}
                    />
                    <Text style={styles.qrScanText}>Escanear Código QR</Text>
                  </TouchableOpacity>
                )}

                {!scannedData && (
                  <View style={styles.divider}>
                    <View style={styles.dividerLine} />
                    <Text style={styles.dividerText}>o</Text>
                    <View style={styles.dividerLine} />
                  </View>
                )}

                {!scannedData && (
                  <View style={styles.inputSection}>
                    <Text style={styles.inputLabel}>Número de Teléfono</Text>
                    <View style={styles.inputWrapper}>
                      <Ionicons
                        name="call-outline"
                        size={20}
                        color="#888"
                        style={styles.inputIcon}
                      />
                      <TextInput
                        style={styles.textInput}
                        placeholder="Ingresa el número"
                        placeholderTextColor="#555"
                        keyboardType="phone-pad"
                        value={recipientPhone}
                        onChangeText={setRecipientPhone}
                      />
                    </View>
                  </View>
                )}

                <View style={styles.amountSection}>
                  <Text style={styles.amountLabel}>Cantidad</Text>
                  <View style={styles.amountInputContainer}>
                    <Text style={styles.currencySymbol}>$</Text>
                    <TextInput
                      style={styles.amountInput}
                      placeholder="0"
                      placeholderTextColor="#555"
                      keyboardType="decimal-pad"
                      value={amount}
                      onChangeText={setAmount}
                      maxLength={10}
                    />
                  </View>
                  <Text style={styles.availableBalance}>
                    Disponible: ${formatBalance(balance)}
                  </Text>
                </View>

                <View style={styles.inputSection}>
                  <Text style={styles.inputLabel}>Nota (opcional)</Text>
                  <View style={styles.inputWrapper}>
                    <Ionicons
                      name="chatbubble-outline"
                      size={20}
                      color="#888"
                      style={styles.inputIcon}
                    />
                    <TextInput
                      style={styles.textInput}
                      placeholder="¿Para qué es?"
                      placeholderTextColor="#555"
                      value={reason}
                      onChangeText={setReason}
                      maxLength={100}
                    />
                  </View>
                </View>
              </ScrollView>
            )}

            {!transferSuccess && !scanning && (
              <View style={styles.modalBottom}>
                <TouchableOpacity
                  style={[
                    styles.sendButton,
                    (transferLoading ||
                      !amount ||
                      (!scannedData && !recipientPhone)) &&
                    styles.sendButtonDisabled,
                  ]}
                  onPress={handleTransfer}
                  disabled={
                    transferLoading ||
                    !amount ||
                    (!scannedData && !recipientPhone)
                  }
                >
                  {transferLoading ? (
                    <ActivityIndicator color="#000" size="small" />
                  ) : (
                    <>
                      <Ionicons
                        name="send"
                        size={22}
                        color="#000"
                        style={{ marginRight: 8 }}
                      />
                      <Text style={styles.sendButtonText}>
                        Enviar ${amount || "0.00"}
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            )}
          </KeyboardAvoidingView>
        </Animated.View>
      </Modal>

      {/* CARD MODAL */}
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
          <View style={styles.modalTopBar}>
            <TouchableOpacity onPress={closeModal} style={styles.closeBtn}>
              <Ionicons name="close" size={30} color="#fff" />
            </TouchableOpacity>

            <View style={styles.modalActions}>
              {!showQR && (
                <TouchableOpacity onPress={flipCard} style={styles.actionBtn}>
                  <Ionicons
                    name={flipped ? "card" : "card-outline"}
                    size={24}
                    color="#fff"
                  />
                </TouchableOpacity>
              )}
            </View>
          </View>

          <TouchableOpacity
            activeOpacity={1}
            onPress={flipCard}
            style={styles.modalCardWrapper}
          >
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
                    <Text style={styles.label}>Titular</Text>
                    <Text style={styles.valueDarkModal}>{card.titular}</Text>
                  </View>
                  <View>
                    <Text style={styles.label}>Vence</Text>
                    <Text style={styles.valueDarkModal}>{card.fechaExp}</Text>
                  </View>
                </View>
              </ImageBackground>
            </Animated.View>

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
          </TouchableOpacity>

          {!flipped && (
            <View style={styles.copyContainer}>
              <TouchableOpacity
                style={styles.copyBtn}
                onPress={copyCardNumber}
              >
                <Ionicons
                  name={copied ? "checkmark" : "copy-outline"}
                  size={20}
                  color="#000"
                  style={{ marginRight: 8 }}
                />
                <Text style={styles.copyBtnText}>
                  {copied ? "¡Copiado!" : "Copiar Número"}
                </Text>
              </TouchableOpacity>

              <Animated.View
                style={[
                  styles.copyFeedback,
                  {
                    opacity: copyAnim,
                    transform: [
                      {
                        translateY: copyAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: [20, 0],
                        }),
                      },
                    ],
                  },
                ]}
              >
                <Ionicons name="checkmark-circle" size={20} color="#34C759" />
                <Text style={styles.copyFeedbackText}>
                  Número copiado al portapapeles
                </Text>
              </Animated.View>
            </View>
          )}
        </Animated.View>
      </Modal>
    </View>
  );
}

/* STYLES */
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0a0a0a",
    paddingHorizontal: 20,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: "#0a0a0a",
    alignItems: "center",
    justifyContent: "center",
  },

  // Welcome Header - MEJORADO
  welcomeHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: Platform.OS === "ios" ? 70 : 20,
    paddingBottom: 20,
  },
  userName: {
    fontSize: 28,
    color: "#fff",
    fontWeight: "800",
    marginBottom: 4,
    letterSpacing: 0.3,
  },
  welcomeSubtext: {
    fontSize: 14,
    color: "rgba(255,255,255,0.5)",
    fontWeight: "500",
    letterSpacing: 0.3,
  },

  // Balance Card
  balanceCard: {
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 24,
    padding: 20,
    marginTop: Platform.OS === 'ios' ? 70 : 30,  // ✅ AGREGA ESTA LÍNEA
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  balanceHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  balanceLabel: {
    fontSize: 13,
    color: "rgba(255,255,255,0.6)",
    fontWeight: "600",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  balanceAmount: {
    fontSize: 36,
    fontWeight: "800",
    color: "#fff",
    letterSpacing: 1,
    marginBottom: 12,
  },
  balanceFooter: {
    flexDirection: "row",
    alignItems: "center",
  },
  balanceChange: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(52, 199, 89, 0.15)",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    gap: 4,
  },
  balanceChangeText: {
    fontSize: 12,
    color: "#34C759",
    fontWeight: "600",
  },

  // Section Title
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#fff",
    marginBottom: 12,
    letterSpacing: 0.3,
  },

  // Card Styles
  cardContainer: {
    width: width * 0.9,
    height: 200,
    borderRadius: 24,
    overflow: "hidden",
    alignSelf: "center",
    marginBottom: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 10,
  },
  cardBg: {
    flex: 1,
    padding: 20,
    justifyContent: "space-between",
  },
  cardOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.15)",
    borderRadius: 24,
  },
  logo: {
    width: 70,
    height: 40,
    alignSelf: "flex-end",
    opacity: 0.95,
  },
  cardNumber: {
    color: "#fff",
    fontSize: 22,
    fontFamily: "monospace",
    letterSpacing: 3,
    textAlign: "center",
    fontWeight: "600",
    textShadowColor: "rgba(0,0,0,0.3)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  cardBottom: { flexDirection: "row", justifyContent: "space-between" },
  label: {
    color: "#fff",
    fontSize: 11,
    opacity: 0.7,
    marginBottom: 4,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  valueDark: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
    textShadowColor: "rgba(0,0,0,0.2)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },

  // Action Buttons
  actionsContainer: {
    flexDirection: "row",
    gap: 16,
    marginBottom: 20,
  },
  actionButton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 20,
    paddingVertical: 20,
    paddingHorizontal: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  transferButton: {
    backgroundColor: "#fff",
  },
  receiveButton: {
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
  },
  actionIconWrapper: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "rgba(0,0,0,0.08)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  receiveIconWrapper: {
    backgroundColor: "rgba(255,255,255,0.15)",
  },
  actionButtonText: {
    color: "#000",
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 0.3,
    marginBottom: 4,
  },
  actionButtonSubtext: {
    color: "rgba(0,0,0,0.6)",
    fontSize: 12,
    fontWeight: "500",
  },
  qrReceiveModal: {
    flex: 1,
    backgroundColor: "#000",
  },
  qrReceiveHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: Platform.OS === "ios" ? 60 : 40,
    paddingBottom: 20,
  },
  qrReceiveTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#fff",
    letterSpacing: 0.3,
  },
  qrReceiveContent: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 30,
  },
  qrWrapper: { position: "relative", marginBottom: 30 },
  qrInner: {
    backgroundColor: "#fff",
    padding: 20,
    borderRadius: 24,
    shadowColor: "#fff",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
  },
  qrCorner: {
    position: "absolute",
    width: 24,
    height: 24,
    borderColor: "#fff",
    borderWidth: 3,
  },
  qrCornerTL: {
    top: -8,
    left: -8,
    borderRightWidth: 0,
    borderBottomWidth: 0,
  },
  qrCornerTR: {
    top: -8,
    right: -8,
    borderLeftWidth: 0,
    borderBottomWidth: 0,
  },
  qrCornerBL: {
    bottom: -8,
    left: -8,
    borderRightWidth: 0,
    borderTopWidth: 0,
  },
  qrCornerBR: {
    bottom: -8,
    right: -8,
    borderLeftWidth: 0,
    borderTopWidth: 0,
  },
  qrReceiveName: {
    fontSize: 22,
    fontWeight: "700",
    color: "#fff",
    marginBottom: 30,
    textAlign: "center",
  },
  qrInfoCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.05)",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 16,
    gap: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  qrInfoText: { flex: 1, fontSize: 13, color: "#fff", lineHeight: 18 },
  fullScreenModal: { flex: 1, backgroundColor: "#000" },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: Platform.OS === "ios" ? 60 : 40,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#222",
  },
  modalCloseBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  modalHeaderTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#fff",
    letterSpacing: 0.3,
  },
  modalContent: { flex: 1, paddingHorizontal: 20, paddingTop: 20 },
  recipientCard: {
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.05)",
    padding: 24,
    borderRadius: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  recipientCardName: {
    fontSize: 20,
    fontWeight: "700",
    color: "#fff",
    marginTop: 12,
    marginBottom: 12,
  },
  changeRecipientBtn: {
    paddingVertical: 8,
    paddingHorizontal: 20,
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 12,
  },
  changeRecipientText: { fontSize: 14, fontWeight: "600", color: "#fff" },
  qrScanBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 16,
    paddingVertical: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
  },
  qrScanText: { fontSize: 16, fontWeight: "600", color: "#fff" },
  divider: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 20,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: "#333" },
  dividerText: {
    fontSize: 14,
    color: "#666",
    marginHorizontal: 16,
    fontWeight: "600",
  },
  inputSection: { marginBottom: 20 },
  inputLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#888",
    marginBottom: 8,
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 16,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  inputIcon: { marginRight: 12 },
  textInput: {
    flex: 1,
    fontSize: 16,
    color: "#fff",
    paddingVertical: 16,
    fontWeight: "500",
  },
  amountSection: {
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.05)",
    paddingVertical: 30,
    borderRadius: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  amountLabel: { fontSize: 14, color: "#888", marginBottom: 12 },
  amountInputContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  currencySymbol: {
    fontSize: 40,
    fontWeight: "700",
    color: "#fff",
    marginRight: 8,
  },
  amountInput: {
    fontSize: 48,
    fontWeight: "700",
    color: "#fff",
    minWidth: 100,
    textAlign: "center",
    padding: 0,
  },
  availableBalance: {
    fontSize: 13,
    color: "#888",
    marginTop: 12,
    fontWeight: "500",
  },
  modalBottom: {
    padding: 20,
    paddingBottom: Platform.OS === "ios" ? 34 : 20,
    borderTopWidth: 1,
    borderTopColor: "#222",
  },
  sendButton: {
    backgroundColor: "#fff",
    borderRadius: 16,
    paddingVertical: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  sendButtonDisabled: { backgroundColor: "#333" },
  sendButtonText: {
    color: "#000",
    fontSize: 18,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  successContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 40,
  },
  successCheckmark: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "#34C759",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 30,
  },
  successTitle: {
    fontSize: 28,
    fontWeight: "700",
    color: "#fff",
    marginBottom: 16,
  },
  successAmount: {
    fontSize: 48,
    fontWeight: "800",
    color: "#34C759",
    marginBottom: 12,
  },
  successRecipient: {
    fontSize: 18,
    color: "#888",
    fontWeight: "500",
    marginBottom: 8,
  },
  successReason: {
    fontSize: 16,
    color: "#666",
    fontStyle: "italic",
    marginTop: 8,
    textAlign: "center",
  },
  scannerContainer: { flex: 1 },
  camera: { flex: 1 },
  scanOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    alignItems: "center",
    justifyContent: "center",
  },
  scanFrame: {
    width: 240,
    height: 240,
    position: "relative",
    backgroundColor: "transparent",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.3)",
    borderRadius: 20,
  },
  scanLine: {
    position: "absolute",
    width: "100%",
    height: 3,
    backgroundColor: "#fff",
    shadowColor: "#fff",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 10,
  },
  scanCorner: {
    position: "absolute",
    width: 30,
    height: 30,
    borderColor: "#fff",
    borderWidth: 4,
  },
  scanCornerTL: {
    top: -2,
    left: -2,
    borderRightWidth: 0,
    borderBottomWidth: 0,
    borderTopLeftRadius: 20,
  },
  scanCornerTR: {
    top: -2,
    right: -2,
    borderLeftWidth: 0,
    borderBottomWidth: 0,
    borderTopRightRadius: 20,
  },
  scanCornerBL: {
    bottom: -2,
    left: -2,
    borderRightWidth: 0,
    borderTopWidth: 0,
    borderBottomLeftRadius: 20,
  },
  scanCornerBR: {
    bottom: -2,
    right: -2,
    borderLeftWidth: 0,
    borderTopWidth: 0,
    borderBottomRightRadius: 20,
  },
  scanText: {
    fontSize: 16,
    color: "#fff",
    marginTop: 30,
    textAlign: "center",
    fontWeight: "600",
  },
  cancelScanBtn: {
    marginTop: 40,
    paddingVertical: 12,
    paddingHorizontal: 30,
    backgroundColor: "rgba(255,255,255,0.2)",
    borderRadius: 12,
  },
  cancelScanText: { fontSize: 16, color: "#fff", fontWeight: "600" },
  modalBg: {
    flex: 1,
    backgroundColor: "#000",
    justifyContent: "center",
    alignItems: "center",
  },
  modalTopBar: {
    position: "absolute",
    top: Platform.OS === "ios" ? 60 : 40,
    left: 20,
    right: 20,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    zIndex: 10,
  },
  closeBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  modalActions: { flexDirection: "row", gap: 12 },
  actionBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  modalCardWrapper: {
    width: height * 0.65,
    height: width * 0.85,
    transform: [{ rotate: "90deg" }],
  },
  fullCard: {
    position: "absolute",
    width: "100%",
    height: "100%",
    backfaceVisibility: "hidden",
  },
  fullCardBack: { transform: [{ rotateY: "180deg" }] },
  fullCardBg: {
    flex: 1,
    padding: 30,
    justifyContent: "space-between",
    borderRadius: 20,
    overflow: "hidden",
  },
  numberPlate: {
    alignSelf: "center",
    backgroundColor: "rgba(0, 0, 0, 0.15)",
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 16,
    marginTop: 20,
    minWidth: "85%",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  fullLogo: { width: 120, height: 60, alignSelf: "flex-end" },
  fullNumber: {
    color: "#fff",
    fontSize: 32,
    fontFamily: "monospace",
    letterSpacing: 6,
    textAlign: "center",
    fontWeight: "600",
  },
  valueDarkModal: { color: "#fff", fontSize: 18, fontWeight: "700" },
  blackStrip: {
    height: 50,
    backgroundColor: "#000",
    marginTop: 20,
    borderRadius: 6,
  },
  cvvRow: {
    backgroundColor: "#fff",
    borderRadius: 8,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    alignItems: "center",
    height: 45,
    marginTop: 40,
  },
  cvvLabel: { color: "#000", fontWeight: "700", fontSize: 14 },
  cvvValue: { color: "#000", fontWeight: "600", fontSize: 18 },
  copyContainer: {
    position: "absolute",
    bottom: Platform.OS === "ios" ? 60 : 40,
    alignSelf: "center",
    alignItems: "center",
  },
  copyBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 16,
  },
  copyBtnText: { fontSize: 16, fontWeight: "700", color: "#000" },
  copyFeedback: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(52, 199, 89, 0.2)",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginTop: 12,
    gap: 8,
    borderWidth: 1,
    borderColor: "#34C759",
  },
  copyFeedbackText: { fontSize: 13, color: "#34C759", fontWeight: "600" },
});
