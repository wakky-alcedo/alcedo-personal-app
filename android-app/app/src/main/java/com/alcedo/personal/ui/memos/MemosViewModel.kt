package com.alcedo.personal.ui.memos

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.alcedo.personal.sync.DbProvider
import com.alcedo.personal.sync.MemoEntity
import com.alcedo.personal.sync.MemoRepository
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch

class MemosViewModel(app: Application) : AndroidViewModel(app) {
    private val db   = DbProvider.get(app)
    private val repo = MemoRepository(app, db.memoDao())

    val memos: StateFlow<List<MemoEntity>> = repo.observeActiveMemos()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    fun create(body: String, sourceUrl: String? = null, sourceTitle: String? = null) {
        if (body.isBlank()) return
        viewModelScope.launch { repo.create(body, sourceUrl, sourceTitle) }
    }

    fun update(id: String, body: String) {
        if (body.isBlank()) return
        viewModelScope.launch { repo.update(id, body) }
    }

    fun softDelete(id: String) {
        viewModelScope.launch { repo.softDelete(id) }
    }
}
