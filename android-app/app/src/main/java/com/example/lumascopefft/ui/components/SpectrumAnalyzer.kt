package com.example.lumascopefft.ui.components

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import com.example.lumascopefft.processing.FftBin
import kotlin.math.log10

@Composable
fun SpectrumAnalyzer(bins: List<FftBin>, modifier: Modifier = Modifier) {
    Canvas(
        modifier = modifier
            .fillMaxWidth()
            .height(160.dp)
            .background(MaterialTheme.colorScheme.surfaceVariant, RoundedCornerShape(12.dp))
    ) {
        if (bins.isEmpty()) return@Canvas
        val chunkSize = (bins.size / 60).coerceAtLeast(1)
        val grouped = bins.chunked(chunkSize).map { chunk ->
            val freq = chunk.last().frequencyHz
            val magnitude = chunk.maxOf { it.magnitude }
            freq to magnitude
        }
        val maxMag = grouped.maxOfOrNull { it.second }?.takeIf { it > 0f } ?: 1f
        val barWidth = size.width / grouped.size
        grouped.forEachIndexed { index, pair ->
            val normalized = (pair.second / maxMag).coerceIn(0f, 1f)
            val dbValue = 20 * log10((normalized + 1e-4f))
            val heightRatio = (dbValue + 40) / 40
            val barHeight = size.height * heightRatio.coerceIn(0f, 1f)
            val left = index * barWidth
            drawLine(
                color = Color(0xFF64B5F6),
                start = Offset(left + barWidth / 2f, size.height),
                end = Offset(left + barWidth / 2f, size.height - barHeight),
                strokeWidth = barWidth * 0.6f
            )
        }
    }
}
