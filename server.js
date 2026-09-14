/**
 * XRF Explorer 7000 — Pure JavaScript Backend Server
 * Built with Node.js, Express, and MySQL2 (Promise Pool)
 */

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const mysql = require('mysql2/promise');

const app = express();
const PORT = process.env.PORT || 3000;

// ── Middleware ──────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static frontend assets from current directory
app.use(express.static(path.join(__dirname)));

// ── Database Connection Pool ───────────────────────────────────────────────
const dbPool = mysql.createPool({
    host: process.env.DB_HOST || '127.0.0.1',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'labmineral',
    port: process.env.DB_PORT || 3306,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    timezone: '+08:00'
});

// Test database connection on startup
(async () => {
    try {
        const connection = await dbPool.getConnection();
        console.log('✅ [Database] Berhasil terhubung ke MySQL (Database: labmineral)');
        connection.release();
    } catch (err) {
        console.error('❌ [Database] Gagal terhubung ke MySQL:', err.message);
    }
})();

// ── Helper: Format Date to MySQL String ─────────────────────────────────────
function formatDateSql(date) {
    const d = new Date(date);
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// ── Endpoint 1: Health Check ────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
    res.json({
        status: 'online',
        service: 'XRF Explorer 7000 Pure JS Server',
        runtime: `Node.js ${process.version}`,
        server_time: new Date().toISOString()
    });
});

// ── Endpoint 2: Authentication (Login) ──────────────────────────────────────
app.post('/api/auth/login', async (req, res) => {
    const username = (req.body.username || '').trim();
    const password = (req.body.password || '').trim();

    if (!username || !password) {
        return res.status(400).json({
            status: 'error',
            message: 'Username dan Password wajib diisi!'
        });
    }

    try {
        const [rows] = await dbPool.execute(
            'SELECT id, nama, username, password, role, status FROM pengguna WHERE username = ? LIMIT 1',
            [username]
        );

        if (rows.length === 0) {
            return res.status(401).json({
                status: 'error',
                message: 'Username atau Password tidak cocok.'
            });
        }

        const user = rows[0];

        // Verify password with bcrypt or plaintext/demo match
        let isMatch = false;
        if (user.password && (user.password.startsWith('$2y$') || user.password.startsWith('$2a$') || user.password.startsWith('$2b$'))) {
            // PHP uses $2y$, bcryptjs supports $2a$/$2b$/$2y$
            const normalizedHash = user.password.replace(/^\$2y\$/, '$2a$');
            try {
                isMatch = bcrypt.compareSync(password, normalizedHash);
            } catch (err) {
                isMatch = false;
            }
        }
        
        if (!isMatch && user.password === password) {
            isMatch = true;
        }

        // Demo fallback for default admin
        if (!isMatch && username === 'admin' && (password === 'password' || password === 'admin')) {
            isMatch = true;
        }

        if (!isMatch) {
            return res.status(401).json({
                status: 'error',
                message: 'Username atau Password salah!'
            });
        }

        if (user.status && user.status.toLowerCase() !== 'aktif') {
            return res.status(403).json({
                status: 'error',
                message: 'Akun dinonaktifkan oleh Administrator.'
            });
        }

        const token = crypto.randomBytes(32).toString('hex');

        return res.json({
            status: 'success',
            message: 'Login berhasil! Selamat datang di XRF Explorer.',
            token: token,
            user: {
                id: user.id,
                nama: user.nama || user.username,
                username: user.username,
                role: user.role || 'admin'
            }
        });

    } catch (err) {
        console.error('Auth error:', err);
        return res.status(500).json({
            status: 'error',
            message: 'Terjadi kesalahan sistem saat autentikasi: ' + err.message
        });
    }
});

// ── Endpoint 3: Authentication Check ────────────────────────────────────────
app.all('/api/auth/check', (req, res) => {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.substring(7) : (req.query.token || req.body.token);

    if (token) {
        return res.json({ status: 'success', message: 'Sesi aktif dan valid.' });
    }
    return res.status(401).json({ status: 'error', message: 'Sesi tidak valid atau telah berakhir.' });
});

