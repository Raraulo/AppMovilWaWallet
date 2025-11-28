import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Easing,
  Image,
  Keyboard,
  Platform,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
import { loginUser, registerUser } from "../utils/authService";

const { width, height } = Dimensions.get("window");

// 🔥 TOAST FLOTANTE PREMIUM
const Toast = ({
  message,
  type,
  visible,
  onHide,
}: {
  message: string;
  type: "success" | "error" | "info" | "warning";
  visible: boolean;
  onHide: () => void;
}) => {
  const translateY = useRef(new Animated.Value(-100)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(translateY, {
          toValue: 0,
          tension: 50,
          friction: 8,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();

      const timer = setTimeout(() => {
        Animated.parallel([
          Animated.timing(translateY, {
            toValue: -100,
            duration: 200,
            useNativeDriver: true,
          }),
          Animated.timing(opacity, {
            toValue: 0,
            duration: 200,
            useNativeDriver: true,
          }),
        ]).start(() => onHide());
      }, 3500);

      return () => clearTimeout(timer);
    }
  }, [visible]);

  if (!visible) return null;

  const colors = {
    success: ["#34C759", "#2ecc71"],
    error: ["#ff4757", "#ff6348"],
    info: ["#5f27cd", "#341f97"],
    warning: ["#ffa502", "#ff6348"],
  };

  const icons = {
    success: "checkmark-circle",
    error: "close-circle",
    info: "information-circle",
    warning: "warning",
  };

  return (
    <Animated.View
      style={[
        styles.toastContainer,
        {
          transform: [{ translateY }],
          opacity,
        },
      ]}
    >
      <LinearGradient
        colors={colors[type]}
        style={styles.toastGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <Ionicons name={icons[type] as any} size={24} color="#fff" />
        <Text style={styles.toastText}>{message}</Text>
      </LinearGradient>
    </Animated.View>
  );
};

// 🔥 TRADUCTOR DE ERRORES FIREBASE
const getFirebaseErrorMessage = (errorCode: string): string => {
  const errorMessages: { [key: string]: string } = {
    "auth/invalid-email": "El correo electrónico no es válido",
    "auth/user-disabled": "Esta cuenta ha sido deshabilitada",
    "auth/user-not-found": "No existe una cuenta con este correo",
    "auth/wrong-password": "Contraseña incorrecta",
    "auth/email-already-in-use": "Este correo ya está registrado",
    "auth/weak-password": "La contraseña debe tener al menos 6 caracteres",
    "auth/invalid-credential": "Credenciales incorrectas. Verifica tu correo y contraseña",
    "auth/too-many-requests": "Demasiados intentos fallidos. Intenta más tarde",
    "auth/network-request-failed": "Error de conexión. Verifica tu internet",
    "auth/operation-not-allowed": "Operación no permitida",
    "auth/requires-recent-login": "Por seguridad, vuelve a iniciar sesión",
    "auth/internal-error": "Error interno. Intenta nuevamente",
  };

  return errorMessages[errorCode] || "Ocurrió un error inesperado";
};

// Lista de dominios de email temporales/desechables
const DISPOSABLE_EMAIL_DOMAINS = [
  "tempmail.com",
  "throwaway.email",
  "guerrillamail.com",
  "mailinator.com",
  "10minutemail.com",
  "trashmail.com",
  "yopmail.com",
  "temp-mail.org",
];

export default function LoginScreen() {
  const [nombre, setNombre] = useState("");
  const [apellido, setApellido] = useState("");
  const [email, setEmail] = useState("");
  const [celular, setCelular] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isRegister, setIsRegister] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showSplash, setShowSplash] = useState(true);
  const [showWelcome, setShowWelcome] = useState(false);
  const [loading, setLoading] = useState(false);
  const [welcomeStep, setWelcomeStep] = useState(0);

  // 🔥 TOAST STATE
  const [toast, setToast] = useState({
    visible: false,
    message: "",
    type: "info" as "success" | "error" | "info" | "warning",
  });

  const showToast = (
    message: string,
    type: "success" | "error" | "info" | "warning"
  ) => {
    setToast({ visible: true, message, type });
    Haptics.notificationAsync(
      type === "success"
        ? Haptics.NotificationFeedbackType.Success
        : type === "error"
          ? Haptics.NotificationFeedbackType.Error
          : Haptics.NotificationFeedbackType.Warning
    );
  };

  // Animations
  const splashOpacity = useRef(new Animated.Value(0)).current;
  const splashScale = useRef(new Animated.Value(0.95)).current;
  const welcomeOpacity = useRef(new Animated.Value(0)).current;
  const welcomeTranslateX = useRef(new Animated.Value(50)).current;
  const contentOpacity = useRef(new Animated.Value(0)).current;
  const contentTranslateY = useRef(new Animated.Value(30)).current;
  const formTranslateY = useRef(new Animated.Value(0)).current;

  // 🔥 VALIDACIONES MEJORADAS
  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(email)) return false;

    const domain = email.split("@")[1]?.toLowerCase();
    if (DISPOSABLE_EMAIL_DOMAINS.includes(domain)) {
      showToast(
        "No se permiten correos temporales. Usa un email permanente",
        "warning"
      );
      return false;
    }

    return true;
  };

  const validatePhone = (phone: string): boolean => {
    const cleanPhone = phone.replace(/[\s\-\(\)]/g, "");
    const phoneRegex = /^\d{10}$/;
    return phoneRegex.test(cleanPhone);
  };

  const validateName = (name: string): boolean => {
    const nameRegex = /^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/;
    if (!nameRegex.test(name)) {
      showToast("El nombre solo puede contener letras y espacios", "warning");
      return false;
    }
    if (name.trim().length < 2) {
      showToast("El nombre debe tener al menos 2 caracteres", "warning");
      return false;
    }
    return true;
  };

  const validatePassword = (
    password: string
  ): { valid: boolean; message?: string } => {
    if (password.length < 8) {
      return {
        valid: false,
        message: "La contraseña debe tener al menos 8 caracteres",
      };
    }
    if (!/[A-Z]/.test(password)) {
      return {
        valid: false,
        message: "Debe contener al menos una mayúscula",
      };
    }
    if (!/[a-z]/.test(password)) {
      return {
        valid: false,
        message: "Debe contener al menos una minúscula",
      };
    }
    if (!/[0-9]/.test(password)) {
      return { valid: false, message: "Debe contener al menos un número" };
    }
    if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
      return {
        valid: false,
        message: "Debe contener al menos un carácter especial",
      };
    }
    return { valid: true };
  };

  // Password strength indicator
  const getPasswordStrength = () => {
    if (!password) return null;

    const checks = {
      length: password.length >= 8,
      upper: /[A-Z]/.test(password),
      lower: /[a-z]/.test(password),
      number: /[0-9]/.test(password),
      special: /[!@#$%^&*(),.?":{}|<>]/.test(password),
    };

    const score = Object.values(checks).filter(Boolean).length;

    if (score <= 2) return { level: 1, label: "Débil", color: "#ef4444" };
    if (score <= 3) return { level: 2, label: "Media", color: "#f59e0b" };
    if (score <= 4) return { level: 3, label: "Buena", color: "#10b981" };
    return { level: 4, label: "Excelente", color: "#10b981" };
  };

  const strength = getPasswordStrength();

  // Check if welcome screen should be shown
  useEffect(() => {
    checkFirstLaunch();
  }, []);

  const checkFirstLaunch = async () => {
    try {
      const hasLaunched = await AsyncStorage.getItem("hasLaunched");
      if (!hasLaunched) {
        setShowWelcome(true);
      }
    } catch (error) {
      console.error("Error checking first launch:", error);
    }
  };

  // Splash animation
  useEffect(() => {
    Animated.parallel([
      Animated.timing(splashOpacity, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.spring(splashScale, {
        toValue: 1,
        tension: 40,
        friction: 8,
        useNativeDriver: true,
      }),
    ]).start();

    const timer = setTimeout(() => {
      Animated.timing(splashOpacity, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
      }).start(() => {
        setShowSplash(false);
      });
    }, 2000);

    return () => clearTimeout(timer);
  }, []);

  // Welcome screen animation
  useEffect(() => {
    if (showWelcome && !showSplash) {
      Animated.parallel([
        Animated.timing(welcomeOpacity, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.timing(welcomeTranslateX, {
          toValue: 0,
          duration: 600,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [showWelcome, showSplash]);

  // Content entrance animation
  useEffect(() => {
    if (!showSplash && !showWelcome) {
      Animated.parallel([
        Animated.timing(contentOpacity, {
          toValue: 1,
          duration: 600,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(contentTranslateY, {
          toValue: 0,
          duration: 600,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [showSplash, showWelcome]);

  // Keyboard handling
  useEffect(() => {
    const showSubscription = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow",
      (e) => {
        Animated.timing(formTranslateY, {
          toValue: -e.endCoordinates.height / 4,
          duration: 250,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }).start();
      }
    );

    const hideSubscription = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide",
      () => {
        Animated.timing(formTranslateY, {
          toValue: 0,
          duration: 250,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }).start();
      }
    );

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

  // Handle welcome screen completion
  const handleWelcomeNext = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    if (welcomeStep < 2) {
      setWelcomeStep(welcomeStep + 1);
      Animated.sequence([
        Animated.timing(welcomeOpacity, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(welcomeOpacity, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      await AsyncStorage.setItem("hasLaunched", "true");
      Animated.timing(welcomeOpacity, {
        toValue: 0,
        duration: 400,
        useNativeDriver: true,
      }).start(() => {
        setShowWelcome(false);
      });
    }
  };

  // 🔥 HANDLE AUTH CON VALIDACIONES COMPLETAS
  const handleAuth = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    // Validación de campos vacíos
    if (isRegister) {
      if (
        !nombre ||
        !apellido ||
        !email ||
        !celular ||
        !password ||
        !confirmPassword
      ) {
        showToast("Por favor completa todos los campos", "warning");
        return;
      }

      if (!validateName(nombre) || !validateName(apellido)) {
        return;
      }

      if (!validatePhone(celular)) {
        showToast(
          "Ingresa un número válido de 10 dígitos (ej: 0986503709)",
          "warning"
        );
        return;
      }
    } else {
      if (!email || !password) {
        showToast("Ingresa tu correo y contraseña", "warning");
        return;
      }
    }

    // Validar email
    if (!validateEmail(email)) {
      showToast("Ingresa un correo electrónico válido", "warning");
      return;
    }

    // Validar contraseña
    if (isRegister) {
      const passwordValidation = validatePassword(password);
      if (!passwordValidation.valid) {
        showToast(passwordValidation.message || "Contraseña débil", "warning");
        return;
      }

      if (password !== confirmPassword) {
        showToast("Las contraseñas no coinciden", "warning");
        return;
      }
    }

    try {
      setLoading(true);

      if (isRegister) {
        await registerUser(email, password, nombre, apellido, celular);
        showToast("¡Cuenta creada exitosamente!", "success");
      } else {
        await loginUser(email, password);
        showToast("¡Bienvenido de vuelta!", "success");
      }

      await Haptics.notificationAsync(
        Haptics.NotificationFeedbackType.Success
      );

      setTimeout(() => {
        router.replace("/(tabs)");
      }, 1000);
    } catch (error: any) {
      const friendlyMessage = getFirebaseErrorMessage(error.code);
      showToast(friendlyMessage, "error");
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setLoading(false);
    }
  };

  // Toggle between login and register
  const toggleRegister = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsRegister(!isRegister);
  };

  const togglePasswordVisibility = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setShowPassword(!showPassword);
  };

  const toggleConfirmPasswordVisibility = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setShowConfirmPassword(!showConfirmPassword);
  };

  // Splash Screen
  if (showSplash) {
    return (
      <View style={styles.splashContainer}>
        <StatusBar barStyle="light-content" backgroundColor="#000000" />
        <Animated.View
          style={[
            styles.splashContent,
            {
              opacity: splashOpacity,
              transform: [{ scale: splashScale }],
            },
          ]}
        >
          <Image
            source={require("../assets/images/logowawallet.png")}
            style={styles.splashLogo}
            resizeMode="contain"
          />
          <ActivityIndicator
            size="large"
            color="#fff"
            style={styles.splashLoader}
          />
        </Animated.View>
      </View>
    );
  }

  // Welcome Screen
  const welcomeScreens = [
    {
      title: "Bienvenido a WaWallet",
      subtitle: "Tu billetera digital segura y confiable",
      icon: "wallet-outline",
    },
    {
      title: "Pagos Seguros",
      subtitle: "Realiza transacciones con total seguridad y encriptación",
      icon: "shield-checkmark-outline",
    },
    {
      title: "Control Total",
      subtitle: "Gestiona tu dinero desde cualquier lugar",
      icon: "analytics-outline",
    },
  ];

  if (showWelcome) {
    const currentScreen = welcomeScreens[welcomeStep];
    return (
      <View style={styles.welcomeContainer}>
        <StatusBar barStyle="light-content" backgroundColor="#000000" />
        <Animated.View
          style={[
            styles.welcomeContent,
            {
              opacity: welcomeOpacity,
              transform: [{ translateX: welcomeTranslateX }],
            },
          ]}
        >
          <Image
            source={require("../assets/images/logowawallet.png")}
            style={styles.welcomeLogo}
            resizeMode="contain"
          />

          <View style={styles.welcomeIconContainer}>
            <Ionicons name={currentScreen.icon as any} size={80} color="#fff" />
          </View>

          <Text style={styles.welcomeTitle}>{currentScreen.title}</Text>
          <Text style={styles.welcomeSubtitle}>{currentScreen.subtitle}</Text>

          <View style={styles.welcomeDotsContainer}>
            {welcomeScreens.map((_, index) => (
              <View
                key={index}
                style={[
                  styles.welcomeDot,
                  index === welcomeStep && styles.welcomeDotActive,
                ]}
              />
            ))}
          </View>

          <TouchableOpacity
            style={styles.welcomeButton}
            onPress={handleWelcomeNext}
            activeOpacity={0.9}
          >
            <Text style={styles.welcomeButtonText}>
              {welcomeStep < 2 ? "Siguiente" : "Comenzar"}
            </Text>
          </TouchableOpacity>

          {welcomeStep === 0 && (
            <TouchableOpacity
              style={styles.welcomeSkip}
              onPress={async () => {
                await AsyncStorage.setItem("hasLaunched", "true");
                setShowWelcome(false);
              }}
            >
              <Text style={styles.welcomeSkipText}>Saltar</Text>
            </TouchableOpacity>
          )}
        </Animated.View>
      </View>
    );
  }

  // Main Login/Register Screen
  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#000000" />

      {/* 🔥 TOAST FLOTANTE */}
      <Toast
        message={toast.message}
        type={toast.type}
        visible={toast.visible}
        onHide={() => setToast({ ...toast, visible: false })}
      />

      <KeyboardAwareScrollView
        contentContainerStyle={styles.scrollContent}
        enableOnAndroid={true}
        extraScrollHeight={Platform.OS === "ios" ? 20 : 40}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Animated.View
          style={[
            styles.content,
            {
              opacity: contentOpacity,
              transform: [
                { translateY: contentTranslateY },
                { translateY: formTranslateY },
              ],
            },
          ]}
        >
          {/* Header */}
          <View style={styles.header}>
            <Image
              source={require("../assets/images/logowawallet.png")}
              style={styles.logo}
              resizeMode="contain"
            />
            <Text style={styles.title}>
              {isRegister ? "Crear Cuenta" : "Bienvenido de Vuelta"}
            </Text>
            <Text style={styles.subtitle}>
              {isRegister
                ? "Únete a la comunidad WaWallet"
                : "Accede a tu cuenta de forma segura"}
            </Text>
          </View>

          {/* Form */}
          <View style={styles.form}>
            {/* Register Fields */}
            {isRegister && (
              <>
                <View style={styles.inputRow}>
                  <View style={styles.inputWrapper}>
                    <Text style={styles.label}>Nombre</Text>
                    <View style={styles.inputContainer}>
                      <Ionicons name="person-outline" size={18} color="#666" />
                      <TextInput
                        style={styles.input}
                        value={nombre}
                        onChangeText={setNombre}
                        placeholder="Juan"
                        placeholderTextColor="#555"
                        autoCapitalize="words"
                      />
                    </View>
                  </View>

                  <View style={styles.inputWrapper}>
                    <Text style={styles.label}>Apellido</Text>
                    <View style={styles.inputContainer}>
                      <Ionicons name="person-outline" size={18} color="#666" />
                      <TextInput
                        style={styles.input}
                        value={apellido}
                        onChangeText={setApellido}
                        placeholder="Pérez"
                        placeholderTextColor="#555"
                        autoCapitalize="words"
                      />
                    </View>
                  </View>
                </View>

                <View style={styles.inputWrapper}>
                  <Text style={styles.label}>Teléfono</Text>
                  <View style={styles.inputContainer}>
                    <Ionicons name="call-outline" size={18} color="#666" />
                    <TextInput
                      style={styles.input}
                      keyboardType="phone-pad"
                      value={celular}
                      onChangeText={setCelular}
                      placeholder="0986503709"
                      placeholderTextColor="#555"
                      maxLength={10}
                    />
                  </View>
                </View>
              </>
            )}

            {/* Email */}
            <View style={styles.inputWrapper}>
              <Text style={styles.label}>Correo Electrónico</Text>
              <View style={styles.inputContainer}>
                <Ionicons name="mail-outline" size={18} color="#666" />
                <TextInput
                  style={styles.input}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  value={email}
                  onChangeText={setEmail}
                  placeholder="correo@ejemplo.com"
                  placeholderTextColor="#555"
                />
              </View>
            </View>

            {/* Password */}
            <View style={styles.inputWrapper}>
              <Text style={styles.label}>Contraseña</Text>
              <View style={styles.inputContainer}>
                <Ionicons name="lock-closed-outline" size={18} color="#666" />
                <TextInput
                  style={styles.input}
                  secureTextEntry={!showPassword}
                  value={password}
                  onChangeText={setPassword}
                  placeholder="Mínimo 8 caracteres"
                  placeholderTextColor="#555"
                />
                <TouchableOpacity
                  onPress={togglePasswordVisibility}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Ionicons
                    name={showPassword ? "eye-off-outline" : "eye-outline"}
                    size={18}
                    color="#666"
                  />
                </TouchableOpacity>
              </View>

              {/* Password Strength */}
              {isRegister && strength && (
                <View style={styles.strengthContainer}>
                  <View style={styles.strengthBars}>
                    {[1, 2, 3, 4].map((level) => (
                      <View
                        key={level}
                        style={[
                          styles.strengthBar,
                          level <= strength.level && {
                            backgroundColor: strength.color,
                          },
                        ]}
                      />
                    ))}
                  </View>
                  <Text
                    style={[styles.strengthText, { color: strength.color }]}
                  >
                    {strength.label}
                  </Text>
                </View>
              )}
            </View>

            {/* Confirm Password */}
            {isRegister && (
              <View style={styles.inputWrapper}>
                <Text style={styles.label}>Confirmar Contraseña</Text>
                <View style={styles.inputContainer}>
                  <Ionicons name="lock-closed-outline" size={18} color="#666" />
                  <TextInput
                    style={styles.input}
                    secureTextEntry={!showConfirmPassword}
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    placeholder="Repite tu contraseña"
                    placeholderTextColor="#555"
                  />
                  <TouchableOpacity
                    onPress={toggleConfirmPasswordVisibility}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Ionicons
                      name={
                        showConfirmPassword ? "eye-off-outline" : "eye-outline"
                      }
                      size={18}
                      color="#666"
                    />
                  </TouchableOpacity>
                </View>

                {confirmPassword.length > 0 && (
                  <View style={styles.matchContainer}>
                    <Ionicons
                      name={
                        password === confirmPassword
                          ? "checkmark-circle"
                          : "close-circle"
                      }
                      size={14}
                      color={
                        password === confirmPassword ? "#10b981" : "#ef4444"
                      }
                    />
                    <Text
                      style={[
                        styles.matchText,
                        {
                          color:
                            password === confirmPassword
                              ? "#10b981"
                              : "#ef4444",
                        },
                      ]}
                    >
                      {password === confirmPassword
                        ? "Las contraseñas coinciden"
                        : "Las contraseñas no coinciden"}
                    </Text>
                  </View>
                )}
              </View>
            )}

            {/* Submit Button */}
            <TouchableOpacity
              style={[
                styles.submitButton,
                loading && styles.submitButtonDisabled,
              ]}
              onPress={handleAuth}
              disabled={loading}
              activeOpacity={0.9}
            >
              {loading ? (
                <ActivityIndicator color="#000" size="small" />
              ) : (
                <Text style={styles.submitText}>
                  {isRegister ? "Crear Cuenta" : "Iniciar Sesión"}
                </Text>
              )}
            </TouchableOpacity>

            {/* Toggle */}
            <TouchableOpacity
              onPress={toggleRegister}
              style={styles.toggleContainer}
              activeOpacity={0.7}
            >
              <Text style={styles.toggleText}>
                {isRegister ? "¿Ya tienes cuenta?" : "¿No tienes cuenta?"}{" "}
                <Text style={styles.toggleTextBold}>
                  {isRegister ? "Inicia Sesión" : "Regístrate"}
                </Text>
              </Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </KeyboardAwareScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  // Splash
  splashContainer: {
    flex: 1,
    backgroundColor: "#000000",
    justifyContent: "center",
    alignItems: "center",
  },
  splashContent: {
    alignItems: "center",
  },
  splashLogo: {
    width: 180,
    height: 180,
  },
  splashLoader: {
    marginTop: 40,
  },

  // Welcome Screen
  welcomeContainer: {
    flex: 1,
    backgroundColor: "#000000",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
  },
  welcomeContent: {
    alignItems: "center",
    width: "100%",
  },
  welcomeLogo: {
    width: 100,
    height: 100,
    marginBottom: 40,
  },
  welcomeIconContainer: {
    marginBottom: 32,
  },
  welcomeTitle: {
    fontSize: 28,
    fontWeight: "800",
    color: "#ffffff",
    textAlign: "center",
    marginBottom: 12,
    letterSpacing: -0.5,
  },
  welcomeSubtitle: {
    fontSize: 16,
    color: "#888",
    textAlign: "center",
    fontWeight: "500",
    lineHeight: 24,
    paddingHorizontal: 20,
  },
  welcomeDotsContainer: {
    flexDirection: "row",
    gap: 8,
    marginTop: 48,
    marginBottom: 32,
  },
  welcomeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#333",
  },
  welcomeDotActive: {
    backgroundColor: "#ffffff",
    width: 24,
  },
  welcomeButton: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 48,
    width: "100%",
    alignItems: "center",
  },
  welcomeButtonText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#000000",
    letterSpacing: 0.3,
  },
  welcomeSkip: {
    marginTop: 20,
    paddingVertical: 12,
  },
  welcomeSkipText: {
    fontSize: 15,
    color: "#666",
    fontWeight: "600",
  },

  // Main
  container: {
    flex: 1,
    backgroundColor: "#000000",
  },
  scrollContent: {
    flexGrow: 1,
    paddingTop: Platform.OS === "ios" ? 60 : 40,
    paddingBottom: 40,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
  },

  // 🔥 TOAST STYLES
  toastContainer: {
    position: "absolute",
    top: Platform.OS === "ios" ? 60 : 40,
    left: 20,
    right: 20,
    zIndex: 9999,
    borderRadius: 16,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  toastGradient: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 12,
  },
  toastText: {
    flex: 1,
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
    lineHeight: 20,
  },

  // Header
  header: {
    alignItems: "center",
    marginBottom: 48,
  },
  logo: {
    width: 200,
    height: 200,
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    color: "#ffffff",
    marginBottom: 8,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 15,
    color: "#888",
    fontWeight: "500",
    textAlign: "center",
  },

  // Form
  form: {
    gap: 20,
  },
  inputRow: {
    flexDirection: "row",
    gap: 12,
  },
  inputWrapper: {
    flex: 1,
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
    color: "#ffffff",
    marginBottom: 8,
    letterSpacing: 0.3,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#0f0f0f",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#222",
    paddingHorizontal: 14,
    height: 52,
    gap: 10,
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: "#ffffff",
    fontWeight: "500",
  },

  // Password Strength
  strengthContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
    gap: 10,
  },
  strengthBars: {
    flexDirection: "row",
    gap: 4,
    flex: 1,
  },
  strengthBar: {
    flex: 1,
    height: 3,
    backgroundColor: "#222",
    borderRadius: 2,
  },
  strengthText: {
    fontSize: 12,
    fontWeight: "600",
  },

  // Password Match
  matchContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
    gap: 6,
  },
  matchText: {
    fontSize: 12,
    fontWeight: "600",
  },

  // Submit
  submitButton: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    height: 54,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 12,
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#000000",
    letterSpacing: 0.3,
  },

  // Toggle
  toggleContainer: {
    alignItems: "center",
    paddingVertical: 16,
  },
  toggleText: {
    fontSize: 14,
    color: "#888",
    fontWeight: "500",
  },
  toggleTextBold: {
    color: "#ffffff",
    fontWeight: "700",
  },
});
