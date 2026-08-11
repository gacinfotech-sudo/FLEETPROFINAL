package com.fleetpro.business

import android.app.Application
import dagger.hilt.android.HiltAndroidApp

@HiltAndroidApp
class BusinessApp : Application() {
    override fun onCreate() {
        super.onCreate()
        // Initialize app
    }
}
