import React, { useEffect, useState } from 'react';
import { Alert, FlatList, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { getUserBalance } from '../utils/authService';
import { useAuth } from '../utils/ctx';
import { getRecentTransactions, purchase as purchaseFn } from '../utils/functionsClient';

export default function PurchaseScreen() {
  const { user } = useAuth();
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [balance, setBalance] = useState<number | null>(null);
  const [txs, setTxs] = useState<any[]>([]);

  useEffect(() => {
    if (!user) return;
    void loadBalance();
    void loadTxs();
  }, [user]);

  async function loadBalance() {
    try {
      const b = await getUserBalance(user!.uid);
      setBalance(b);
    } catch (e) {
      console.warn('Error cargando balance', e);
      setBalance(null);
    }
  }

  async function loadTxs() {
    try {
      const res = await getRecentTransactions(10);
      if (res?.items) setTxs(res.items);
    } catch (e) {
      console.warn('Error cargando transacciones', e);
    }
  }

  async function onPay() {
    if (!user) return Alert.alert('Error', 'Debes iniciar sesión');
    const value = parseFloat(amount.replace(',', '.'));
    if (!Number.isFinite(value) || value <= 0) return Alert.alert('Cantidad inválida', 'Introduce una cantidad mayor que 0');

    setLoading(true);
    try {
      const res = await purchaseFn(value, description || undefined);
      if (res?.ok) {
        Alert.alert('Pago procesado', `Nuevo saldo: ${res.balance}`);
        setAmount('');
        setDescription('');
        await loadBalance();
        await loadTxs();
      } else {
        Alert.alert('Error', 'No se pudo procesar el pago');
      }
    } catch (err: any) {
      console.error('purchase error', err);
      const msg = err?.message || (err?.code ? String(err.code) : 'Error desconocido');
      Alert.alert('Error al pagar', msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Pagar / Consumir Saldo</Text>

      <View style={styles.card}>
        <Text style={styles.label}>Saldo</Text>
        <Text style={styles.balance}>${balance === null ? '...' : balance.toLocaleString('es-ES', { minimumFractionDigits: 2 })}</Text>

        <Text style={[styles.label, { marginTop: 12 }]}>Cantidad</Text>
        <TextInput
          keyboardType="numeric"
          placeholder="0.00"
          value={amount}
          onChangeText={setAmount}
          style={styles.input}
        />

        <Text style={[styles.label, { marginTop: 12 }]}>Descripción (opcional)</Text>
        <TextInput
          placeholder="Descripción"
          value={description}
          onChangeText={setDescription}
          style={styles.input}
        />

        <TouchableOpacity style={[styles.btn, loading && styles.btnDisabled]} onPress={onPay} disabled={loading}>
          <Text style={styles.btnText}>{loading ? 'Procesando...' : 'Pagar'}</Text>
        </TouchableOpacity>
      </View>

      <Text style={[styles.title, { marginTop: 8 }]}>Transacciones recientes</Text>
      <FlatList
        data={txs}
        keyExtractor={(item) => item.id}
        style={{ width: '100%' }}
        renderItem={({ item }) => (
          <View style={styles.txItem}>
            <Text style={styles.txAmount}>{item.amount}</Text>
            <Text style={styles.txDesc}>{item.description || '—'}</Text>
            <Text style={styles.txDate}>{item.createdAt?.toDate ? item.createdAt.toDate().toLocaleString() : (item.createdAt || '')}</Text>
          </View>
        )}
        ListEmptyComponent={() => <Text style={{ color: '#666', marginTop: 8 }}>Sin transacciones</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#fff', alignItems: 'center' },
  title: { fontSize: 20, fontWeight: '700', marginBottom: 8 },
  card: { width: '100%', backgroundColor: '#f7f7f7', padding: 12, borderRadius: 10, marginBottom: 12 },
  label: { color: '#666', fontSize: 13 },
  balance: { fontSize: 22, fontWeight: '700', color: '#007AFF', marginTop: 4 },
  input: { width: '100%', padding: 10, borderRadius: 8, backgroundColor: '#fff', marginTop: 6, borderWidth: 1, borderColor: '#eee' },
  btn: { backgroundColor: '#007AFF', paddingVertical: 12, borderRadius: 8, marginTop: 12, alignItems: 'center' },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: '#fff', fontWeight: '700' },
  txItem: { width: '100%', padding: 10, borderBottomWidth: 1, borderBottomColor: '#eee' },
  txAmount: { fontWeight: '700' },
  txDesc: { color: '#444', marginTop: 4 },
  txDate: { color: '#999', marginTop: 6, fontSize: 12 },
});
