// ── CONFIG ──────────────────────────────────────────────────────
const SUPABASE_URL = 'https://koggdnslelupnbypesql.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_Kwm7KP_WSq9QLieiUfWqaA_B3lZ6Gic';
const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ── STATE ────────────────────────────────────────────────────────
let currentUser = null;
let currentPostId = null; // null = new post

// ── UTILS ────────────────────────────────────────────────────────
function toSlug(str) {
    return str.toLowerCase().trim()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-');
}

function calcReadTime(text) {
    const words = text.trim().split(/\s+/).filter(Boolean).length;
    return Math.max(1, Math.ceil(words / 200));
}

function formatDate(iso) {
    return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function showError(msg) {
    const el = document.getElementById('login-error');
    el.textContent = msg;
    el.classList.remove('hidden');
}

function hideError() {
    document.getElementById('login-error').classList.add('hidden');
}

// ── AUTH ─────────────────────────────────────────────────────────
async function checkAuth() {
    const { data: { session } } = await db.auth.getSession();
    if (session?.user) {
        currentUser = session.user;
        showStudio();
    } else {
        showLogin();
    }
}

function showLogin() {
    document.getElementById('login-screen').classList.remove('hidden');
    document.getElementById('studio-app').classList.add('hidden');
}

function showStudio() {
    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('studio-app').classList.remove('hidden');
    loadPostList();
}

document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    hideError();
    const btn = document.getElementById('login-btn');
    btn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Signing in...';
    btn.disabled = true;

    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;

    const { data, error } = await db.auth.signInWithPassword({ email, password });
    if (error) {
        showError(error.message);
        btn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Sign In';
        btn.disabled = false;
        return;
    }
    currentUser = data.user;
    showStudio();
});

document.getElementById('logout-btn').addEventListener('click', async () => {
    await db.auth.signOut();
    currentUser = null;
    currentPostId = null;
    showLogin();
});

// ── POST LIST ────────────────────────────────────────────────────
async function loadPostList() {
    const list = document.getElementById('post-list');
    list.innerHTML = '<div class="post-list-loading"><i class="fas fa-circle-notch fa-spin"></i></div>';

    const { data: posts, error } = await db
        .from('posts')
        .select('id, title, published, created_at')
        .eq('author_id', currentUser.id)
        .order('created_at', { ascending: false });

    if (error || !posts?.length) {
        list.innerHTML = '<div class="post-list-empty">No posts yet. Create your first one!</div>';
        return;
    }

    list.innerHTML = '';
    posts.forEach(post => {
        const item = document.createElement('div');
        item.className = 'post-list-item';
        item.dataset.id = post.id;
        if (post.id === currentPostId) item.classList.add('active');
        item.innerHTML = `
            <div class="post-list-title">${post.title || 'Untitled'}</div>
            <div class="post-list-meta">
                <span class="post-list-badge ${post.published ? 'published' : 'draft'}">
                    ${post.published ? 'Published' : 'Draft'}
                </span>
                <span>${formatDate(post.created_at)}</span>
            </div>
        `;
        item.addEventListener('click', () => loadPost(post.id));
        list.appendChild(item);
    });
}

// ── LOAD POST INTO EDITOR ─────────────────────────────────────────
async function loadPost(id) {
    const { data: post, error } = await db.from('posts').select('*').eq('id', id).single();
    if (error || !post) return;

    currentPostId = id;

    document.getElementById('post-title').value = post.title || '';
    document.getElementById('post-slug').value = post.slug || '';
    document.getElementById('post-excerpt').value = post.excerpt || '';
    document.getElementById('post-content').value = post.content || '';
    document.getElementById('post-cover').value = post.cover_image || '';
    document.getElementById('post-tags').value = (post.tags || []).join(', ');
    document.getElementById('toggle-published').checked = post.published;
    document.getElementById('toggle-public').checked = post.is_public;

    updateStatusBadge(post.published);
    updateWordStats();
    showEditor();
    setActiveListItem(id);
}

// ── NEW POST ─────────────────────────────────────────────────────
document.getElementById('new-post-btn').addEventListener('click', () => {
    currentPostId = null;
    document.getElementById('post-title').value = '';
    document.getElementById('post-slug').value = '';
    document.getElementById('post-excerpt').value = '';
    document.getElementById('post-content').value = '';
    document.getElementById('post-cover').value = '';
    document.getElementById('post-tags').value = '';
    document.getElementById('toggle-published').checked = false;
    document.getElementById('toggle-public').checked = true;
    updateStatusBadge(false);
    updateWordStats();
    showEditor();
    setActiveListItem(null);
    document.getElementById('post-title').focus();
});

