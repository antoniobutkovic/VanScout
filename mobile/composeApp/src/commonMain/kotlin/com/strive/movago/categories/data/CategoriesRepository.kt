package com.strive.movago.categories.data

import com.strive.movago.network.Response

interface CategoriesRepository {
    suspend fun getCategories(): Response<CategoriesResponse>
}

class CategoriesRepositoryImpl(private val service: CategoriesService) : CategoriesRepository {
    override suspend fun getCategories(): Response<CategoriesResponse> = service.getCategories()
}
