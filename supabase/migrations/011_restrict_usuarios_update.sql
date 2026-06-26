-- Migrations 011: Restrict usuarios update and insert
-- Prevents users from updating their own profiles (including their roles) via the API

-- Drop the overly permissive policies
DROP POLICY IF EXISTS insert_update_usuarios ON public.usuarios;
DROP POLICY IF EXISTS insert_usuarios ON public.usuarios;
DROP POLICY IF EXISTS update_usuarios ON public.usuarios;

-- Create strict policies that only allow admins to insert or update
CREATE POLICY insert_usuarios ON public.usuarios
    FOR INSERT
    WITH CHECK (public.is_admin());

CREATE POLICY update_usuarios ON public.usuarios
    FOR UPDATE
    USING (public.is_admin())
    WITH CHECK (public.is_admin());
