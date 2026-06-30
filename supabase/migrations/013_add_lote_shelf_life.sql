-- Migrations 013: Adição da coluna lote e mudança de granularidade em f_shelf_life

-- 1. Adicionar coluna lote
ALTER TABLE public.f_shelf_life ADD COLUMN IF NOT EXISTS lote TEXT;

-- 2. Atualizar a constraint de unicidade
-- Remove a constraint antiga
ALTER TABLE public.f_shelf_life DROP CONSTRAINT IF EXISTS unique_produto_centro;

-- Como lote pode ser nulo para registros antigos antes de rodar o ETL, 
-- atualizamos para string vazia para garantir o funcionamento da constraint
UPDATE public.f_shelf_life SET lote = '' WHERE lote IS NULL;

-- Adiciona a nova constraint garantindo unicidade por produto E lote
ALTER TABLE public.f_shelf_life ADD CONSTRAINT unique_produto_lote UNIQUE (produto_codigo, lote);

-- 3. Atualizar a view vw_produto_bu para usar DISTINCT
-- Como f_shelf_life agora terá múltiplas linhas por produto (uma por lote),
-- a view de mapeamento deve usar DISTINCT para não duplicar o retorno na API de produtos.
DROP VIEW IF EXISTS public.vw_produto_bu;
CREATE OR REPLACE VIEW public.vw_produto_bu AS
SELECT DISTINCT
    f.produto_codigo,
    CASE 
        WHEN f.centro LIKE '11%' THEN 'Dentscare'
        WHEN f.centro LIKE '22%' THEN 'Whiteness'
        WHEN f.centro LIKE '44%' THEN 'Home_Care'
        ELSE 'Outros'
    END as business_unit,
    COALESCE(m.grupo_principal, 'Geral') as categoria
FROM public.f_shelf_life f
JOIN public.d_org_venda d ON f.centro = d.centro
LEFT JOIN public.d_material m ON f.produto_codigo = m.material;
