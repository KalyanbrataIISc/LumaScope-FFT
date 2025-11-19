package com.example.lumascopefft.camera

import androidx.camera.core.ImageAnalysis
import androidx.camera.core.ImageProxy
import java.nio.ByteBuffer
import java.nio.ByteOrder
import kotlin.math.max
import kotlin.math.min

class BrightnessAnalyzer(
    private val sampleBoxSize: Int = 80,
    private val onSample: (timestampNanos: Long, normalizedLuma: Double) -> Unit
) : ImageAnalysis.Analyzer {

    override fun analyze(image: ImageProxy) {
        val plane = image.planes.firstOrNull()
        if (plane != null) {
            val luma = calculateCenterLuma(plane, image.width, image.height)
            onSample(image.imageInfo.timestamp, luma)
        }
        image.close()
    }

    private fun calculateCenterLuma(plane: ImageProxy.PlaneProxy, width: Int, height: Int): Double {
        val half = sampleBoxSize / 2
        val startX = max(0, width / 2 - half)
        val endX = min(width, width / 2 + half)
        val startY = max(0, height / 2 - half)
        val endY = min(height, height / 2 + half)
        if (startX >= endX || startY >= endY) return 0.0

        val buffer = plane.buffer.duplicate().order(ByteOrder.nativeOrder())
        val rowStride = plane.rowStride
        val data = toByteArray(buffer)

        var sum = 0.0
        var count = 0
        for (y in startY until endY) {
            val rowStart = y * rowStride
            for (x in startX until endX) {
                val index = rowStart + x
                if (index >= 0 && index < data.size) {
                    sum += data[index].toInt() and 0xFF
                    count++
                }
            }
        }
        if (count == 0) return 0.0
        return (sum / count) / 255.0
    }

    private fun toByteArray(buffer: ByteBuffer): ByteArray {
        val bytes = ByteArray(buffer.remaining())
        buffer.get(bytes)
        buffer.rewind()
        return bytes
    }
}
