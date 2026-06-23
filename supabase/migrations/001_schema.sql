-- Migrations 001: Schema setup for FGM Performance Dashboard

-- Enable pgcrypto for UUID generation if needed
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Table for User profiles linked to Supabase Auth
CREATE TABLE IF NOT EXISTS public.usuarios (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    vendedor_code INTEGER, -- Salesforce SellerCode (nullable for non-sellers or managers who aren't direct sellers)
    salesforce_id TEXT,
    nome TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'vendedor' CHECK (role IN ('admin', 'gerente', 'vendedor')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Index for seller code lookup
CREATE INDEX IF NOT EXISTS idx_usuarios_vendedor_code ON public.usuarios(vendedor_code);

-- 2. Table for historical billing performance (2024, 2025, 2026 etc.)
-- Aggregated at: vendedor, cliente, ano, mes
CREATE TABLE IF NOT EXISTS public.historico_faturamento (
    id BIGSERIAL PRIMARY KEY,
    vendedor_code INTEGER NOT NULL,
    vendedor_nome TEXT NOT NULL,
    cliente_code TEXT NOT NULL,
    cliente_nome TEXT NOT NULL,
    ano INTEGER NOT NULL,
    mes INTEGER NOT NULL,
    realizado_faturamento NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    realizado_volume NUMERIC(15, 4) NOT NULL DEFAULT 0.0000,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT unique_historico UNIQUE (vendedor_code, cliente_code, ano, mes)
);

CREATE INDEX IF NOT EXISTS idx_historico_vendedor ON public.historico_faturamento(vendedor_code);
CREATE INDEX IF NOT EXISTS idx_historico_vendedor_ano_mes ON public.historico_faturamento(vendedor_code, ano, mes);
CREATE INDEX IF NOT EXISTS idx_historico_ano_mes ON public.historico_faturamento(ano, mes);

-- 3. Table for goals/performance target data for 2026
-- Aggregated at: vendedor, subgrupo, mes
CREATE TABLE IF NOT EXISTS public.performance_vendedor_2026 (
    id BIGSERIAL PRIMARY KEY,
    vendedor_code INTEGER NOT NULL,
    vendedor_nome TEXT NOT NULL,
    subgrupo TEXT NOT NULL, -- e.g., 'Dentscare', 'Home Care', 'Whiteness'
    mes INTEGER NOT NULL, -- 1 to 12
    meta_faturamento NUMERIC(15, 2) DEFAULT 0.00,
    realizado_faturamento NUMERIC(15, 2) DEFAULT 0.00,
    meta_volume NUMERIC(15, 4) DEFAULT 0.0000,
    realizado_volume NUMERIC(15, 4) DEFAULT 0.0000,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT unique_performance_2026 UNIQUE (vendedor_code, subgrupo, mes)
);

CREATE INDEX IF NOT EXISTS idx_perf_2026_vendedor ON public.performance_vendedor_2026(vendedor_code);
CREATE INDEX IF NOT EXISTS idx_perf_2026_vendedor_mes ON public.performance_vendedor_2026(vendedor_code, mes);
CREATE INDEX IF NOT EXISTS idx_perf_2026_subgrupo ON public.performance_vendedor_2026(subgrupo);
