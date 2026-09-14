-- ============================================================================
-- XRF Explorer 7000 — Database Migration & Initial Schema
-- Target Database: MySQL 8.0+ / MariaDB 10.4+
-- ============================================================================

CREATE DATABASE IF NOT EXISTS `labmineral` 
CHARACTER SET utf8mb4 
COLLATE utf8mb4_unicode_ci;

USE `labmineral`;

-- ----------------------------------------------------------------------------
-- Table 1: pengguna (User Authentication & Roles)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `pengguna` (
  `id` int NOT NULL AUTO_INCREMENT,
  `nama` varchar(100) NOT NULL,
  `username` varchar(50) NOT NULL,
  `password` varchar(255) NOT NULL,
  `email` varchar(100) DEFAULT NULL,
  `role` enum('admin','analis','klien','supervisor','client') DEFAULT 'analis',
  `status` enum('aktif','nonaktif') DEFAULT 'aktif',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `username` (`username`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- Table 2: xrf_devices (XRF Instrument Registry)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `xrf_devices` (
  `id` int NOT NULL AUTO_INCREMENT,
  `device_id` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'ID unik alat, misal: XRF-7000',
  `device_name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '' COMMENT 'Nama label alat',
  `device_type` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '' COMMENT 'Tipe hardware alat',
  `location` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '' COMMENT 'Lokasi fisik alat',
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `last_seen_at` datetime DEFAULT NULL COMMENT 'Waktu terakhir terdeteksi mengirim data',
  `registered_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `device_id` (`device_id`),
  KEY `idx_device_id` (`device_id`),
  KEY `idx_is_active` (`is_active`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Registri semua perangkat XRF yang terdaftar';

-- ----------------------------------------------------------------------------
-- Table 3: xrf_measurements (Core Spectrometry Scan Records)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `xrf_measurements` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `device_id` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'XRF-7000' COMMENT 'ID alat pengirim',
  `db_source` enum('metal.db','alloy.db','mineral.db','unknown') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'unknown' COMMENT 'File database SQLite sumber di alat',
  `report_id` int unsigned NOT NULL DEFAULT '0' COMMENT 'HistoryReportID dari SQLite alat',
  `sample_name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '' COMMENT 'Nama sampel / kode bor',
  `sample_supplier` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '' COMMENT 'Nama pemasok / asal sampel',
  `test_date` datetime NOT NULL COMMENT 'Tanggal & jam pengujian dari alat XRF',
  `timestamp_ms` bigint NOT NULL DEFAULT '0' COMMENT 'Unix timestamp milidetik dari alat',
  `test_time` smallint unsigned NOT NULL DEFAULT '0' COMMENT 'Durasi pengujian dalam detik',
  `tub_voltage` decimal(8,4) NOT NULL DEFAULT '0.0000' COMMENT 'Voltase tabung (V)',
  `tub_current` decimal(8,4) NOT NULL DEFAULT '0.0000' COMMENT 'Arus tabung (uA)',
  `peak` int NOT NULL DEFAULT '0' COMMENT 'Nilai peak spektrum',
  `fwhm` int NOT NULL DEFAULT '0' COMMENT 'Full Width Half Maximum',
  `cps` int NOT NULL DEFAULT '0' COMMENT 'Counts Per Second',
  `counts` int NOT NULL DEFAULT '0' COMMENT 'Total hitungan foton',
  `work_curve_name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '' COMMENT 'Nama kurva kerja',
  `grade` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '' COMMENT 'Grade material terdeteksi',
  `operator` varchar(60) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '' COMMENT 'Nama operator',
  `device_type` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '' COMMENT 'Tipe perangkat XRF',
  `spectrum_name` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '' COMMENT 'Nama spektrum',
  `test_point` tinyint NOT NULL DEFAULT '1' COMMENT 'Nomor titik uji',
  `temperature` decimal(8,4) NOT NULL DEFAULT '0.0000' COMMENT 'Suhu internal alat (C)',
  `ms8607_pressure` decimal(10,4) NOT NULL DEFAULT '0.0000' COMMENT 'Tekanan udara (hPa)',
  `ms8607_temperature` decimal(10,4) NOT NULL DEFAULT '0.0000' COMMENT 'Suhu lingkungan (C)',
  `ms8607_humidity` decimal(10,4) NOT NULL DEFAULT '0.0000' COMMENT 'Kelembaban relatif (%RH)',
  `gps` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '' COMMENT 'String GPS mentah',
  `longitude` decimal(11,8) NOT NULL DEFAULT '0.00000000' COMMENT 'Bujur',
  `latitude` decimal(10,8) NOT NULL DEFAULT '0.00000000' COMMENT 'Lintang',
  `altitude` decimal(10,4) NOT NULL DEFAULT '0.0000' COMMENT 'Ketinggian (m)',
  `client_ip` varchar(45) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '' COMMENT 'IP alat saat mengirim',
  `received_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Waktu server menerima data',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_device_report` (`device_id`,`db_source`,`report_id`,`timestamp_ms`),
  KEY `idx_device_id` (`device_id`),
  KEY `idx_db_source` (`db_source`),
  KEY `idx_test_date` (`test_date`),
  KEY `idx_received_at` (`received_at`),
  KEY `idx_sample_name` (`sample_name`),
  KEY `idx_device_report` (`device_id`,`db_source`,`report_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Data pengukuran XRF dari semua alat';

-- ----------------------------------------------------------------------------
-- Table 4: xrf_measurement_elements (Elemental Breakdown Breakdown Records)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `xrf_measurement_elements` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `measurement_id` bigint unsigned NOT NULL,
  `element_name` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Simbol elemen, misal: Fe, SiO2',
  `concentration` decimal(12,6) NOT NULL DEFAULT '0.000000' COMMENT 'Kadar (%)',
  `element_error` decimal(12,6) NOT NULL DEFAULT '0.000000' COMMENT 'Margin of error',
  `unit` varchar(10) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '%',
  PRIMARY KEY (`id`),
  KEY `idx_measurement_id` (`measurement_id`),
  KEY `idx_element_name` (`element_name`),
  CONSTRAINT `fk_xrf_elements_measurement` FOREIGN KEY (`measurement_id`) REFERENCES `xrf_measurements` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Hasil kadar unsur per pengukuran XRF';

-- ----------------------------------------------------------------------------
-- Table 5: xrf_admin_logs (System Access & Security Logs)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `xrf_admin_logs` (
  `id` int NOT NULL AUTO_INCREMENT,
  `pengguna_id` int DEFAULT NULL,
  `username` varchar(100) NOT NULL,
  `role` varchar(50) DEFAULT NULL,
  `device_id` varchar(100) DEFAULT NULL,
  `ip_address` varchar(50) DEFAULT NULL,
  `status` enum('SUCCESS','FAILED_PASSWORD','FAILED_ROLE','FAILED_USER') NOT NULL,
  `message` varchar(255) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- Initial Default Seed Data: Default Admin User & Default Device
-- Password default: 'password' (terenkripsi bcrypt $2y$10$...)
-- ----------------------------------------------------------------------------
INSERT INTO `pengguna` (`nama`, `username`, `password`, `email`, `role`, `status`)
VALUES 
  ('Administrator Lab', 'admin', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'admin@silab.local', 'admin', 'aktif')
ON DUPLICATE KEY UPDATE `status` = 'aktif';

INSERT INTO `xrf_devices` (`device_id`, `device_name`, `device_type`, `location`, `is_active`)
VALUES 
  ('XRF-7000', 'XRF Spectrometer Primary Lab', 'Handheld XRF Explorer', 'Ruang Analisis Spektrometri', 1)
ON DUPLICATE KEY UPDATE `is_active` = 1;
