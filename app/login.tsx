import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Image,
  Keyboard,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
import { loginUser, registerUser } from "../utils/authService";


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
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [toastType, setToastType] = useState("");


  const cardTranslateY = useRef(new Animated.Value(0)).current;
  const toastOpacity = useRef(new Animated.Value(0)).current;


  useEffect(() => {
    const timer = setTimeout(() => {
      setShowSplash(false);
    }, 3000);

    return () => clearTimeout(timer);
  }, []);


  useEffect(() => {
    if (showSuccessToast) {
      Animated.sequence([
        Animated.timing(toastOpacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.delay(2000),
        Animated.timing(toastOpacity, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start(({ finished }) => {
        if (finished) {
          setShowSuccessToast(false);
          router.replace("/(tabs)");
        }
      });
    }
  }, [showSuccessToast]);


  useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow",
      (e) => {
        Animated.timing(cardTranslateY, {
          toValue: -e.endCoordinates.height + 50,
          duration: 250,
          useNativeDriver: true,
        }).start();
      }
    );
    const keyboardDidHideListener = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide",
      () => {
        Animated.timing(cardTranslateY, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        }).start();
      }
    );

    return () => {
      keyboardDidHideListener?.remove();
      keyboardDidShowListener?.remove();
    };
  }, []);


  const handleAuth = async () => {
    if (isRegister && (!email || !password || !confirmPassword || !nombre || !apellido || !celular)) {
      Alert.alert("Error", "Completa todos los campos");
      return;
    }
    if (!isRegister && (!email || !password)) {
      Alert.alert("Error", "Completa el correo y la contraseña");
      return;
    }

    if (isRegister && password !== confirmPassword) {
      Alert.alert("Error", "Las contraseñas no coinciden");
      return;
    }

    try {
      if (isRegister) {
        await registerUser(email, password, nombre, apellido, celular);
        setToastMessage("Cuenta creada correctamente");
        setToastType("success");
      } else {
        await loginUser(email, password);
        setToastMessage("Inicio de sesión correcto cargando...");
        setToastType("welcome");
      }
      setShowSuccessToast(true);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Error desconocido";
      Alert.alert("Error", errorMessage);
    }
  };


  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };


  const toggleConfirmPasswordVisibility = () => {
    setShowConfirmPassword(!showConfirmPassword);
  };


  if (showSplash) {
    return (
      <View style={styles.splashContainer}>
        <Image
          source={require("../assets/images/logowawallet.png")}
          style={styles.splashLogo}
          resizeMode="contain"
        />
        <ActivityIndicator
          size="large"
          color="#ffffffff"
          style={styles.loadingIndicator}
        />
      </View>
    );
  }


  return (
    <View style={styles.container}>
      {showSuccessToast && (
        <Animated.View
          style={[
            styles.toast,
            {
              opacity: toastOpacity,
              backgroundColor: toastType === "success" ? "#845e5eff" : "#845e5eff",
            },
          ]}
        >
          <Text style={styles.toastText}>{toastMessage}</Text>
        </Animated.View>
      )}

      <View style={styles.logoContainer}>
        <Image
          source={require("../assets/images/logowawallet.png")}
          style={styles.logo}
          resizeMode="contain"
        />
      </View>

      <Animated.View
        style={[
          styles.bottomSection,
          {
            transform: [{ translateY: cardTranslateY }],
          },
        ]}
      >
        <KeyboardAwareScrollView
          contentContainerStyle={styles.scrollContainer}
          enableOnAndroid={true}
          extraScrollHeight={Platform.OS === "ios" ? 80 : 100}
          keyboardOpeningTime={0}
          showsVerticalScrollIndicator={false}
          enableAutomaticScroll={false}
          extraHeight={20}
        >
          <Text style={styles.title}>{isRegister ? "Crear Cuenta" : "Iniciar Sesión"}</Text>

          {isRegister && (
            <>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Nombre</Text>
                <TextInput
                  style={styles.input}
                  value={nombre}
                  onChangeText={setNombre}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Apellido</Text>
                <TextInput
                  style={styles.input}
                  value={apellido}
                  onChangeText={setApellido}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Celular</Text>
                <TextInput
                  style={styles.input}
                  keyboardType="phone-pad"
                  value={celular}
                  onChangeText={setCelular}
                />
              </View>
            </>
          )}

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Correo electrónico</Text>
            <TextInput
              style={styles.input}
              autoCapitalize="none"
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Contraseña</Text>
            <View style={styles.passwordContainer}>
              <TextInput
                style={[styles.input, styles.passwordInput]}
                secureTextEntry={!showPassword}
                value={password}
                onChangeText={setPassword}
              />
              <TouchableOpacity onPress={togglePasswordVisibility} style={styles.eyeIcon}>
                <Ionicons
                  name={showPassword ? "eye-off" : "eye"}
                  size={20}
                  color="#000000ff"
                />
              </TouchableOpacity>
            </View>
          </View>

          {isRegister && (
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Confirmar Contraseña</Text>
              <View style={styles.passwordContainer}>
                <TextInput
                  style={[styles.input, styles.passwordInput]}
                  secureTextEntry={!showConfirmPassword}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                />
                <TouchableOpacity onPress={toggleConfirmPasswordVisibility} style={styles.eyeIcon}>
                  <Ionicons
                    name={showConfirmPassword ? "eye-off" : "eye"}
                    size={20}
                    color="#000000ff"
                  />
                </TouchableOpacity>
              </View>
            </View>
          )}

          <TouchableOpacity style={styles.button} onPress={handleAuth}>
            <Text style={styles.buttonText}>{isRegister ? "Registrarse" : "Entrar"}</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => setIsRegister(!isRegister)}>
            <Text style={styles.link}>
              {isRegister
                ? "¿Ya tienes cuenta? Inicia sesión"
                : "¿No tienes cuenta? Regístrate"}
            </Text>
          </TouchableOpacity>
        </KeyboardAwareScrollView>
      </Animated.View>
    </View>
  );
}


