package com.fleetpro.business.ui.performance

import android.content.Context
import android.util.Log
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.launch
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class FeatureCodeSplitter @Inject constructor(
    private val context: Context
) {
    private val TAG = "FeatureCodeSplitter"
    private val coroutineScope = CoroutineScope(Dispatchers.IO + Job())

    private val loadedFeatures = mutableSetOf<String>()
    private val featureCallbacks = mutableMapOf<String, MutableList<() -> Unit>>()

    enum class Feature {
        BOOKING,
        PAYMENT,
        DRIVER_TRACKING,
        NOTIFICATIONS,
        ANALYTICS,
        SETTINGS,
        SUPPORT,
    }

    fun isFeatureLoaded(feature: Feature): Boolean {
        return loadedFeatures.contains(feature.name)
    }

    fun loadFeatureAsync(
        feature: Feature,
        priority: Priority = Priority.NORMAL,
        onLoadComplete: () -> Unit = {}
    ) {
        if (isFeatureLoaded(feature)) {
            onLoadComplete()
            return
        }

        // Register callback
        featureCallbacks.getOrPut(feature.name) { mutableListOf() }.add(onLoadComplete)

        // Load feature in background
        coroutineScope.launch {
            try {
                loadFeatureBundle(feature)
                loadedFeatures.add(feature.name)

                // Notify all callbacks
                featureCallbacks[feature.name]?.forEach { callback ->
                    callback()
                }
                featureCallbacks.remove(feature.name)

                Log.d(TAG, "Feature ${feature.name} loaded successfully")
            } catch (e: Exception) {
                Log.e(TAG, "Failed to load feature ${feature.name}: ${e.message}")
            }
        }
    }

    fun preloadFeatures(features: List<Feature>) {
        features.forEach { feature ->
            if (!isFeatureLoaded(feature)) {
                loadFeatureAsync(feature, Priority.LOW)
            }
        }
    }

    private suspend fun loadFeatureBundle(feature: Feature) {
        // Simulated feature loading
        // In production: load DEX/split APK from asset/network
        val delayMs = when (feature) {
            Feature.BOOKING -> 500
            Feature.PAYMENT -> 800
            Feature.DRIVER_TRACKING -> 600
            Feature.NOTIFICATIONS -> 300
            Feature.ANALYTICS -> 400
            Feature.SETTINGS -> 200
            Feature.SUPPORT -> 300
        }
        kotlinx.coroutines.delay(delayMs.toLong())
    }

    fun unloadFeature(feature: Feature) {
        loadedFeatures.remove(feature.name)
        featureCallbacks.remove(feature.name)
    }

    enum class Priority {
        LOW,
        NORMAL,
        HIGH,
    }
}
