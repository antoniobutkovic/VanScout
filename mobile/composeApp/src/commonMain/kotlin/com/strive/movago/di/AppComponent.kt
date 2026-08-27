package com.strive.movago.di

import com.strive.movago.categories.data.CategoriesRepository
import com.strive.movago.categories.data.CategoriesRepositoryImpl
import com.strive.movago.categories.data.CategoriesService
import com.strive.movago.categories.data.CategoriesServiceImpl
import com.strive.movago.categories.ui.CategoriesViewModel
import com.strive.movago.network.createHttpClient
import io.ktor.client.HttpClient
import me.tatarka.inject.annotations.Provides
import me.tatarka.inject.annotations.Scope

@Scope
@Target(AnnotationTarget.CLASS, AnnotationTarget.FUNCTION, AnnotationTarget.PROPERTY_GETTER)
annotation class AppScope

interface AppComponent {
    val categoriesViewModel: CategoriesViewModel

    @AppScope
    @Provides
    fun provideHttpClient(): HttpClient = createHttpClient()

    @AppScope
    @Provides
    fun provideCategoriesService(httpClient: HttpClient): CategoriesService = CategoriesServiceImpl(httpClient)

    @AppScope
    @Provides
    fun provideCategoriesRepository(service: CategoriesService): CategoriesRepository = CategoriesRepositoryImpl(service)

    @Provides
    fun provideCategoriesViewModel(repository: CategoriesRepository): CategoriesViewModel = CategoriesViewModel(repository)
}
