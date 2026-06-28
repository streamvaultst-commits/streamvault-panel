# StreamVault Panel

Panel móvil para revendedores de streaming. Permite registrar clientes, plataformas, combos, métodos de pago, renovaciones y abrir mensajes directos de WhatsApp con texto preparado.

## Qué incluye

- Registro de clientes con servicio, precio, costo, método de pago y fecha de renovación.
- Dashboard mensual con ventas, ganancias, clientes activos y renovaciones próximas.
- Mensaje automático para WhatsApp.
- Búsqueda y filtros por estado.
- Métodos de pago editables.
- Exportar/importar respaldo JSON.
- PWA instalable desde navegador.
- Configuración de Capacitor para generar APK Android.

## Subirlo a tu repo

Repo sugerido:

```text
streamvaultst-commits/streamvault-panel
```

Con Git:

```bash
git clone https://github.com/streamvaultst-commits/streamvault-panel.git
cd streamvault-panel
# copia aquí todos los archivos de este ZIP
git add .
git commit -m "Initial StreamVault Panel app"
git push
```

Sin Git, entra a GitHub, abre el repo, presiona **Add file > Upload files**, arrastra todo el contenido del ZIP y confirma con **Commit changes**.

## Compilar APK desde GitHub Actions

1. En GitHub entra al repo.
2. Ve a **Actions**.
3. Abre **Build Android APK**.
4. Presiona **Run workflow**.
5. Al terminar, descarga el artifact `streamvault-panel-debug-apk`.

Ese artifact trae el APK debug: `app-debug.apk`.

## Compilar localmente

```bash
npm install
npx cap add android
npx cap sync android
cd android
./gradlew assembleDebug
```

En Windows:

```bash
npm install
npx cap add android
npx cap sync android
cd android
gradlew.bat assembleDebug
```

APK generado:

```text
android/app/build/outputs/apk/debug/app-debug.apk
```

## Nota

La app guarda datos en el dispositivo usando `localStorage`. Para no perder información al cambiar de celular, usa **Exportar respaldo** y luego **Importar respaldo**.
