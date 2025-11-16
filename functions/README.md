Despliegue de Cloud Functions

Pasos rápidos:

1. Instalar dependencias y Firebase CLI (si no lo tienes):

# desde PowerShell
cd functions
npm install

# instalar Firebase CLI globalmente si es necesario
npm install -g firebase-tools

2. Autenticar y seleccionar proyecto:

firebase login
firebase use --add

3. Desplegar funciones:

firebase deploy --only functions

Notas:
- Asegúrate de que tu proyecto Firebase (wawalle) esté seleccionado.
- Las funciones usan Node 18.
- Las funciones usan el Admin SDK; no se aplican las reglas a las operaciones admin.
- Para entornos de producción considera habilitar facturación si requieres acceso a recursos adicionales.

Reglas recomendadas para Firestore (cliente):

rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /usuarios/{userId} {
      allow read: if request.auth != null && request.auth.uid == userId;
      allow create: if request.auth != null
                    && request.auth.uid == userId
                    && request.resource.data.balance == 10000
                    && request.resource.data.createdAt is timestamp
                    && request.resource.data.email == request.auth.token.email;
      allow update: if request.auth != null
                    && request.auth.uid == userId
                    && request.resource.data.balance == resource.data.balance;
      allow delete: if request.auth != null && request.auth.uid == userId;
    }

    match /usuarios/{userId}/transactions/{txId} {
      allow read: if request.auth != null && request.auth.uid == userId;
      allow create, update, delete: if false;
    }
  }
}

