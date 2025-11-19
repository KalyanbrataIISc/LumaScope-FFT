# LumaScope FFT Native Android app

This module contains a CameraX + Jetpack Compose implementation of the LumaScope FFT analyzer. The app captures frames from the device camera, samples the luma from the center of the image, buffers ten seconds of data, resamples it to a fixed 30 FPS timeline, and computes an FFT locally on-device.

## Requirements

- Android Studio Giraffe (AGP 8.2+) or newer
- Android SDK 34 with build tools 34.0.0
- A device or emulator running Android 8.0 (API 26) or newer with a working camera (physical hardware recommended)

## Running the app

1. Open the `android-app` folder in Android Studio.
2. Let Gradle sync the project. (Android Studio will generate `gradlew` the first time if it is missing.)
3. Connect a device or create an emulator that exposes a rear camera feed.
4. Run the **app** run configuration. The app works fully offline, so no network permissions are requested.

## Project layout

- `app/src/main/java/com/example/lumascopefft/MainActivity.kt` – Compose UI, permission handling, and CameraX preview wiring.
- `processing/SignalProcessor.kt` – 10-second window management, resampling, and FFT calculation utilities.
- `camera/BrightnessAnalyzer.kt` – Reads the Y plane from CameraX frames and emits normalized brightness samples.
- `ui/components/*` – Oscilloscope, spectrum, and stats cards used by the Compose UI.

All FFT math and rendering occurs locally on the device. You can tweak the sampling rate or FFT window by editing `TARGET_FPS` and `SAMPLE_WINDOW_MS` in `SignalProcessor.kt`.
