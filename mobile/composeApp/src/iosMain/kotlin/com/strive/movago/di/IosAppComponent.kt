package com.strive.movago.di

import me.tatarka.inject.annotations.Component

internal expect fun createIosAppComponent(): IosAppComponent

@AppScope
@Component
abstract class IosAppComponent : AppComponent {
    companion object {
        val instance: IosAppComponent by lazy(::createIosAppComponent)
    }
}