// ── SAVE POST ─────────────────────────────────────────────────────
document.getElementById('save-btn').addEventListener('click', async () => {
    const btn = document.getElementById('save-btn');
    btn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Saving...';
    btn.disabled = true;

    const title = document.getElementById('post-title').value.trim();
    if (!title) { alert('Please add a title.'); btn.innerHTML = '<i class="fas fa-save"></i> Save'; btn.disabled = false; return; }

    const slug = document.getElementById('post-slug').value.trim() || toSlug(title);
    const content = document.getElementById('post-content').value;
    const tagsRaw = document.getElementById('post-tags').value;
    const tags = tagsRaw.split(',').map(t => t.trim()).filter(Boolean);
    const published = document.getElementById('toggle-published').checked;
    const is_public = document.getElementById('toggle-public').checked;

    const payload = {
        author_id: currentUser.id,
        title,
        slug,
        excerpt: document.getElementById('post-excerpt').value.trim(),
        content,
        cover_image: document.getElementById('post-cover').value.trim() || null,
        tags,
        published,
        is_public,
        read_time: calcReadTime(content),
    };

    let error;
    if (currentPostId) {
        ({ error } = await db.from('posts').update(payload).eq('id', currentPostId));
    } else {
        const { data, error: insertErr } = await db.from('posts').insert(payload).select().single();
        error = insertErr;
        if (data) currentPostId = data.id;
    }

    if (error) {
        alert('Save failed: ' + error.message);
    } else {
        updateStatusBadge(published);
        await loadPostList();
        setActiveListItem(currentPostId);
    }

    btn.innerHTML = '<i class="fas fa-save"></i> Save';
    btn.disabled = false;
});

// ── DELETE POST ───────────────────────────────────────────────────
document.getElementById('delete-btn').addEventListener('click', async () => {
    if (!currentPostId) return;
    if (!confirm('Delete this post permanently? This cannot be undone.')) return;

    const { error } = await db.from('posts').delete().eq('id', currentPostId);
    if (error) { alert('Delete failed: ' + error.message); return; }

    currentPostId = null;
    document.getElementById('post-editor').classList.add('hidden');
    document.getElementById('editor-placeholder').classList.remove('hidden');
    await loadPostList();
});

// ── AUTO SLUG from title ──────────────────────────────────────────
document.getElementById('post-title').addEventListener('input', (e) => {
    if (!currentPostId) { // only auto-fill on new posts
        document.getElementById('post-slug').value = toSlug(e.target.value);
    }
    updateWordStats();
});

// ── WORD COUNT + READ TIME ────────────────────────────────────────
document.getElementById('post-content').addEventListener('input', updateWordStats);

function updateWordStats() {
    const text = document.getElementById('post-content').value;
    const words = text.trim().split(/\s+/).filter(Boolean).length;
    const rt = calcReadTime(text);
    document.getElementById('word-count').textContent = `${words} word${words !== 1 ? 's' : ''}`;
    document.getElementById('read-time-estimate').textContent = `${rt} min read`;
}

// ── TABS (Write / Preview) ────────────────────────────────────────
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const tab = btn.dataset.tab;
        const textarea = document.getElementById('post-content');
        const preview = document.getElementById('preview-pane');
        if (tab === 'preview') {
            textarea.classList.add('hidden');
            preview.classList.remove('hidden');
            preview.innerHTML = marked.parse(textarea.value || '*Nothing to preview yet.*');
        } else {
            preview.classList.add('hidden');
            textarea.classList.remove('hidden');
        }
    });
});

// ── TOGGLE STATUS BADGE ───────────────────────────────────────────
document.getElementById('toggle-published').addEventListener('change', (e) => {
    updateStatusBadge(e.target.checked);
});

function updateStatusBadge(published) {
    const badge = document.getElementById('post-status-badge');
    badge.textContent = published ? 'Published' : 'Draft';
    badge.className = `status-badge ${published ? 'published' : 'draft'}`;
}

// ── HELPERS ───────────────────────────────────────────────────────
function showEditor() {
    document.getElementById('editor-placeholder').classList.add('hidden');
    document.getElementById('post-editor').classList.remove('hidden');
    // Reset to write tab
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelector('.tab-btn[data-tab="write"]').classList.add('active');
    document.getElementById('post-content').classList.remove('hidden');
    document.getElementById('preview-pane').classList.add('hidden');
}

function setActiveListItem(id) {
    document.querySelectorAll('.post-list-item').forEach(el => {
        el.classList.toggle('active', el.dataset.id === id);
    });
}

// ── INIT ──────────────────────────────────────────────────────────
checkAuth();

// ── THEME TOGGLE ──────────────────────────────────────────────────
const themeToggleBtn = document.getElementById('theme-toggle-btn');
if (themeToggleBtn) {
    const themeIcon = themeToggleBtn.querySelector('i');
    
    const savedTheme = localStorage.getItem('studio-theme');
    if (savedTheme === 'light') {
        document.documentElement.setAttribute('data-theme', 'light');
        themeIcon.classList.replace('fa-sun', 'fa-moon');
    }
    
    themeToggleBtn.addEventListener('click', () => {
        const isLight = document.documentElement.getAttribute('data-theme') === 'light';
        if (isLight) {
            document.documentElement.removeAttribute('data-theme');
            localStorage.setItem('studio-theme', 'dark');
            themeIcon.classList.replace('fa-moon', 'fa-sun');
        } else {
            document.documentElement.setAttribute('data-theme', 'light');
            localStorage.setItem('studio-theme', 'light');
            themeIcon.classList.replace('fa-sun', 'fa-moon');
        }
    });
}
