const COLUMNS = ['todo', 'doing', 'done'];
const NEXT = { todo: 'doing', doing: 'done', done: null };
const PREV = { todo: null, doing: 'todo', done: 'doing' };

async function api(path, options = {}) {
    const res = await fetch(path, {
        headers: { 'Content-Type': 'application/json' },
        ...options
    });
    if (!res.ok && res.status !== 204) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(err.error || 'request failed');
    }
    if (res.status === 204) return null;
    return res.json();
}

function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[c]);
}

function renderCard(card) {
    const prev = PREV[card.column_name];
    const next = NEXT[card.column_name];
    const desc = card.description
        ? `<div class="desc">${escapeHtml(card.description)}</div>`
        : '';
    return `
        <div class="card" data-id="${card.id}">
            <div class="title">${escapeHtml(card.title)}</div>
            ${desc}
            <div class="actions">
                ${prev ? `<button data-action="move" data-target="${prev}">←</button>` : ''}
                ${next ? `<button data-action="move" data-target="${next}">→</button>` : ''}
                <button class="del" data-action="delete">×</button>
            </div>
        </div>
    `;
}

async function refresh() {
    const [cards, stats] = await Promise.all([
        api('/api/cards'),
        api('/api/stats')
    ]);
    for (const col of COLUMNS) {
        document.getElementById(`cards-${col}`).innerHTML = cards[col].map(renderCard).join('');
        document.getElementById(`count-${col}`).textContent = cards[col].length;
    }
    document.getElementById('stats').textContent =
        `${stats.total} carte${stats.total > 1 ? 's' : ''} · ${stats.today} créée${stats.today > 1 ? 's' : ''} aujourd'hui`;
}

document.getElementById('new-card-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const title = document.getElementById('new-title').value.trim();
    const description = document.getElementById('new-desc').value.trim();
    if (!title) return;
    await api('/api/cards', {
        method: 'POST',
        body: JSON.stringify({ title, description })
    });
    document.getElementById('new-title').value = '';
    document.getElementById('new-desc').value = '';
    refresh();
});

document.querySelector('.board').addEventListener('click', async (e) => {
    const btn = e.target.closest('button[data-action]');
    if (!btn) return;
    const card = btn.closest('.card');
    const id = card.dataset.id;
    const action = btn.dataset.action;
    if (action === 'move') {
        await api(`/api/cards/${id}`, {
            method: 'PATCH',
            body: JSON.stringify({ column_name: btn.dataset.target })
        });
    } else if (action === 'delete') {
        await api(`/api/cards/${id}`, { method: 'DELETE' });
    }
    refresh();
});

refresh().catch(err => {
    document.getElementById('stats').textContent = `Erreur: ${err.message}`;
});
setInterval(refresh, 10000);
