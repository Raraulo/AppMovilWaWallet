import { getFunctions, httpsCallable } from 'firebase/functions';
import { app } from './firebase';

const functions = getFunctions(app);
const purchaseFn = httpsCallable(functions, 'purchase');
const getRecentFn = httpsCallable(functions, 'getRecentTransactions');
const transferFn = httpsCallable(functions, 'transfer');

export async function purchase(amount: number, description?: string) {
  const res = await purchaseFn({ amount, description });
  return res.data; // { ok: true, balance, txId }
}

export async function getRecentTransactions(limit = 10) {
  const res = await getRecentFn({ limit });
  return res.data; // { ok: true, items }
}

export async function transfer(amount: number, toEmail?: string | null, toPhone?: string | null, reason?: string | null) {
  const payload: any = { amount };
  if (toEmail) payload.toEmail = toEmail;
  if (toPhone) payload.toPhone = toPhone;
  if (reason) payload.reason = reason;
  const res = await transferFn(payload);
  return res.data; // { ok: true, fromBalance, toBalance, fromTxId, toTxId }
}
