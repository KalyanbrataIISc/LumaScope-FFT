package com.example.lumascopefft

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.example.lumascopefft.processing.FftBin
import com.example.lumascopefft.processing.SignalProcessor
import com.example.lumascopefft.processing.SignalSample
import com.example.lumascopefft.processing.SAMPLE_WINDOW_MS
import com.example.lumascopefft.processing.TARGET_FPS
import java.util.concurrent.TimeUnit
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

class LumaScopeViewModel : ViewModel() {

    private val _samples = MutableStateFlow<List<SignalSample>>(emptyList())
    private val _timeSeries = MutableStateFlow<List<Float>>(emptyList())
    private val _fft = MutableStateFlow<List<FftBin>>(emptyList())
    private val _latestValue = MutableStateFlow(0f)
    private val _fps = MutableStateFlow(0f)

    val timeSeries: StateFlow<List<Float>> = _timeSeries
    val fft: StateFlow<List<FftBin>> = _fft
    val latestValue: StateFlow<Float> = _latestValue
    val fps: StateFlow<Float> = _fps

    private var processingJob: Job? = null

    fun handleSample(timestampNanos: Long, brightness: Double) {
        val timestampMs = TimeUnit.NANOSECONDS.toMillis(timestampNanos)
        val appended = _samples.value + SignalSample(timestampMs, brightness.toFloat())
        val trimmed = SignalProcessor.trimWindow(appended, timestampMs)
        _samples.value = trimmed
        _latestValue.value = brightness.toFloat()
        scheduleProcessing(trimmed)
    }

    private fun scheduleProcessing(samples: List<SignalSample>) {
        processingJob?.cancel()
        processingJob = viewModelScope.launch(Dispatchers.Default) {
            if (samples.isEmpty()) {
                updateUi(emptyList(), emptyList(), 0f)
                return@launch
            }
            val seconds = (SAMPLE_WINDOW_MS / 1000).toInt()
            val targetCount = TARGET_FPS * seconds
            val resampled = SignalProcessor.resample(samples, targetCount)
            val fftBins = SignalProcessor.calculateFft(resampled, TARGET_FPS.toFloat())
            val fpsValue = computeFps(samples)
            updateUi(resampled, fftBins, fpsValue)
        }
    }

    private suspend fun updateUi(timeSeries: List<Float>, fft: List<FftBin>, fps: Float) {
        withContext(Dispatchers.Main) {
            _timeSeries.value = timeSeries
            _fft.value = fft
            _fps.value = fps
        }
    }

    private fun computeFps(samples: List<SignalSample>): Float {
        if (samples.size < 2) return 0f
        val durationMs = (samples.last().timestamp - samples.first().timestamp).coerceAtLeast(1)
        return samples.size * 1000f / durationMs
    }
}
