package com.strive.vanscout.categories.data

import com.strive.vanscout.network.Response

interface CategoriesRepository {
    suspend fun getCategories(): Response<CategoriesResponse>
}

class CategoriesRepositoryImpl(private val service: CategoriesService) : CategoriesRepository {
    override suspend fun getCategories(): Response<CategoriesResponse> = service.getCategories()
}
