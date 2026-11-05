#!/usr/bin/env bash
# Сборка APK без Gradle: aapt2 + javac + d8 + zipalign + apksigner.
# Требует ANDROID_HOME с build-tools и platforms/android-34, и JDK 17+.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
AND="$ROOT/android"
SDK="${ANDROID_HOME:-${ANDROID_SDK_ROOT:-}}"
[ -n "$SDK" ] || { echo "ANDROID_HOME не задан"; exit 1; }

BT="$(ls -d "$SDK"/build-tools/* | sort -V | tail -1)"
PLATFORM="$(ls -d "$SDK"/platforms/android-* | sort -V | tail -1)"
JAR="$PLATFORM/android.jar"
OUT="$AND/build"
rm -rf "$OUT"; mkdir -p "$OUT/res" "$OUT/classes" "$OUT/dex" "$OUT/gen"

echo "== build-tools: $BT"
echo "== platform:    $PLATFORM"

echo "== 1/6 копируем игру в assets/web"
ASSETS="$OUT/assets"
mkdir -p "$ASSETS/web"
cd "$ROOT"
cp index.html manifest.webmanifest sw.js icon.svg icon-180.png icon-192.png icon-512.png "$ASSETS/web/"
cp -r src assets "$ASSETS/web/"
# чистка мусора
find "$ASSETS/web" -type f \( -name '*.md' -o -name '.DS_Store' \) -delete

echo "== 2/6 aapt2 compile (ресурсы)"
"$BT/aapt2" compile --dir "$AND/res" -o "$OUT/res.zip"

echo "== 3/6 aapt2 link (ресурсы + манифест + assets)"
"$BT/aapt2" link \
  -o "$OUT/base.apk" \
  -I "$JAR" \
  --manifest "$AND/AndroidManifest.xml" \
  --min-sdk-version 21 \
  --target-sdk-version 33 \
  --version-code 1 --version-name "1.0.0" \
  -A "$ASSETS" \
  --java "$OUT/gen" \
  "$OUT/res.zip"

echo "== 4/6 javac"
javac -source 8 -target 8 -encoding UTF-8 -nowarn \
  -bootclasspath "$JAR" \
  -classpath "$JAR" \
  -d "$OUT/classes" \
  $(find "$AND/java" "$OUT/gen" -name '*.java')

echo "== 5/6 d8 (dex)"
"$BT/d8" --release --min-api 21 --lib "$JAR" --output "$OUT/dex" \
  $(find "$OUT/classes" -name '*.class')

echo "== 6/6 упаковка, выравнивание, подпись"
cd "$OUT/dex" && zip -q -r "$OUT/base.apk" classes.dex && cd "$OUT"
"$BT/zipalign" -f -p 4 "$OUT/base.apk" "$OUT/aligned.apk"

KS="$AND/keystore.jks"
if [ ! -f "$KS" ]; then
  echo "   создаю debug-keystore"
  keytool -genkeypair -v -keystore "$KS" -storepass otbleski -keypass otbleski \
    -alias otbleski -keyalg RSA -keysize 2048 -validity 10950 \
    -dname "CN=Otbleski, OU=Game, O=Otbleski, L=Fair, C=RU" >/dev/null 2>&1
fi
"$BT/apksigner" sign --ks "$KS" --ks-pass pass:otbleski --key-pass pass:otbleski \
  --ks-key-alias otbleski --min-sdk-version 21 \
  --out "$AND/otbleski.apk" "$OUT/aligned.apk"
"$BT/apksigner" verify --print-certs "$AND/otbleski.apk" | head -3

ls -lh "$AND/otbleski.apk"
echo "== готово: $AND/otbleski.apk"
