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
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.unit.dp
import kotlin.math.abs
import kotlin.math.max

@Composable
fun Oscilloscope(samples: List<Float>, modifier: Modifier = Modifier) {
    Canvas(
        modifier = modifier
            .fillMaxWidth()
            .height(160.dp)
            .background(MaterialTheme.colorScheme.surfaceVariant, RoundedCornerShape(12.dp))
    ) {
        if (samples.size < 2) return@Canvas
        val widthStep = size.width / (samples.size - 1)
        val maxDeviation = max(0.05f, samples.maxOfOrNull { abs(it - 0.5f) } ?: 0.5f)
        val path = Path()
        samples.forEachIndexed { index, value ->
            val normalized = ((value - 0.5f) / maxDeviation).coerceIn(-1f, 1f)
            val x = widthStep * index
            val y = size.height / 2f - normalized * (size.height / 2f - 8f)
            if (index == 0) {
                path.moveTo(x, y)
            } else {
                path.lineTo(x, y)
            }
        }
        drawPath(path, color = MaterialTheme.colorScheme.primary, style = Stroke(width = 4f))
        drawLine(
            color = Color.White.copy(alpha = 0.2f),
            start = Offset(0f, size.height / 2f),
            end = Offset(size.width, size.height / 2f),
            strokeWidth = 2f
        )
    }
}
