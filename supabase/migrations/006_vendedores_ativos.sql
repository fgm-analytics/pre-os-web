-- Migrations 006: View para listagem rápida de vendedores ativos
CREATE OR REPLACE VIEW public.v_vendedores_ativos WITH (security_invoker = true) AS
SELECT DISTINCT
    vendedor_code,
    vendedor_nome
FROM public.historico_faturamento;
