package com.alcedo.personal.ui.memos

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.alcedo.personal.sync.DbProvider
import com.alcedo.personal.sync.MemoEntity
import com.alcedo.personal.sync.MemoRepository
import com.alcedo.personal.sync.MemoSyncScheduler
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch

class MemosViewModel(app: Application) : AndroidViewModel(app) {
    private val db   = DbProvider.get(app)
    private val repo = MemoRepository(app, db.memoDao())

    val memos: StateFlow<List<MemoEntity>> = repo.observeActiveMemos()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    private val _refreshing = MutableStateFlow(false)
    val refreshing: StateFlow<Boolean> = _refreshing

    fun create(body: String, sourceUrl: String? = null, sourceTitle: String? = null) {
        if (body.isBlank()) return
        viewModelScope.launch { repo.create(body, sourceUrl, sourceTitle) }
    }

    suspend fun getMemo(id: String): MemoEntity? = repo.getById(id)

    fun update(id: String, body: String) {
        if (body.isBlank()) return
        viewModelScope.launch { repo.update(id, body) }
    }

    fun softDelete(id: String) {
        viewModelScope.launch { repo.softDelete(id) }
    }

    fun refresh() {
        viewModelScope.launch {
            _refreshing.value = true
            try {
                repo.syncFromServer()
                MemoSyncScheduler.enqueuePush(getApplication())
            } finally {
                _refreshing.value = false
            }
        }
    }
}
