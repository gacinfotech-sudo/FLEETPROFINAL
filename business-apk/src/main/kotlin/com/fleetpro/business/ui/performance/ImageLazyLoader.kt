package com.fleetpro.business.ui.performance

import android.graphics.drawable.ColorDrawable
import android.graphics.drawable.Drawable
import android.widget.ImageView
import androidx.core.content.ContextCompat
import coil.load
import coil.request.CachePolicy
import coil.request.ImageRequest
import coil.size.Size
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class ImageLazyLoader @Inject constructor() {
    private val coroutineScope = CoroutineScope(Dispatchers.Main + Job())

    fun loadImageLazy(
        imageView: ImageView,
        url: String,
        placeholder: Drawable? = null,
        errorDrawable: Drawable? = null,
        priority: Priority = Priority.NORMAL,
        delay: Long = 0,
        aspectRatio: Float = 1f
    ) {
        // Cancel any previous loading job
        imageView.tag = imageView.tag as? Job
        (imageView.tag as? Job)?.cancel()

        val loadJob = coroutineScope.launch(Dispatchers.Main) {
            if (delay > 0) {
                delay(delay)
            }

            val request = ImageRequest.Builder(imageView.context)
                .data(url)
                .target { drawable ->
                    imageView.setImageDrawable(drawable)
                }
                .placeholder(placeholder ?: ColorDrawable(ContextCompat.getColor(
                    imageView.context,
                    android.R.color.darker_gray
                )))
                .error(errorDrawable ?: placeholder)
                .size(
                    when (priority) {
                        Priority.LOW -> 300
                        Priority.NORMAL -> 600
                        Priority.HIGH -> 800
                    }
                )
                .memoryCachePolicy(CachePolicy.ENABLED)
                .diskCachePolicy(CachePolicy.ENABLED)
                .build()

            imageView.load(request)
        }

        imageView.tag = loadJob
    }

    fun loadImageWithFallback(
        imageView: ImageView,
        urls: List<String>,
        onFailed: () -> Unit = {},
        priority: Priority = Priority.NORMAL
    ) {
        if (urls.isEmpty()) {
            onFailed()
            return
        }

        var currentIndex = 0

        fun loadNext() {
            if (currentIndex >= urls.size) {
                onFailed()
                return
            }

            loadImageLazy(
                imageView,
                urls[currentIndex],
                priority = priority,
                errorDrawable = null
            )

            coroutineScope.launch {
                delay(2000) // Timeout per URL
                currentIndex++
                if (imageView.drawable == null) {
                    loadNext()
                }
            }
        }

        loadNext()
    }

    fun preloadImages(urls: List<String>, priority: Priority = Priority.LOW) {
        coroutineScope.launch(Dispatchers.IO) {
            urls.forEach { url ->
                try {
                    val request = ImageRequest.Builder(coil.Coil.imageLoader(null).context)
                        .data(url)
                        .build()
                    // Preload without displaying
                    // Implementation depends on coil version
                } catch (e: Exception) {
                    // Silently fail on preload
                }
            }
        }
    }

    fun clearCache() {
        coroutineScope.launch(Dispatchers.IO) {
            // Clear coil cache
        }
    }

    enum class Priority {
        LOW,
        NORMAL,
        HIGH,
    }
}
