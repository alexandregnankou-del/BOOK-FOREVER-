#!/usr/bin/env bash
# Construction de l'APK BOOK FOREVER sans Gradle :
# aapt2 (ressources) → javac → d8 (dex) → zipalign → apksigner.
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
SDK="${ANDROID_HOME:-/opt/android-sdk}"
JAVA_HOME="${JAVA_HOME:-/opt/jdk}"
BT="$SDK/build-tools/34.0.0"
PLATFORM="$SDK/platforms/android-34/android.jar"
OUT="$HERE/build"
APP="$HERE/app/src/main"

# --- interface embarquée : copie du build web dans les ressources ---
WWW="$HERE/app/src/main/assets/www"
if [ -d "$HERE/../dist" ]; then
  rm -rf "$WWW"
  mkdir -p "$WWW/media/covers"
  cp "$HERE/../dist/index.html" "$WWW/" 2>/dev/null || true
  cp "$HERE/../dist/manifest.webmanifest" "$WWW/" 2>/dev/null || true
  cp "$HERE/../dist/sw.js" "$WWW/" 2>/dev/null || true
  cp "$HERE/../dist/rescue.js" "$WWW/" 2>/dev/null || true
  cp -r "$HERE/../dist/assets" "$WWW/" 2>/dev/null || true
  cp -r "$HERE/../dist/fonts" "$WWW/" 2>/dev/null || true
  cp -r "$HERE/../dist/icons" "$WWW/" 2>/dev/null || true
  cp -r "$HERE/../dist/audio" "$WWW/" 2>/dev/null || true
  cp -r "$HERE/../dist/media/covers/." "$WWW/media/covers/" 2>/dev/null || true
  echo "interface embarquée : $(du -sh "$WWW" | cut -f1)"
fi


export PATH="$JAVA_HOME/bin:$PATH"

[ -x "$BT/aapt2" ] || { echo "aapt2 introuvable dans $BT"; exit 1; }
[ -f "$PLATFORM" ] || { echo "android.jar introuvable dans $SDK/platforms"; exit 1; }

rm -rf "$OUT"
mkdir -p "$OUT/gen" "$OUT/obj" "$OUT/dex"

echo "1/6 ressources…"
"$BT/aapt2" compile --dir "$APP/res" -o "$OUT/res.zip"

echo "2/6 link…"
"$BT/aapt2" link \
  -o "$OUT/base.apk" \
  -I "$PLATFORM" \
  --manifest "$APP/AndroidManifest.xml" \
  -R "$OUT/res.zip" \
  -A "$APP/assets" \
  --java "$OUT/gen" \
  --min-sdk-version 24 \
  --target-sdk-version 34 \
  --version-code 56 \
  --version-name 51.2 \
  --auto-add-overlay

echo "3/6 javac…"
find "$APP/java" "$OUT/gen" -name '*.java' > "$OUT/sources.txt"
javac -encoding UTF-8 -source 8 -target 8 -nowarn -Xlint:-options \
  -bootclasspath "$PLATFORM" \
  -classpath "$PLATFORM" \
  -d "$OUT/obj" @"$OUT/sources.txt" 2>&1 | grep -v "^Note:" || true

echo "4/6 d8…"
find "$OUT/obj" -name '*.class' > "$OUT/classes.txt"
"$BT/d8" --release --min-api 24 --lib "$PLATFORM" --output "$OUT/dex" @"$OUT/classes.txt"

echo "5/6 assemblage…"
python3 - "$OUT/base.apk" "$OUT/dex/classes.dex" "$OUT/unsigned.apk" <<'PY'
import shutil, sys, zipfile, os
base, dex, out = sys.argv[1:4]
shutil.copyfile(base, out)
with zipfile.ZipFile(out, 'a', zipfile.ZIP_DEFLATED) as z:
    z.write(dex, 'classes.dex')
print('   classes.dex ajouté')
PY
"$BT/zipalign" -f -p 4 "$OUT/unsigned.apk" "$OUT/aligned.apk"

echo "6/6 signature…"
KS="$HERE/keystore/book-forever.jks"
mkdir -p "$HERE/keystore"
if [ ! -f "$KS" ]; then
  keytool -genkeypair -v -keystore "$KS" -alias bookforever \
    -keyalg RSA -keysize 2048 -validity 10000 \
    -storepass bookforever -keypass bookforever \
    -dname "CN=ADISEN, OU=BOOK FOREVER, O=ADISEN, L=Abidjan, C=CI" > /dev/null 2>&1
fi
"$BT/apksigner" sign --ks "$KS" --ks-pass pass:bookforever \
  --key-pass pass:bookforever --out "$OUT/book-forever-v51.2.apk" "$OUT/aligned.apk"

"$BT/apksigner" verify --print-certs "$OUT/book-forever-v51.2.apk" | head -3
echo "APK prêt : $OUT/book-forever-v51.2.apk ($(du -h "$OUT/book-forever-v51.2.apk" | cut -f1))"
