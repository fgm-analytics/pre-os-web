-- Migrations 010: Fix Security Vulnerabilities
-- Resolves role escalation and excessively permissive policies

-- 1. Fix public.usuarios policies and role escalation
DROP POLICY IF EXISTS insert_update_usuarios ON public.usuarios;

-- Insert Policy
CREATE POLICY insert_usuarios ON public.usuarios
    FOR INSERT
    WITH CHECK (private.is_admin() OR auth.uid() = id);

-- Update Policy
CREATE POLICY update_usuarios ON public.usuarios
    FOR UPDATE
    USING (private.is_admin() OR auth.uid() = id)
    WITH CHECK (private.is_admin() OR auth.uid() = id);

-- Delete Policy
CREATE POLICY delete_usuarios ON public.usuarios
    FOR DELETE
    USING (private.is_admin() OR auth.uid() = id);

-- Trigger to prevent role escalation
CREATE OR REPLACE FUNCTION private.prevent_role_escalation()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.role IS DISTINCT FROM NEW.role THEN
        IF NOT private.is_admin() THEN
            RAISE EXCEPTION 'Acesso negado: apenas administradores podem alterar papeis (roles).';
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS prevent_role_escalation ON public.usuarios;
CREATE TRIGGER prevent_role_escalation
BEFORE UPDATE ON public.usuarios
FOR EACH ROW
EXECUTE FUNCTION private.prevent_role_escalation();

-- 2. Fix public tables with overly permissive USING (true) for all operations

-- config_produto
DROP POLICY IF EXISTS all_config_produto ON public.config_produto;
CREATE POLICY select_config_produto ON public.config_produto FOR SELECT USING (true);
CREATE POLICY modify_config_produto ON public.config_produto FOR ALL USING (private.is_admin());

-- f_shelf_life
DROP POLICY IF EXISTS all_f_shelf_life ON public.f_shelf_life;
CREATE POLICY select_f_shelf_life ON public.f_shelf_life FOR SELECT USING (true);
CREATE POLICY modify_f_shelf_life ON public.f_shelf_life FOR ALL USING (private.is_admin());

-- d_org_venda
DROP POLICY IF EXISTS all_d_org_venda ON public.d_org_venda;
CREATE POLICY select_d_org_venda ON public.d_org_venda FOR SELECT USING (true);
CREATE POLICY modify_d_org_venda ON public.d_org_venda FOR ALL USING (private.is_admin());

-- d_material
DROP POLICY IF EXISTS all_d_material ON public.d_material;
CREATE POLICY select_d_material ON public.d_material FOR SELECT USING (true);
CREATE POLICY modify_d_material ON public.d_material FOR ALL USING (private.is_admin());

-- f_preco_condicao
DROP POLICY IF EXISTS all_f_preco_condicao ON public.f_preco_condicao;
CREATE POLICY select_f_preco_condicao ON public.f_preco_condicao FOR SELECT USING (true);
CREATE POLICY modify_f_preco_condicao ON public.f_preco_condicao FOR ALL USING (private.is_admin());

-- f_ordem_faturamento
DROP POLICY IF EXISTS all_f_ordem_faturamento ON public.f_ordem_faturamento;
CREATE POLICY select_f_ordem_faturamento ON public.f_ordem_faturamento FOR SELECT USING (true);
CREATE POLICY modify_f_ordem_faturamento ON public.f_ordem_faturamento FOR ALL USING (private.is_admin());