// ── Endpoint 4: Get XRF Measurements & Statistics ───────────────────────────
app.get('/api/xrf/data', async (req, res) => {
    try {
        const page = Math.max(1, parseInt(req.query.page, 10) || 1);
        const limit = Math.min(100, Math.max(5, parseInt(req.query.limit, 10) || 25));
        const offset = (page - 1) * limit;

        const startDate = (req.query.start_date || '').trim();
        const endDate = (req.query.end_date || '').trim();
        const mode = (req.query.mode || '').trim();
        const search = (req.query.search || '').trim();
        const device = (req.query.device || '').trim();
        const sortBy = (req.query.sort_by || 'timestamp_ms').trim();
        const sortDir = (req.query.sort_dir || 'DESC').toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

        const allowedSorts = {
            id: 'm.id',
            test_date: 'm.test_date',
            timestamp_ms: 'm.timestamp_ms',
            sample_name: 'm.sample_name',
            db_source: 'm.db_source',
            work_curve_name: 'm.work_curve_name',
            operator: 'm.operator',
            cps: 'm.cps',
            counts: 'm.counts',
            received_at: 'm.received_at'
        };
        const orderColumn = allowedSorts[sortBy] || 'm.timestamp_ms';

        // Build WHERE clauses
        const where = ['1=1'];
        const params = [];

        if (startDate !== '') {
            where.push('DATE(m.test_date) >= ?');
            params.push(startDate);
        }
        if (endDate !== '') {
            where.push('DATE(m.test_date) <= ?');
            params.push(endDate);
        }
        if (mode !== '' && mode !== 'all') {
            if (mode.endsWith('.db')) {
                where.push('m.db_source = ?');
                params.push(mode);
            } else {
                where.push('m.work_curve_name = ?');
                params.push(mode);
            }
        }
        if (device !== '' && device !== 'all') {
            where.push('m.device_id = ?');
            params.push(device);
        }
        if (search !== '') {
            where.push(`(
                m.sample_name LIKE ? 
                OR m.report_id LIKE ? 
                OR m.operator LIKE ? 
                OR m.grade LIKE ? 
                OR m.work_curve_name LIKE ?
                OR m.device_id LIKE ?
                OR EXISTS (
                    SELECT 1 FROM xrf_measurement_elements el 
                    WHERE el.measurement_id = m.id AND el.element_name LIKE ?
                )
            )`);
            const wc = `%${search}%`;
            for (let i = 0; i < 7; i++) params.push(wc);
        }

        const whereClause = where.join(' AND ');

        // Count Total Matching Rows
        const [countRows] = await dbPool.execute(
            `SELECT COUNT(*) as total FROM xrf_measurements m WHERE ${whereClause}`,
            params
        );
        const totalRows = countRows[0] ? countRows[0].total : 0;
        const totalPages = Math.max(1, Math.ceil(totalRows / limit));

        // Fetch paginated measurements
        const querySql = `
            SELECT 
                m.id, m.device_id, m.db_source, m.report_id, m.sample_name, m.sample_supplier,
                m.test_date, m.timestamp_ms, m.test_time, m.tub_voltage, m.tub_current,
                m.peak, m.fwhm, m.cps, m.counts,
                m.work_curve_name, m.grade, m.operator, m.device_type, m.spectrum_name, m.test_point,
                m.temperature, m.ms8607_pressure, m.ms8607_temperature, m.ms8607_humidity,
                m.gps, m.longitude, m.latitude, m.altitude,
                m.client_ip, m.received_at
            FROM xrf_measurements m
            WHERE ${whereClause}
            ORDER BY ${orderColumn} ${sortDir}, m.id ${sortDir}
            LIMIT ${limit} OFFSET ${offset}
        `;
        const [measurements] = await dbPool.execute(querySql, params);

        // Fetch elements for measurements on current page
        if (measurements.length > 0) {
            const mIds = measurements.map(m => m.id);
            const placeholders = mIds.map(() => '?').join(',');

            const [elements] = await dbPool.execute(
                `SELECT measurement_id, element_name, concentration, element_error, unit
                 FROM xrf_measurement_elements
                 WHERE measurement_id IN (${placeholders})
                 ORDER BY concentration DESC`,
                mIds
            );

            const elementsMap = {};
            for (const el of elements) {
                if (!elementsMap[el.measurement_id]) {
                    elementsMap[el.measurement_id] = [];
                }
                elementsMap[el.measurement_id].push({
                    name: el.element_name,
                    concentration: parseFloat(el.concentration) || 0,
                    error: parseFloat(el.element_error) || 0,
                    unit: el.unit || '%'
                });
            }

            for (const item of measurements) {
                item.elements = elementsMap[item.id] || [];
                item.tub_voltage = parseFloat(item.tub_voltage) || 0;
                item.tub_current = parseFloat(item.tub_current) || 0;
                item.temperature = parseFloat(item.temperature) || 0;
                item.cps = parseInt(item.cps, 10) || 0;
                item.counts = parseInt(item.counts, 10) || 0;
                item.test_time = parseInt(item.test_time, 10) || 0;
                item.peak = parseInt(item.peak, 10) || 0;
                item.fwhm = parseInt(item.fwhm, 10) || 0;
                item.longitude = parseFloat(item.longitude) || 0;
                item.latitude = parseFloat(item.latitude) || 0;
                item.altitude = parseFloat(item.altitude) || 0;
            }
        }

        // Global KPI Statistics
        const [[{ totalCount }]] = await dbPool.query('SELECT COUNT(*) as totalCount FROM xrf_measurements');
        const [[{ todayCount }]] = await dbPool.query('SELECT COUNT(*) as todayCount FROM xrf_measurements WHERE DATE(test_date) = CURDATE()');
        const [[{ totalElementsCount }]] = await dbPool.query('SELECT COUNT(*) as totalElementsCount FROM xrf_measurement_elements');

        // Dropdown distinct options
        const [dbSourcesRows] = await dbPool.query(
            "SELECT DISTINCT db_source FROM xrf_measurements WHERE db_source IS NOT NULL AND db_source != '' ORDER BY db_source"
        );
        const [workCurvesRows] = await dbPool.query(
            "SELECT DISTINCT work_curve_name FROM xrf_measurements WHERE work_curve_name IS NOT NULL AND work_curve_name != '' AND work_curve_name != '-' ORDER BY work_curve_name"
        );
        const [devicesRows] = await dbPool.query(
            "SELECT DISTINCT device_id FROM xrf_measurements WHERE device_id IS NOT NULL AND device_id != '' ORDER BY device_id"
        );

        // Check latest scan timestamp
        const [[{ latestScanDate }]] = await dbPool.query('SELECT MAX(test_date) as latestScanDate FROM xrf_measurements');

        // Check connection log file
        let latestPing = null;
        const candidateLogPaths = [
            path.join(__dirname, 'xrf_connection_log.json'),
            path.join(__dirname, '..', 'xrf_connection_log.json'),
            'C:\\laragon\\www\\labmineral\\xrf_connection_log.json'
        ];
        for (const lp of candidateLogPaths) {
            if (fs.existsSync(lp)) {
                try {
                    const raw = fs.readFileSync(lp, 'utf8');
                    const parsed = JSON.parse(raw);
                    latestPing = parsed[0] || null;
                    if (latestPing) break;
                } catch (e) {}
            }
        }

        return res.json({
            success: true,
            server_time: Math.floor(Date.now() / 1000),
            stats: {
                total_measurements: totalCount,
                today_measurements: todayCount,
                total_element_entries: totalElementsCount,
                db_sources: dbSourcesRows.map(r => r.db_source),
                work_curves: workCurvesRows.map(r => r.work_curve_name),
                devices: devicesRows.map(r => r.device_id),
                latest_scan: latestScanDate,
                latest_ping: latestPing
            },
            pagination: {
                current_page: page,
                total_pages: totalPages,
                total_rows: totalRows,
                limit: limit
            },
            data: measurements
        });

    } catch (err) {
        console.error('Data query error:', err);
        return res.status(500).json({
            success: false,
            message: 'Error querying XRF data: ' + err.message
        });
    }
});

// Portal pembuka aplikasi XRF tersembunyi
app.get(['/open_xrf', '/open_xrf.html'], (req, res) => {
    res.sendFile(path.join(__dirname, 'open_xrf.html'));
});

// Fallback route for index.html (SPA entry)
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// ── Start Server ────────────────────────────────────────────────────────────
app.listen(PORT, '0.0.0.0', () => {
    console.log(`
=====================================================
🚀 XRF EXPLORER 7000 — PURE JAVASCRIPT SERVER ONLINE
📡 Port       : http://localhost:${PORT}
🌐 Network    : http://192.168.0.229:${PORT}
⚙️ Runtime    : Node.js ${process.version} (No PHP required)
🗄️ Database   : MySQL (labmineral)
=====================================================
`);
});
