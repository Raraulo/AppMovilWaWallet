export default function generateCard(titular = "") {
  // Número de tarjeta: 16 dígitos
  const numeroTarjeta = Array.from({ length: 16 }, () => Math.floor(Math.random() * 10)).join("");

  // CVV: 3 dígitos aleatorios (100-999)
  const cvv = (100 + Math.floor(Math.random() * 900)).toString();

  // Fecha de expiración: mes actual + 2 años (MM/YY)
  const now = new Date();
  const expMonth = String(now.getMonth() + 1).padStart(2, "0");
  const expYear = String(now.getFullYear() + 2).slice(-2); // últimos 2 dígitos
  const fechaExp = `${expMonth}/${expYear}`;

  // Titular de la tarjeta
  return {
    numero: numeroTarjeta,
    cvv,
    fechaExp,
    titular,
  };
}
