#!/bin/bash
set -e
(cd android && ./gradlew clean assembleRelease)
echo "APK located under ./android/app/build/outputs/apk/release/app-release.apk"
