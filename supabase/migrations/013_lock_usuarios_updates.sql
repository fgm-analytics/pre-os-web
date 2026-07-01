-- Migration 013: Lock down usuarios updates to stop role changes from the API

-- Remove any older update policies that still allow self-service writes
DROP POLICY IF EXISTS update_usuarios ON public.usuarios;
DROP POLICY IF EXISTS insert_update_usuarios ON public.usuarios;

-- Only admins may update usuarios rows
CREATE POLICY update_usuarios ON public.usuarios
    FOR UPDATE
    USING (private.is_admin())
    WITH CHECK (private.is_admin());

-- Keep inserts admin-only as well
DROP POLICY IF EXISTS insert_usuarios ON public.usuarios;
CREATE POLICY insert_usuarios ON public.usuarios
    FOR INSERT
    WITH CHECK (private.is_admin());

-- Defense in depth: even if a broader policy appears later, role changes still fail
CREATE OR REPLACE FUNCTION private.prevent_role_escalation()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.role IS DISTINCT FROM NEW.role AND NOT private.is_admin() THEN
        RAISE EXCEPTION 'Acesso negado: apenas administradores podem alterar papeis (roles).';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS prevent_role_escalation ON public.usuarios;
CREATE TRIGGER prevent_role_escalation
BEFORE UPDATE ON public.usuarios
FOR EACH ROW
EXECUTE FUNCTION private.prevent_role_escalation();
