# Instrucciones para Habilitar Autenticación en Firebase

## 📋 Pasos para configurar Email/Contraseña en Firebase Console

### 1. Acceder a Firebase Console
1. Ve a [Firebase Console](https://console.firebase.google.com/)
2. Selecciona tu proyecto: **chatcitas-787ca**

### 2. Habilitar Autenticación por Email/Contraseña
1. En el menú lateral, haz clic en **Authentication** (Autenticación)
2. Ve a la pestaña **Sign-in method** (Método de inicio de sesión)
3. Busca **Email/Password** en la lista de proveedores
4. Haz clic en el proveedor **Email/Password**
5. Activa el toggle **Enable** (Habilitar)
6. **NO actives** el "Email link (passwordless sign-in)" por ahora
7. Haz clic en **Save** (Guardar)

### 3. Verificar la configuración
Una vez habilitado, deberías ver:
- **Email/Password**: ✅ Enabled (Habilitado)

## ✅ Cambios Implementados en el Código

### En `app.js`:
- ✅ Habilitada la autenticación de Firebase: `const auth = firebase.auth();`
- ✅ Implementada función `login()` con `auth.signInWithEmailAndPassword()`
- ✅ Actualizada función `completeRegistration()` con `auth.createUserWithEmailAndPassword()`
- ✅ Implementado `auth.onAuthStateChanged()` para gestión automática de sesión
- ✅ Actualizada función `logout()` con `auth.signOut()`

### En `index.html`:
- ✅ Agregados campos de email y contraseña en el formulario de login
- ✅ Agregados campos de email y contraseña en el formulario de registro

### En `style.css`:
- ✅ Los estilos ya incluyen soporte para inputs de tipo `email` y `password`

## 🚀 Cómo probar

### Crear una nueva cuenta:
1. Abre la aplicación en el navegador
2. Haz clic en **"Crear Cuenta Nueva"**
3. Completa todos los campos:
   - **Email**: Usa un email válido (ej: usuario@ejemplo.com)
   - **Contraseña**: Mínimo 6 caracteres
   - **Nombre de usuario**: Debe ser único
   - Completa el resto del perfil (foto, edad, género, etc.)
4. Haz clic en **"Crear Cuenta"**
5. El sistema te registrará automáticamente y te llevará al chat

### Iniciar sesión con una cuenta existente:
1. En la pantalla de login, ingresa:
   - Tu email registrado
   - Tu contraseña
2. Haz clic en **"Iniciar Sesión"**
3. Serás autenticado y llevado al chat

### Cerrar sesión:
1. Haz clic en tu botón de perfil (esquina superior derecha)
2. Selecciona **"Cerrar sesión"**
3. Volverás a la pantalla de login

## 🔒 Seguridad

### Reglas de Firestore
Asegúrate de que tus reglas de Firestore permitan:
- Que los usuarios autenticados puedan leer y escribir sus propios datos
- Que los usuarios puedan leer perfiles de otros usuarios (para el chat)

Ejemplo de reglas recomendadas:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Permitir que usuarios autenticados lean todos los perfiles
    match /users/{userId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Permitir que usuarios autenticados accedan a sus chats
    match /chats/{chatId} {
      allow read, write: if request.auth != null && 
        request.auth.uid in resource.data.participants;
    }
    
    match /chats/{chatId}/messages/{messageId} {
      allow read: if request.auth != null && 
        request.auth.uid in get(/databases/$(database)/documents/chats/$(chatId)).data.participants;
      allow write: if request.auth != null && 
        request.auth.uid in get(/databases/$(database)/documents/chats/$(chatId)).data.participants;
    }
  }
}
```

### Reglas de Storage (si usas Firebase Storage)
```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /profile-photos/{userId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

## ⚠️ Notas Importantes

1. **Migración de usuarios existentes**: Si ya tienes usuarios sin contraseña en tu base de datos, necesitarán crear nuevas cuentas con email y contraseña.

2. **Persistencia de sesión**: Firebase Auth mantiene la sesión automáticamente. Los usuarios permanecerán conectados incluso después de cerrar el navegador.

3. **Recuperación de contraseña**: Para habilitar la recuperación de contraseña, puedes usar:
   ```javascript
   auth.sendPasswordResetEmail(email)
   ```

4. **Validación de email**: Para requerir que los usuarios verifiquen su email:
   ```javascript
   user.sendEmailVerification()
   ```

## 🐛 Solución de Problemas

### Error: "auth/configuration-not-found"
- Asegúrate de haber habilitado Email/Password en Firebase Console

### Error: "auth/email-already-in-use"
- El email ya está registrado. Usa el login en lugar del registro

### Error: "auth/weak-password"
- La contraseña debe tener al menos 6 caracteres

### Error: "auth/invalid-email"
- Verifica que el email tenga un formato válido

## 📞 Soporte

Si tienes problemas:
1. Revisa la consola del navegador (F12)
2. Verifica que Firebase Auth esté habilitado en la consola
3. Asegúrate de tener conexión a internet
4. Verifica las reglas de seguridad de Firestore

---

**¡Todo está listo para usar el sistema de autenticación con contraseñas!** 🎉
