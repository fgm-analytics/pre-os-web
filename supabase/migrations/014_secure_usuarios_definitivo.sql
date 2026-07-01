-- Migration 014: Secure usuarios table against privilege escalation

-- 1. Remove all old update policies for public.usuarios to avoid conflicts
DROP POLICY IF EXISTS update_usuarios ON public.usuarios;
DROP POLICY IF EXISTS insert_update_usuarios ON public.usuarios;

-- 2. Create the definitive UPDATE policy: only admins can update
CREATE POLICY update_usuarios ON public.usuarios
    FOR UPDATE
    USING (private.is_admin())
    WITH CHECK (private.is_admin());

-- 3. Enforce the INSERT policy: only admins can insert (re-affirming from 013 to be safe)
DROP POLICY IF EXISTS insert_usuarios ON public.usuarios;
CREATE POLICY insert_usuarios ON public.usuarios
    FOR INSERT
    WITH CHECK (private.is_admin());

-- 4. Extend the trigger to prevent changing ANY sensitive field for non-admins
-- This is defense-in-depth in case another policy gets added in the future
CREATE OR REPLACE FUNCTION private.prevent_role_escalation()
RETURNS TRIGGER AS $$
BEGIN
    IF NOT private.is_admin() THEN
        IF OLD.role IS DISTINCT FROM NEW.role THEN
            RAISE EXCEPTION 'Acesso negado: apenas administradores podem alterar papeis (roles).';
        END IF;
        
        IF OLD.id IS DISTINCT FROM NEW.id THEN
            RAISE EXCEPTION 'Acesso negado: ID do usuario nao pode ser alterado.';
        END IF;

        IF OLD.salesforce_id IS DISTINCT FROM NEW.salesforce_id THEN
            RAISE EXCEPTION 'Acesso negado: salesforce_id nao pode ser alterado por usuarios comuns.';
        END IF;

        IF OLD.vendedor_code IS DISTINCT FROM NEW.vendedor_code THEN
            RAISE EXCEPTION 'Acesso negado: vendedor_code nao pode ser alterado por usuarios comuns.';
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Recreate the trigger
DROP TRIGGER IF EXISTS prevent_role_escalation ON public.usuarios;
CREATE TRIGGER prevent_role_escalation
BEFORE UPDATE ON public.usuarios
FOR EACH ROW
EXECUTE FUNCTION private.prevent_role_escalation();