const styles = StyleSheet.create({
  splashContainer: {
    flex: 1,
    backgroundColor: "#000",
    justifyContent: "center",
    alignItems: "center",
  },
  splashLogo: {
    width: 300,
    height: 300,
    marginBottom: 50,
  },
  loadingIndicator: {
    marginTop: 20,
  },
  container: {
    flex: 1,
    backgroundColor: "#000000ff",
  },
  toast: {
    position: "absolute",
    top: 50,
    left: 20,
    right: 20,
    backgroundColor: "#000000ff",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: "center",
    zIndex: 1000,
    elevation: 5,
    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  toastText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  logoContainer: {
    flex: 0.5,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#000",
  },
  logo: {
    width: 280,
    height: 280,
  },
  bottomSection: {
    flex: 0.5,
    backgroundColor: "#ffffffff",
    borderTopLeftRadius: 40,
    borderTopRightRadius: 40,
    marginTop: -50,
    paddingHorizontal: 24,
    paddingTop: 30,
    paddingBottom: 40,
    elevation: 12,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 10,
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: "center",
  },
  title: {
    fontSize: 26,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 20,
    color: "#000000ff",
  },
  inputGroup: {
    marginBottom: 14,
  },
  label: {
    fontSize: 15,
    fontWeight: "600",
    color: "#000000ff",
    marginBottom: 6,
    marginLeft: 4,
  },
  input: {
    borderWidth: 1,
    borderColor: "#000000ff",
    borderRadius: 12,
    padding: 12,
    fontSize: 16,
    backgroundColor: "#fff",
  },
  passwordContainer: {
    flexDirection: "row",
    alignItems: "center",
    position: "relative",
  },
  passwordInput: {
    flex: 1,
    paddingRight: 45,
  },
  eyeIcon: {
    position: "absolute",
    right: 12,
    padding: 8,
  },
  button: {
    backgroundColor: "#000000ff",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    marginVertical: 8,
    marginTop: 20,
  },
  buttonText: {
    color: "#ffffffff",
    fontSize: 18,
    fontWeight: "700",
  },
  link: {
    textAlign: "center",
    color: "#000000ff",
    marginTop: 14,
    fontSize: 15,
  },
});
