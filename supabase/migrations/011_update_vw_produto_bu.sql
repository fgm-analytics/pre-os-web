-- Migrations 011: Atualiza view vw_produto_bu para incluir campos da f_shelf_life

DROP VIEW IF EXISTS public.vw_produto_bu;
CREATE OR REPLACE VIEW public.vw_produto_bu AS
SELECT 
    f.produto_codigo,
    CASE 
        WHEN f.centro LIKE '11%' THEN 'Dentscare'
        WHEN f.centro LIKE '22%' THEN 'Whiteness'
        WHEN f.centro LIKE '44%' THEN 'Home_Care'
        ELSE 'Outros'
    END as business_unit,
    COALESCE(m.grupo_principal, 'Geral') as categoria,
    f.texto_breve_material,
    f.data_vencimento,
    f.quantidade_estoque
FROM public.f_shelf_life f
JOIN public.d_org_venda d ON f.centro = d.centro
LEFT JOIN public.d_material m ON f.produto_codigo = m.material;
