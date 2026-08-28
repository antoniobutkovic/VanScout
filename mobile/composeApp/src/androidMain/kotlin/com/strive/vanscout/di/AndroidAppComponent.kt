package com.strive.vanscout.di

import me.tatarka.inject.annotations.Component

@AppScope
@Component
abstract class AndroidAppComponent : AppComponent {
    companion object {
        lateinit var instance: AndroidAppComponent
            private set

        fun initialize() {
            instance = AndroidAppComponent::class.create()
        }
    }
}
