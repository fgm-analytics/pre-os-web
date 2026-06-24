-- Migrations 007: Tabela d_material e atualização da view vw_produto_bu

-- 1. Criação da tabela d_material (Espelho do DWH)
CREATE TABLE IF NOT EXISTS public.d_material (
    "Material" TEXT PRIMARY KEY,
    "Grupo Principal" TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Populating d_material with some basic mock data (the ETL will overwrite/insert the real ones)
-- We will insert a fallback row to avoid errors, but mostly the real DB will have this.

-- 2. Atualização da View para incluir a Categoria (Grupo Principal)
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
    COALESCE(m."Grupo Principal", 'Geral') as categoria
FROM public.f_shelf_life f
JOIN public.d_org_venda d ON f.centro = d.centro
LEFT JOIN public.d_material m ON f.produto_codigo = m."Material";

-- Enable RLS
ALTER TABLE public.d_material ENABLE ROW LEVEL SECURITY;

CREATE POLICY all_d_material ON public.d_material FOR ALL USING (true);
