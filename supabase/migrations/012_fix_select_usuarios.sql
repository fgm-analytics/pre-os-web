-- Migrations 012: Restrict select on usuarios table
-- Prevents non-admins (including gerentes) from seeing the entire user base

DROP POLICY IF EXISTS select_usuarios ON public.usuarios;

CREATE POLICY select_usuarios ON public.usuarios
    FOR SELECT
    USING (
        auth.uid() = id 
        OR public.is_admin()
        OR (
            salesforce_id IN (
                SELECT subordinado_salesforce_id FROM public.hierarquia_vendedores 
                WHERE gerente_salesforce_id = (SELECT u2.salesforce_id FROM public.usuarios u2 WHERE u2.id = auth.uid())
            )
        )
    );
