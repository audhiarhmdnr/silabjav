/**
 * XRF Explorer 7000 — Standalone Monitor & Data Engine
 * Core Frontend Logic (ES6+ Vanilla JS)
 */

class XrfApp {
    constructor() {
        this.apiEndpoint = '/api/xrf/data';
        this.authEndpoint = '/api/auth/login';
        this.state = {
            authUser: JSON.parse(localStorage.getItem('xrf_auth_user') || 'null'),
            authToken: localStorage.getItem('xrf_auth_token') || '',
            page: 1,
            limit: 25,
            search: '',
            startDate: '',
            endDate: '',
            mode: '',
            device: '',
            sortBy: 'timestamp_ms',
            sortDir: 'DESC',
            autoSync: true,
            syncIntervalSec: 4,
            timerId: null,
            lastMaxId: 0,
            activeModalItem: null,
            isLoading: false,
            data: [],
            stats: null,
            pagination: null
        };

        this.initDomElements();
        this.bindEvents();
        this.initAuth();
    }

    initDomElements() {
        // App Layout & Auth
        this.elAppWrapper = document.querySelector('.app-wrapper');
        this.elUserProfilePill = document.getElementById('user-profile-pill');
        this.elUserRoleBadge = document.getElementById('user-role-badge');
        this.elUserDisplayName = document.getElementById('user-display-name');
        this.elBtnLogout = document.getElementById('btn-logout');

        // Login Overlay Elements
        this.elLoginOverlay = document.getElementById('login-overlay');
        this.elLoginForm = document.getElementById('login-form');
        this.elLoginUsername = document.getElementById('login-username');
        this.elLoginPassword = document.getElementById('login-password');
        this.elLoginAlert = document.getElementById('login-alert');
        this.elBtnTogglePwd = document.getElementById('btn-toggle-pwd');
        this.elBtnLoginSubmit = document.getElementById('btn-login-submit');
        this.elLoginBtnText = document.getElementById('login-btn-text');
        this.elLoginBtnSpinner = document.getElementById('login-btn-spinner');

        // Stats
        this.elTotalScans = document.getElementById('stat-total-scans');
        this.elTodayScans = document.getElementById('stat-today-scans');
        this.elActiveModes = document.getElementById('stat-active-modes');
        this.elActiveModesSub = document.getElementById('stat-active-modes-sub');
        this.elTotalElements = document.getElementById('stat-total-elements');
        this.elSyncStatusPill = document.getElementById('sync-status-pill');
        this.elSyncText = document.getElementById('sync-text');

        // Filters
        this.elSearchInput = document.getElementById('search-input');
        this.elModeSelect = document.getElementById('mode-select');
        this.elDeviceSelect = document.getElementById('device-select');
        this.elStartDate = document.getElementById('start-date');
        this.elEndDate = document.getElementById('end-date');
        this.elLimitSelect = document.getElementById('limit-select');
        this.elResetBtn = document.getElementById('btn-reset-filters');
        this.elRefreshBtn = document.getElementById('btn-refresh');
        this.elExportCsvBtn = document.getElementById('btn-export-csv');
        this.elExportJsonBtn = document.getElementById('btn-export-json');

        // Table & Pagination
        this.elTableBody = document.getElementById('xrf-table-body');
        this.elTableCount = document.getElementById('table-count-badge');
        this.elPageInfo = document.getElementById('page-info');
        this.elPageControls = document.getElementById('page-controls');

        // Modal Elements
        this.elModalBackdrop = document.getElementById('modal-detail');
        this.elModalCloseBtn = document.getElementById('modal-close-btn');
        this.elModalTitle = document.getElementById('modal-sample-title');
        this.elModalSubtitle = document.getElementById('modal-sample-subtitle');
        this.elModalElementsGrid = document.getElementById('modal-elements-grid');
        this.elModalSpecsGrid = document.getElementById('modal-specs-grid');
        this.elModalEnvGrid = document.getElementById('modal-env-grid');
        this.elBtnCopyJson = document.getElementById('btn-copy-modal-json');
        this.elModalFinishBtn = document.getElementById('btn-modal-close-finish');

        // Toast Container
        this.elToastContainer = document.getElementById('toast-container') || this.createToastContainer();
    }

