-- Migrations 002: Hierarchy & Row Level Security (RLS) setup

-- 1. Table for Manager-Subordinate hierarchy (Salesforce sync)
CREATE TABLE IF NOT EXISTS public.hierarquia_vendedores (
    id BIGSERIAL PRIMARY KEY,
    gerente_salesforce_id TEXT NOT NULL,
    gerente_vendedor_code INTEGER,
    subordinado_salesforce_id TEXT NOT NULL,
    subordinado_vendedor_code INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT unique_hierarquia_link UNIQUE (gerente_salesforce_id, subordinado_salesforce_id)
);

CREATE INDEX IF NOT EXISTS idx_hierarquia_gerente_code ON public.hierarquia_vendedores(gerente_vendedor_code);
CREATE INDEX IF NOT EXISTS idx_hierarquia_subordinado_code ON public.hierarquia_vendedores(subordinado_vendedor_code);

-- Enable RLS on all tables
ALTER TABLE public.usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.historico_faturamento ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.performance_vendedor_2026 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hierarquia_vendedores ENABLE ROW LEVEL SECURITY;

-- 2. Helper function to check if the current user is an Admin
CREATE SCHEMA IF NOT EXISTS private;

DROP FUNCTION IF EXISTS public.is_admin();
CREATE OR REPLACE FUNCTION private.is_admin()
RETURNS BOOLEAN SECURITY DEFINER AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.usuarios
        WHERE id = auth.uid() AND role = 'admin'
    );
END;
$$ LANGUAGE plpgsql;

-- 3. Helper function to get all seller codes visible to the logged-in user
DROP FUNCTION IF EXISTS public.get_visible_seller_codes();
CREATE OR REPLACE FUNCTION private.get_visible_seller_codes()
RETURNS INTEGER[] SECURITY DEFINER AS $$
DECLARE
    user_role TEXT;
    user_seller_code INTEGER;
    user_sf_id TEXT;
    result_codes INTEGER[];
BEGIN
    -- Get user role and seller code
    SELECT role, vendedor_code, salesforce_id 
    INTO user_role, user_seller_code, user_sf_id
    FROM public.usuarios
    WHERE id = auth.uid();

    IF user_role = 'admin' THEN
        -- Admin can see all (handled directly in policies, but return empty or all if needed)
        RETURN NULL;
    ELSIF user_role = 'gerente' THEN
        -- Gerente sees self + all direct subordinates
        SELECT ARRAY_AGG(DISTINCT code) INTO result_codes
        FROM (
            SELECT user_seller_code AS code WHERE user_seller_code IS NOT NULL
            UNION
            SELECT subordinado_vendedor_code AS code 
            FROM public.hierarquia_vendedores
            WHERE gerente_salesforce_id = user_sf_id
        ) AS codes;
        RETURN result_codes;
    ELSE
        -- Vendedor sees only self
        RETURN ARRAY[user_seller_code];
    END IF;
END;
$$ LANGUAGE plpgsql;

-- 4. RLS Policies

-- Users profiles policy
CREATE POLICY select_usuarios ON public.usuarios
    FOR SELECT
    USING (
        auth.uid() = id 
        OR private.is_admin()
        -- Gerente can see subordinate profiles if needed
        OR (
            SELECT role FROM public.usuarios WHERE id = auth.uid()
        ) = 'gerente'
    );

CREATE POLICY insert_update_usuarios ON public.usuarios
    FOR ALL
    USING (private.is_admin() OR auth.uid() = id);

-- Historico Faturamento Policy
CREATE POLICY select_historico_faturamento ON public.historico_faturamento
    FOR SELECT
    USING (
        private.is_admin()
        OR vendedor_code = ANY(private.get_visible_seller_codes())
    );

CREATE POLICY all_historico_faturamento ON public.historico_faturamento
    FOR ALL
    USING (private.is_admin());

-- Performance Vendedor 2026 Policy
CREATE POLICY select_performance_vendedor ON public.performance_vendedor_2026
    FOR SELECT
    USING (
        private.is_admin()
        OR vendedor_code = ANY(private.get_visible_seller_codes())
    );

CREATE POLICY all_performance_vendedor ON public.performance_vendedor_2026
    FOR ALL
    USING (private.is_admin());

-- Hierarquia Vendedores Policy
CREATE POLICY select_hierarquia ON public.hierarquia_vendedores
    FOR SELECT
    USING (
        private.is_admin()
        OR gerente_salesforce_id = (SELECT salesforce_id FROM public.usuarios WHERE id = auth.uid())
    );

CREATE POLICY all_hierarquia ON public.hierarquia_vendedores
    FOR ALL
    USING (private.is_admin());
