-- Migrations 012: Secure select_usuarios policy and fix performance loops

-- 1. Create or replace private schema functions with STABLE to prevent N+1 planner issues
CREATE SCHEMA IF NOT EXISTS private;

CREATE OR REPLACE FUNCTION private.get_my_role()
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN (SELECT role FROM public.usuarios WHERE id = auth.uid());
END;
$$;

CREATE OR REPLACE FUNCTION private.is_admin()
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.usuarios
        WHERE id = auth.uid() AND role = 'admin'
    );
END;
$$;

CREATE OR REPLACE FUNCTION private.get_my_salesforce_id()
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN (SELECT salesforce_id FROM public.usuarios WHERE id = auth.uid());
END;
$$;

CREATE OR REPLACE FUNCTION private.get_visible_seller_codes()
RETURNS integer[]
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    user_role TEXT;
    user_seller_code INTEGER;
    user_sf_id TEXT;
    result_codes INTEGER[];
BEGIN
    SELECT role, vendedor_code, salesforce_id 
    INTO user_role, user_seller_code, user_sf_id
    FROM public.usuarios
    WHERE id = auth.uid();

    IF user_role = 'admin' THEN
        RETURN NULL;
    ELSIF user_role = 'gerente' THEN
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
        RETURN ARRAY[user_seller_code];
    END IF;
END;
$$;

-- 2. Clean up any rogue public schema functions that shouldn't be there
-- Using CASCADE will drop policies depending on them, which we recreate below
DROP FUNCTION IF EXISTS public.is_admin() CASCADE;
DROP FUNCTION IF EXISTS public.get_my_role() CASCADE;
DROP FUNCTION IF EXISTS public.get_my_salesforce_id() CASCADE;
DROP FUNCTION IF EXISTS public.get_visible_seller_codes() CASCADE;

-- 3. Recreate policies for historico_faturamento
DROP POLICY IF EXISTS select_historico_faturamento ON public.historico_faturamento;
DROP POLICY IF EXISTS all_historico_faturamento ON public.historico_faturamento;

CREATE POLICY select_historico_faturamento ON public.historico_faturamento
    FOR SELECT
    USING (
        private.is_admin()
        OR vendedor_code = ANY(private.get_visible_seller_codes())
    );

CREATE POLICY all_historico_faturamento ON public.historico_faturamento
    FOR ALL
    USING (private.is_admin());

-- 4. Recreate policies for performance_vendedor_2026
DROP POLICY IF EXISTS select_performance_vendedor ON public.performance_vendedor_2026;
DROP POLICY IF EXISTS all_performance_vendedor ON public.performance_vendedor_2026;

CREATE POLICY select_performance_vendedor ON public.performance_vendedor_2026
    FOR SELECT
    USING (
        private.is_admin()
        OR vendedor_code = ANY(private.get_visible_seller_codes())
    );

CREATE POLICY all_performance_vendedor ON public.performance_vendedor_2026
    FOR ALL
    USING (private.is_admin());

-- 5. Recreate policies for hierarquia_vendedores
DROP POLICY IF EXISTS select_hierarquia ON public.hierarquia_vendedores;
DROP POLICY IF EXISTS all_hierarquia ON public.hierarquia_vendedores;

CREATE POLICY select_hierarquia ON public.hierarquia_vendedores
    FOR SELECT
    USING (
        private.is_admin()
        OR gerente_salesforce_id = private.get_my_salesforce_id()
    );

CREATE POLICY all_hierarquia ON public.hierarquia_vendedores
    FOR ALL
    USING (private.is_admin());

-- 6. Restrict policies on public.usuarios
DROP POLICY IF EXISTS select_usuarios ON public.usuarios;
DROP POLICY IF EXISTS insert_usuarios ON public.usuarios;
DROP POLICY IF EXISTS update_usuarios ON public.usuarios;
DROP POLICY IF EXISTS delete_usuarios ON public.usuarios;
DROP POLICY IF EXISTS insert_update_usuarios ON public.usuarios;

CREATE POLICY insert_usuarios ON public.usuarios
    FOR INSERT
    WITH CHECK (private.is_admin());

CREATE POLICY update_usuarios ON public.usuarios
    FOR UPDATE
    USING (private.is_admin() OR auth.uid() = id)
    WITH CHECK (private.is_admin() OR auth.uid() = id);

CREATE POLICY delete_usuarios ON public.usuarios
    FOR DELETE
    USING (private.is_admin());

CREATE POLICY select_usuarios ON public.usuarios
    FOR SELECT
    USING (
        auth.uid() = id 
        OR private.is_admin()
        OR (
            salesforce_id IN (
                SELECT subordinado_salesforce_id FROM public.hierarquia_vendedores 
                WHERE gerente_salesforce_id = private.get_my_salesforce_id()
            )
        )
    );