    createToastContainer() {
        const c = document.createElement('div');
        c.id = 'toast-container';
        document.body.appendChild(c);
        return c;
    }

    initAuth() {
        if (this.state.authUser) {
            this.showAppView();
            this.loadData();
            this.setupAutoSync();
        } else {
            this.showLoginView();
        }
    }

    showAppView() {
        if (this.elLoginOverlay) {
            this.elLoginOverlay.classList.add('hidden');
        }
        if (this.elAppWrapper) {
            this.elAppWrapper.classList.remove('auth-locked');
        }
        if (this.elUserProfilePill && this.state.authUser) {
            if (this.elUserDisplayName) {
                this.elUserDisplayName.textContent = this.state.authUser.nama || this.state.authUser.username;
            }
            if (this.elUserRoleBadge) {
                this.elUserRoleBadge.textContent = (this.state.authUser.role || 'ADMIN').toUpperCase();
            }
        }
    }

    showLoginView() {
        if (this.elLoginOverlay) {
            this.elLoginOverlay.classList.remove('hidden');
        }
        if (this.elAppWrapper) {
            this.elAppWrapper.classList.add('auth-locked');
        }
        clearInterval(this.state.timerId);
    }

    async handleLogin(e) {
        e.preventDefault();
        const username = this.elLoginUsername.value.trim();
        const password = this.elLoginPassword.value.trim();

        if (!username || !password) {
            this.showLoginAlert('Username dan Password wajib diisi!');
            return;
        }

        this.setLoginLoading(true);
        this.hideLoginAlert();

        try {
            const res = await fetch(this.authEndpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });

            const data = await res.json();

            if (res.ok && data.status === 'success') {
                this.state.authUser = data.user;
                this.state.authToken = data.token;
                localStorage.setItem('xrf_auth_user', JSON.stringify(data.user));
                localStorage.setItem('xrf_auth_token', data.token);

                this.showAppView();
                this.showToast(`Selamat datang, ${data.user.nama || data.user.username}!`, 'success');
                this.loadData();
                this.setupAutoSync();
            } else {
                this.showLoginAlert(data.message || 'Login gagal. Periksa username dan password.');
            }
        } catch (err) {
            this.showLoginAlert('Gagal terhubung ke server autentikasi: ' + err.message);
        } finally {
            this.setLoginLoading(false);
        }
    }

    handleLogout() {
        if (confirm('Apakah Anda yakin ingin keluar dari sistem XRF?')) {
            this.state.authUser = null;
            this.state.authToken = '';
            localStorage.removeItem('xrf_auth_user');
            localStorage.removeItem('xrf_auth_token');
            clearInterval(this.state.timerId);
            this.showLoginView();
            this.showToast('Anda telah berhasil keluar.', 'info');
        }
    }

    togglePasswordVisibility() {
        if (this.elLoginPassword.type === 'password') {
            this.elLoginPassword.type = 'text';
            this.elBtnTogglePwd.textContent = '🙈';
        } else {
            this.elLoginPassword.type = 'password';
            this.elBtnTogglePwd.textContent = '👁️';
        }
    }

    showLoginAlert(msg) {
        if (this.elLoginAlert) {
            this.elLoginAlert.textContent = msg;
            this.elLoginAlert.style.display = 'block';
        }
    }

    hideLoginAlert() {
        if (this.elLoginAlert) {
            this.elLoginAlert.style.display = 'none';
        }
    }

    setLoginLoading(loading) {
        if (this.elBtnLoginSubmit) {
            this.elBtnLoginSubmit.disabled = loading;
        }
        if (this.elLoginBtnText) {
            this.elLoginBtnText.style.display = loading ? 'none' : 'inline';
        }
        if (this.elLoginBtnSpinner) {
            this.elLoginBtnSpinner.style.display = loading ? 'inline-block' : 'none';
        }
    }

    bindEvents() {
        // Auth Events
        if (this.elLoginForm) {
            this.elLoginForm.addEventListener('submit', (e) => this.handleLogin(e));
        }
        if (this.elBtnTogglePwd) {
            this.elBtnTogglePwd.addEventListener('click', () => this.togglePasswordVisibility());
        }
        if (this.elBtnLogout) {
            this.elBtnLogout.addEventListener('click', () => this.handleLogout());
        }

        // Debounce search
        let debounceTimer = null;
        this.elSearchInput.addEventListener('input', (e) => {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
                this.state.search = e.target.value.trim();
                this.state.page = 1;
                this.loadData();
            }, 300);
        });

        // Filter change handlers
        this.elModeSelect.addEventListener('change', (e) => {
            this.state.mode = e.target.value;
            this.state.page = 1;
            this.loadData();
        });

        this.elDeviceSelect.addEventListener('change', (e) => {
            this.state.device = e.target.value;
            this.state.page = 1;
            this.loadData();
        });

        this.elStartDate.addEventListener('change', (e) => {
            this.state.startDate = e.target.value;
            this.state.page = 1;
            this.loadData();
        });

        this.elEndDate.addEventListener('change', (e) => {
            this.state.endDate = e.target.value;
            this.state.page = 1;
            this.loadData();
        });

        this.elLimitSelect.addEventListener('change', (e) => {
            this.state.limit = parseInt(e.target.value, 10) || 25;
            this.state.page = 1;
            this.loadData();
        });

        if (this.elResetBtn) {
            this.elResetBtn.addEventListener('click', () => {
                this.resetFilters();
                this.showToast('Filter telah direset ke default.', 'info');
            });
        }

        if (this.elRefreshBtn) {
            this.elRefreshBtn.addEventListener('click', () => {
                this.loadData();
                this.showToast('Memperbarui data XRF...', 'info');
            });
        }

        // Toggle Live Sync (if present)
        if (this.elSyncStatusPill) {
            this.elSyncStatusPill.addEventListener('click', () => {
                this.state.autoSync = !this.state.autoSync;
                if (this.state.autoSync) {
                    this.setupAutoSync();
                    if (this.elSyncText) this.elSyncText.textContent = `LIVE SYNC AKTIF (${this.state.syncIntervalSec}s)`;
                    this.elSyncStatusPill.style.borderColor = 'rgba(16, 185, 129, 0.4)';
                    this.showToast('Live auto-sync diaktifkan.', 'success');
                } else {
                    clearInterval(this.state.timerId);
                    if (this.elSyncText) this.elSyncText.textContent = 'LIVE SYNC JEDA';
                    this.elSyncStatusPill.style.borderColor = 'rgba(148, 163, 184, 0.4)';
                    this.showToast('Live auto-sync dijeda.', 'warning');
                }
            });
        }

        // Export Actions
        if (this.elExportCsvBtn) {
            this.elExportCsvBtn.addEventListener('click', () => this.exportCsv());
        }
        if (this.elExportJsonBtn) {
            this.elExportJsonBtn.addEventListener('click', () => this.exportJson());
        }

        // Modal Tabs
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
                document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
                btn.classList.add('active');
                const targetTab = document.getElementById(btn.dataset.tab);
                if (targetTab) targetTab.classList.add('active');
            });
        });

        // Close Modal
        this.elModalCloseBtn.addEventListener('click', () => this.closeModal());
        if (this.elModalFinishBtn) {
            this.elModalFinishBtn.addEventListener('click', () => this.closeModal());
        }
        this.elModalBackdrop.addEventListener('click', (e) => {
            if (e.target === this.elModalBackdrop) this.closeModal();
        });
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.elModalBackdrop.classList.contains('open')) {
                this.closeModal();
            }
        });

        this.elBtnCopyJson.addEventListener('click', () => {
            if (this.state.activeModalItem) {
                navigator.clipboard.writeText(JSON.stringify(this.state.activeModalItem, null, 2));
                this.showToast('JSON sampel berhasil disalin ke clipboard!', 'success');
            }
        });
    }

    resetFilters() {
        this.elSearchInput.value = '';
        this.elModeSelect.value = '';
        this.elDeviceSelect.value = '';
        this.elStartDate.value = '';
        this.elEndDate.value = '';
        this.elLimitSelect.value = '25';

        this.state.search = '';
        this.state.mode = '';
        this.state.device = '';
        this.state.startDate = '';
        this.state.endDate = '';
        this.state.limit = 25;
        this.state.page = 1;


        this.loadData();
    }

    setupAutoSync() {
        clearInterval(this.state.timerId);
        if (this.state.autoSync) {
            this.state.timerId = setInterval(() => {
                this.loadData(true);
            }, this.state.syncIntervalSec * 1000);
        }
    }

    async loadData(isLivePoll = false) {
        if (!this.state.authUser) return;
        if (this.state.isLoading && !isLivePoll) return;
        this.state.isLoading = true;

        if (!isLivePoll) {
            this.renderLoading();
        }

        try {
            const params = new URLSearchParams({
                page: this.state.page,
                limit: this.state.limit,
                search: this.state.search,
                start_date: this.state.startDate,
                end_date: this.state.endDate,
                mode: this.state.mode,
                device: this.state.device,
                sort_by: this.state.sortBy,
                sort_dir: this.state.sortDir
            });

            const res = await fetch(`${this.apiEndpoint}?${params.toString()}`);
            if (!res.ok) throw new Error(`HTTP Error ${res.status}`);
            const result = await res.json();

            if (!result.success) throw new Error(result.message || 'Gagal memuat data.');

            // Check for new scans in Live Poll
            if (isLivePoll && result.data.length > 0) {
                const currentMaxId = result.data[0].id;
                if (this.state.lastMaxId && currentMaxId > this.state.lastMaxId) {
                    const newScan = result.data[0];
                    this.showToast(`📡 Scan baru terdeteksi: <strong>${this.escapeHtml(newScan.sample_name || 'Sampel Baru')}</strong> (${newScan.elements.length} unsur)`, 'success');
                }
                this.state.lastMaxId = currentMaxId;
            } else if (result.data.length > 0) {
                this.state.lastMaxId = result.data[0].id;
            }

            this.state.data = result.data;
            this.state.stats = result.stats;
            this.state.pagination = result.pagination;

            this.renderStats(result.stats);
            this.renderDropdowns(result.stats);
            this.renderTable(result.data);
            this.renderPagination(result.pagination);

        } catch (err) {
            console.error('XRF Load Error:', err);
            if (!isLivePoll) {
                this.renderError(err.message);
                this.showToast(`Gagal memuat data: ${err.message}`, 'warning');
            }
        } finally {
            this.state.isLoading = false;
        }
    }

    renderStats(stats) {
        if (!stats) return;
        if (this.elTotalScans) this.elTotalScans.textContent = this.formatNumber(stats.total_measurements);
        if (this.elTodayScans) this.elTodayScans.textContent = this.formatNumber(stats.today_measurements);
        if (this.elTotalElements) this.elTotalElements.textContent = this.formatNumber(stats.total_element_entries);

        const modes = stats.db_sources || [];
        if (this.elActiveModes) this.elActiveModes.textContent = `${modes.length} Mode`;
        if (this.elActiveModesSub) this.elActiveModesSub.textContent = modes.length > 0 ? modes.join(', ') : 'mineral.db, alloy.db';
    }

    renderDropdowns(stats) {
        if (!stats) return;

        // Populate Mode dropdown if not populated
        if (this.elModeSelect.options.length <= 1) {
            const dbSources = stats.db_sources || [];
            const workCurves = stats.work_curves || [];

            dbSources.forEach(db => {
                const opt = document.createElement('option');
                opt.value = db;
                opt.textContent = `${db} (Database)`;
                this.elModeSelect.appendChild(opt);
            });

            if (workCurves.length > 0) {
                const optGroup = document.createElement('optgroup');
                optGroup.label = 'Kurva Kerja Kalibrasi';
                workCurves.forEach(wc => {
                    const opt = document.createElement('option');
                    opt.value = wc;
                    opt.textContent = wc;
                    optGroup.appendChild(opt);
                });
                this.elModeSelect.appendChild(optGroup);
            }
        }

        // Populate Device dropdown
        if (this.elDeviceSelect.options.length <= 1) {
            const devices = stats.devices || [];
            devices.forEach(d => {
                const opt = document.createElement('option');
                opt.value = d;
                opt.textContent = d;
                this.elDeviceSelect.appendChild(opt);
            });
        }
    }

    renderLoading() {
        this.elTableBody.innerHTML = `
            <tr class="loading-row">
                <td colspan="7">
                    <div style="display:flex;align-items:center;justify-content:center;gap:12px;padding:30px 0;">
                        <div class="spinner"></div>
                        <span style="font-size:0.85rem;color:var(--text-muted)">Memuat data instrumen XRF...</span>
                    </div>
                </td>
            </tr>
        `;
    }

    renderError(msg) {
        this.elTableBody.innerHTML = `
            <tr class="loading-row">
                <td colspan="7">
                    <div style="padding:30px 0;color:var(--rose);">
                        <p style="font-weight:700;font-size:1rem;margin-bottom:6px">⚠️ Gagal Memuat Data</p>
                        <p style="font-size:0.8rem;color:var(--text-muted)">${this.escapeHtml(msg)}</p>
                    </div>
                </td>
            </tr>
        `;
    }

    renderTable(items) {
        this.elTableCount.textContent = `${this.state.pagination?.total_rows || 0} Total`;

        if (!items || items.length === 0) {
            this.elTableBody.innerHTML = `
                <tr class="loading-row">
                    <td colspan="7">
                        <div class="empty-state-card">
                            <p style="font-size:1.8rem;margin-bottom:8px">📡</p>
                            <h3 style="font-size:1rem;color:var(--text-main);margin-bottom:4px">Belum Ada Data Pengukuran XRF</h3>
                            <p style="font-size:0.8rem;color:var(--text-muted)">Gunakan filter lain atau jalankan tes scan pada instrumen XRF Explorer 7000.</p>
                        </div>
                    </td>
                </tr>
            `;
            return;
        }

        let html = '';
        items.forEach((item, index) => {
            const modeBadgeClass = this.getModeBadgeClass(item.db_source);
            const formattedDate = this.formatDate(item.test_date);

            // Element badges (hanya 2 unsur teratas, sisanya '+X unsur lain')
            let elementBadges = '';
            if (item.elements && item.elements.length > 0) {
                const topElements = item.elements.slice(0, 2);
                elementBadges = topElements.map(el => {
                    let pillClass = 'element-pill';
                    if (el.concentration >= 10) pillClass += ' elem-high';
                    if (['Au', 'Pt', 'Pd', 'Ag'].includes(el.name)) pillClass += ' elem-gold';
                    return `
                        <span class="${pillClass}" title="Unsur: ${el.name}, Kadar: ${el.concentration}${el.unit}">
                            <span class="element-symbol">${this.escapeHtml(el.name)}</span>
                            <span class="element-val">${this.formatConcentration(el.concentration)}${this.escapeHtml(el.unit)}</span>
                        </span>
                    `;
                }).join('');

                if (item.elements.length > 2) {
                    elementBadges += `<span class="element-more">+${item.elements.length - 2} unsur lain</span>`;
                }
            } else {
                elementBadges = `<span class="element-empty">—</span>`;
            }

            html += `
                <tr data-id="${item.id}">
                    <td class="cell-date">
                        <div class="date-main">${formattedDate}</div>
                    </td>
                    <td class="cell-sample">
                        <div class="sample-title">${this.escapeHtml(item.sample_name || 'Tanpa Nama')}</div>
                        <div class="sample-sub">
                            <span class="sample-id">#${item.report_id || item.id}</span>
                            ${item.grade ? `<span class="badge-grade">${this.escapeHtml(item.grade)}</span>` : ''}
                        </div>
                    </td>
                    <td class="cell-mode">
                        <span class="badge-mode ${modeBadgeClass}">${this.escapeHtml(item.db_source || '—')}</span>
                        ${item.work_curve_name && item.work_curve_name !== 'Default' ? `<div class="curve-name">${this.escapeHtml(item.work_curve_name)}</div>` : ''}
                    </td>
                    <td class="cell-operator">
                        <div class="operator-name">${this.escapeHtml(item.operator || '—')}</div>
                        <div class="device-tag">${this.escapeHtml(item.device_id || 'XRF-7000')}</div>
                    </td>
                    <td class="cell-elements">
                        <div class="element-pill-container">${elementBadges}</div>
                    </td>
                    <td class="cell-specs">
                        <div>${item.tub_voltage} kV &bull; ${item.tub_current} µA</div>
                        <div class="specs-sub">${item.test_time}s &bull; ${Math.round(item.cps).toLocaleString()} cps</div>
                    </td>
                    <td class="cell-action">
                        <button class="btn btn-detail" data-idx="${index}" title="Lihat rincian lengkap hasil uji">
                            🔍 Detail
                        </button>
                    </td>
                </tr>
            `;
        });

        this.elTableBody.innerHTML = html;

        // Bind Detail Buttons
        this.elTableBody.querySelectorAll('.btn-detail').forEach(btn => {
            btn.addEventListener('click', () => {
                const idx = parseInt(btn.dataset.idx, 10);
                const item = this.state.data[idx];
                if (item) this.openModal(item);
            });
        });
    }

    renderPagination(pagination) {
        if (!pagination) return;
        const { current_page, total_pages, total_rows, limit } = pagination;

        const start = total_rows === 0 ? 0 : (current_page - 1) * limit + 1;
        const end = Math.min(current_page * limit, total_rows);

        this.elPageInfo.textContent = `Menampilkan ${start}–${end} dari ${total_rows.toLocaleString()} data`;

        let controlsHtml = '';
        controlsHtml += `
            <button class="page-btn" ${current_page <= 1 ? 'disabled' : ''} data-page="${current_page - 1}">◀ Prev</button>
        `;

        // Render page buttons (max 5 buttons)
        let startPage = Math.max(1, current_page - 2);
        let endPage = Math.min(total_pages, startPage + 4);
        if (endPage - startPage < 4) {
            startPage = Math.max(1, endPage - 4);
        }

        for (let p = startPage; p <= endPage; p++) {
            controlsHtml += `
                <button class="page-btn ${p === current_page ? 'active' : ''}" data-page="${p}">${p}</button>
            `;
        }

        controlsHtml += `
            <button class="page-btn" ${current_page >= total_pages ? 'disabled' : ''} data-page="${current_page + 1}">Next ▶</button>
        `;

        this.elPageControls.innerHTML = controlsHtml;

        this.elPageControls.querySelectorAll('.page-btn[data-page]').forEach(btn => {
            btn.addEventListener('click', () => {
                const p = parseInt(btn.dataset.page, 10);
                if (p && p !== this.state.page && p >= 1 && p <= total_pages) {
                    this.state.page = p;
                    this.loadData();
                }
            });
        });
    }

    openModal(item) {
        this.state.activeModalItem = item;

        this.elModalTitle.textContent = item.sample_name || 'Hasil Uji Spektrometri XRF';
        this.elModalSubtitle.textContent = `ID Laporan: #${item.report_id || item.id} · Waktu Scan: ${this.formatDate(item.test_date)} · Alat: ${item.device_id || 'XRF-7000'}`;

        // Tab 1: Elements Breakdown
        if (item.elements && item.elements.length > 0) {
            let maxConc = Math.max(...item.elements.map(e => e.concentration), 1);
            let totalMass = item.elements.reduce((sum, e) => sum + (e.unit === '%' ? e.concentration : 0), 0);

            let barsHtml = '';
            item.elements.forEach(el => {
                const pct = Math.min(100, Math.max(2, (el.concentration / maxConc) * 100));
                barsHtml += `
                    <div class="element-bar-card">
                        <div class="elem-bar-header">
                            <span class="elem-sym">${this.escapeHtml(el.name)}</span>
                            <span class="elem-conc">${this.formatConcentration(el.concentration)} <small style="font-size:0.75rem;color:var(--cyan)">${this.escapeHtml(el.unit)}</small></span>
                        </div>
                        <div class="elem-bar-track">
                            <div class="elem-bar-fill" style="width: ${pct}%;"></div>
                        </div>
                        <div class="elem-err">Margin Error: ±${el.error} ${this.escapeHtml(el.unit)}</div>
                    </div>
                `;
            });

            this.elModalElementsGrid.innerHTML = `
                <div style="margin-bottom:12px;display:flex;justify-content:space-between;align-items:center;background:rgba(255,255,255,0.03);padding:8px 12px;border-radius:6px;border:1px solid var(--border-subtle)">
                    <span style="font-size:0.78rem;color:var(--text-muted)">Total Unsur Terdeteksi: <strong>${item.elements.length} Unsur</strong></span>
                    <span style="font-size:0.78rem;color:var(--emerald);font-weight:700">Total Akumulasi (%): ${totalMass.toFixed(3)}%</span>
                </div>
                <div class="element-bars-grid">${barsHtml}</div>
            `;
        } else {
            this.elModalElementsGrid.innerHTML = `
                <div class="empty-state-card">
                    <p style="font-size:1.5rem;margin-bottom:4px">🧪</p>
                    <p style="color:var(--text-muted);font-size:0.85rem">Tidak ada data spektrum konsentrasi unsur untuk sampel ini.</p>
                </div>
            `;
        }

        // Tab 2: Technical Instrument Specs
        this.elModalSpecsGrid.innerHTML = `
            <div class="spec-item"><div class="label">Database Mode</div><div class="val" style="color:var(--cyan)">${this.escapeHtml(item.db_source || '—')}</div></div>
            <div class="spec-item"><div class="label">Kurva Kalibrasi</div><div class="val">${this.escapeHtml(item.work_curve_name || 'Default')}</div></div>
            <div class="spec-item"><div class="label">Grade Paduan / Logam</div><div class="val" style="color:var(--amber)">${this.escapeHtml(item.grade || '—')}</div></div>
            <div class="spec-item"><div class="label">Operator Penguji</div><div class="val">${this.escapeHtml(item.operator || '—')}</div></div>
            <div class="spec-item"><div class="label">Tegangan Tabung (Voltage)</div><div class="val">${item.tub_voltage} kV</div></div>
            <div class="spec-item"><div class="label">Arus Tabung (Current)</div><div class="val">${item.tub_current} µA</div></div>
            <div class="spec-item"><div class="label">Laju Pencacahan (CPS)</div><div class="val">${item.cps.toLocaleString()} cps</div></div>
            <div class="spec-item"><div class="label">Total Cacahan (Counts)</div><div class="val">${item.counts.toLocaleString()}</div></div>
            <div class="spec-item"><div class="label">Durasi Pengujian</div><div class="val">${item.test_time} Detik</div></div>
            <div class="spec-item"><div class="label">Peak / FWHM Spektrum</div><div class="val">${item.peak || '—'} / ${item.fwhm || '—'}</div></div>
            <div class="spec-item"><div class="label">Nama File Spektrum</div><div class="val" style="font-size:0.85rem;font-family:monospace">${this.escapeHtml(item.spectrum_name || '—')}</div></div>
            <div class="spec-item"><div class="label">Supplier / Asal Sampel</div><div class="val">${this.escapeHtml(item.sample_supplier || '—')}</div></div>
        `;

        // Tab 3: Environmental & Sensors
        this.elModalEnvGrid.innerHTML = `
            <div class="spec-item"><div class="label">Suhu Tabung X-Ray</div><div class="val" style="color:${item.temperature > 45 ? 'var(--rose)' : 'var(--emerald)'}">${item.temperature} °C</div></div>
            <div class="spec-item"><div class="label">Sensor Barometrik (Tekanan)</div><div class="val">${item.ms8607_pressure ? item.ms8607_pressure + ' hPa' : '—'}</div></div>
            <div class="spec-item"><div class="label">Suhu Lingkungan (MS8607)</div><div class="val">${item.ms8607_temperature ? item.ms8607_temperature + ' °C' : '—'}</div></div>
            <div class="spec-item"><div class="label">Kelembaban Udara</div><div class="val">${item.ms8607_humidity ? item.ms8607_humidity + ' %' : '—'}</div></div>
            <div class="spec-item"><div class="label">Koordinat GPS</div><div class="val" style="font-size:0.85rem;font-family:monospace">${this.escapeHtml(item.gps || '(0,0)')}</div></div>
            <div class="spec-item"><div class="label">Elevasi / Ketinggian</div><div class="val">${item.altitude} m</div></div>
            <div class="spec-item"><div class="label">IP Address Pengirim</div><div class="val" style="color:var(--cyan);font-family:monospace">${this.escapeHtml(item.client_ip || '—')}</div></div>
            <div class="spec-item"><div class="label">Waktu Diterima di Server</div><div class="val">${this.formatDate(item.received_at)}</div></div>
        `;

        this.elModalBackdrop.classList.add('open');
        document.body.classList.add('modal-open');
        document.documentElement.classList.add('modal-open');
    }

    closeModal() {
        this.elModalBackdrop.classList.remove('open');
        document.body.classList.remove('modal-open');
        document.documentElement.classList.remove('modal-open');
        this.state.activeModalItem = null;
    }

    exportCsv() {
        if (!this.state.data || this.state.data.length === 0) {
            this.showToast('Tidak ada data untuk diekspor.', 'warning');
            return;
        }

        const headers = ['ID', 'Waktu_Scan', 'Nama_Sampel', 'Report_ID', 'Mode_DB', 'Kurva_Kerja', 'Grade', 'Operator', 'Alat_ID', 'Voltage_kV', 'Current_uA', 'CPS', 'Durasi_s', 'Unsur_Konsentrasi'];
        const rows = this.state.data.map(item => {
            const elementsStr = (item.elements || []).map(e => `${e.name}:${e.concentration}${e.unit}`).join(';');
            return [
                item.id,
                `"${item.test_date || ''}"`,
                `"${(item.sample_name || '').replace(/"/g, '""')}"`,
                item.report_id || '',
                `"${item.db_source || ''}"`,
                `"${item.work_curve_name || ''}"`,
                `"${item.grade || ''}"`,
                `"${item.operator || ''}"`,
                `"${item.device_id || ''}"`,
                item.tub_voltage,
                item.tub_current,
                item.cps,
                item.test_time,
                `"${elementsStr}"`
            ].join(',');
        });

        const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows].join('\n');
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement('a');
        link.setAttribute('href', encodedUri);
        link.setAttribute('download', `xrf_export_${new Date().toISOString().slice(0,10)}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        this.showToast(`Berhasil mengekspor ${this.state.data.length} baris data ke CSV.`, 'success');
    }

    exportJson() {
        if (!this.state.data || this.state.data.length === 0) {
            this.showToast('Tidak ada data untuk diekspor.', 'warning');
            return;
        }

        const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(this.state.data, null, 2));
        const link = document.createElement('a');
        link.setAttribute('href', dataStr);
        link.setAttribute('download', `xrf_dataset_${new Date().toISOString().slice(0,10)}.json`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        this.showToast(`Berhasil mendownload ${this.state.data.length} sampel data ke format JSON.`, 'success');
    }

    showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        
        let icon = 'ℹ️';
        if (type === 'success') icon = '✅';
        if (type === 'warning') icon = '⚠️';

        toast.innerHTML = `<span>${icon}</span><div>${message}</div>`;
        this.elToastContainer.appendChild(toast);

        setTimeout(() => {
            toast.style.transition = 'all 0.3s ease';
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(100%)';
            setTimeout(() => toast.remove(), 300);
        }, 4000);
    }

    // ── Helper Utilities ──────────────────────────────────────────────────
    getModeBadgeClass(db) {
        if (!db) return 'mode-unknown';
        if (db === 'mineral.db') return 'mode-mineral';
        if (db === 'alloy.db') return 'mode-alloy';
        if (db === 'metal.db') return 'mode-metal';
        return 'mode-unknown';
    }

    formatNumber(num) {
        return (num || 0).toLocaleString('id-ID');
    }

    formatConcentration(val) {
        if (val === undefined || val === null) return '0';
        return Number(val) % 1 === 0 ? Number(val).toString() : Number(val).toFixed(3);
    }

    formatDate(dateStr) {
        if (!dateStr) return '—';
        const d = new Date(dateStr.replace(' ', 'T'));
        if (isNaN(d.getTime())) return dateStr;
        return d.toLocaleDateString('id-ID', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        }).replace(/\./g, ':');
    }

    timeAgo(dateStr) {
        if (!dateStr) return '';
        const d = new Date(dateStr.replace(' ', 'T'));
        if (isNaN(d.getTime())) return '';
        const sec = Math.floor((new Date() - d) / 1000);
        if (sec < 60) return 'Baru saja';
        const min = Math.floor(sec / 60);
        if (min < 60) return `${min} mnt lalu`;
        const hrs = Math.floor(min / 60);
        if (hrs < 24) return `${hrs} jam lalu`;
        const days = Math.floor(hrs / 24);
        return `${days} hari lalu`;
    }

    escapeHtml(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }
}

// Initialize on DOM Ready
document.addEventListener('DOMContentLoaded', () => {
    window.xrfApp = new XrfApp();
});
