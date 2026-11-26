#!/bin/bash
# TestFlight paketi: arşivle → yerel dağıtım sertifikasıyla dışa aktar → imzayı TAKIM KİMLİĞİNE bağla → ~/Desktop/Epoche-TestFlight.ipa
# Neden: sertifika adı "Osman ÇEKİLMEZ" (Ç, İ). codesign varsayılan gereksinime adı NFD yazıyor, sertifikada NFC;
# Apple'ın yükleme denetimi "Invalid Signature" diyor. xcodebuild ile doğrudan yükleme yeniden imzaladığı için
# aynı hatayı üretir; paketi Transporter ile yükle. (Almıla'daki betiğin uyarlaması; widget eklentisi de imzalanır.)
# Önce project.yml'da CURRENT_PROJECT_VERSION'ı artır (her yükleme yeni derleme numarası ister).
set -euo pipefail
cd "$(dirname "$0")/../.."
TEAM=2Y8L4BFX79
ID=$(security find-identity -v -p codesigning | awk '/Apple Distribution/{print $2; exit}')   # SHA-1; ad Ç/İ yüzünden kullanılmaz
[ -n "$ID" ] || { echo "Yerel Apple Distribution sertifikası yok" >&2; exit 1; }
B=build/testflight; rm -rf "$B"; mkdir -p "$B"
xcodegen generate -q
nice -n 10 xcodebuild -project EpocheShell.xcodeproj -scheme Epoche -configuration Release -destination 'generic/platform=iOS' \
  -archivePath "$B/Epoche.xcarchive" -allowProvisioningUpdates archive | grep -E 'error:|ARCHIVE'
cat > "$B/Export.plist" <<P
<?xml version="1.0" encoding="UTF-8"?><!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict><key>method</key><string>app-store-connect</string><key>destination</key><string>export</string>
<key>teamID</key><string>$TEAM</string><key>signingStyle</key><string>automatic</string>
<key>signingCertificate</key><string>Apple Distribution</string><key>uploadSymbols</key><true/></dict></plist>
P
xcodebuild -exportArchive -archivePath "$B/Epoche.xcarchive" -exportOptionsPlist "$B/Export.plist" -exportPath "$B/disa" -allowProvisioningUpdates | grep -E 'error|EXPORT'
mkdir "$B/yeniden" && (cd "$B/yeniden" && unzip -q ../disa/Epoche.ipa)
APP="$B/yeniden/Payload/Epoche.app"
imzala() {  # $1 paket; kendi yetkileriyle, takım kimliği gereksinimiyle
  local p="$1" bid ent="$B/ent-$(basename "$1").plist"
  bid=$(plutil -extract CFBundleIdentifier raw "$p/Info.plist")
  codesign -d --entitlements :- "$p" > "$ent" 2>/dev/null
  codesign -f -s "$ID" --timestamp --entitlements "$ent" \
    -r="designated => anchor apple generic and identifier \"$bid\" and certificate leaf[subject.OU] = \"$TEAM\"" "$p"
}
for fw in "$APP"/Frameworks/*.framework; do [ -e "$fw" ] && imzala "$fw"; done
for ex in "$APP"/PlugIns/*.appex; do [ -e "$ex" ] && imzala "$ex"; done
imzala "$APP"
codesign --verify --deep --strict "$APP"
rm -f ~/Desktop/Epoche-TestFlight.ipa && (cd "$B/yeniden" && zip -qry ~/Desktop/Epoche-TestFlight.ipa .)
echo "Hazır: ~/Desktop/Epoche-TestFlight.ipa — Transporter'a sürükle, Teslim Et."
