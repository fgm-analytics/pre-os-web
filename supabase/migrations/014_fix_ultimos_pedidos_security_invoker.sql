-- Migrations 014: Fix security_invoker on v_ultimos_pedidos to enforce RLS

ALTER VIEW public.v_ultimos_pedidos SET (security_invoker = true);
