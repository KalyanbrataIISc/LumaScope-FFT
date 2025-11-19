package com.example.lumascopefft.processing

import kotlin.math.PI
import kotlin.math.cos
import kotlin.math.pow
import kotlin.math.sin
import kotlin.math.sqrt

const val SAMPLE_WINDOW_MS = 10_000L
const val TARGET_FPS = 30

data class SignalSample(val timestamp: Long, val value: Float)

data class FftBin(val frequencyHz: Float, val magnitude: Float)

object SignalProcessor {

    fun trimWindow(samples: List<SignalSample>, newestTimestamp: Long): List<SignalSample> {
        val cutoff = newestTimestamp - SAMPLE_WINDOW_MS
        return samples.dropWhile { it.timestamp < cutoff }
    }

    fun resample(samples: List<SignalSample>, targetCount: Int): List<Float> {
        if (samples.isEmpty() || targetCount <= 0) return emptyList()
        if (samples.size == 1) {
            return List(targetCount) { samples.first().value }
        }
        val start = samples.first().timestamp.toDouble()
        val end = samples.last().timestamp.toDouble()
        if (end - start <= 0.0) {
            return List(targetCount) { samples.last().value }
        }
        val step = (end - start) / (targetCount - 1)
        val output = ArrayList<Float>(targetCount)
        var cursor = 0
        for (i in 0 until targetCount) {
            val targetTime = start + step * i
            while (cursor < samples.lastIndex && samples[cursor + 1].timestamp < targetTime) {
                cursor++
            }
            val left = samples[cursor]
            val right = if (cursor < samples.lastIndex) samples[cursor + 1] else left
            val span = (right.timestamp - left.timestamp).coerceAtLeast(1)
            val t = ((targetTime - left.timestamp) / span).coerceIn(0.0, 1.0)
            val value = left.value + (right.value - left.value) * t.toFloat()
            output.add(value)
        }
        return output
    }

    fun calculateFft(samples: List<Float>, sampleRate: Float): List<FftBin> {
        if (samples.isEmpty()) return emptyList()
        val windowed = applyHannWindow(samples)
        val n = windowed.size
        val bins = ArrayList<FftBin>(n / 2)
        for (k in 0 until n / 2) {
            var real = 0.0
            var imag = 0.0
            for (nIndex in 0 until n) {
                val angle = -2.0 * PI * k * nIndex / n
                real += windowed[nIndex] * cos(angle)
                imag += windowed[nIndex] * sin(angle)
            }
            val magnitude = sqrt(real.pow(2) + imag.pow(2)) / n
            val frequency = k * sampleRate / n
            bins.add(FftBin(frequency.toFloat(), magnitude.toFloat()))
        }
        return bins
    }

    private fun applyHannWindow(samples: List<Float>): List<Float> {
        if (samples.isEmpty()) return samples
        val n = samples.size
        return samples.mapIndexed { index, value ->
            val multiplier = 0.5f * (1f - cos((2 * PI * index) / (n - 1)).toFloat())
            value * multiplier
        }
    }
}
