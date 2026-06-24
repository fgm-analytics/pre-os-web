-- Migrations 009: Atualização de tabelas do DWH e automatização da Tabela de Preços

-- 1. d_material: Refatoração para snake_case e adição de novas colunas
-- Primeiro, renomeamos as colunas existentes para snake_case
ALTER TABLE public.d_material RENAME COLUMN "Material" TO material;
ALTER TABLE public.d_material RENAME COLUMN "Grupo Principal" TO grupo_principal;

-- Adicionamos as novas colunas
ALTER TABLE public.d_material ADD COLUMN IF NOT EXISTS descricao TEXT;
ALTER TABLE public.d_material ADD COLUMN IF NOT EXISTS status_material TEXT;

-- 2. f_shelf_life: Adição de novas colunas
ALTER TABLE public.f_shelf_life ADD COLUMN IF NOT EXISTS texto_breve_material TEXT;
ALTER TABLE public.f_shelf_life ADD COLUMN IF NOT EXISTS data_producao DATE;
ALTER TABLE public.f_shelf_life ADD COLUMN IF NOT EXISTS data_vencimento DATE;
ALTER TABLE public.f_shelf_life ADD COLUMN IF NOT EXISTS quantidade_estoque NUMERIC;

-- 3. Criação da tabela f_preco_condicao
CREATE TABLE IF NOT EXISTS public.f_preco_condicao (
    id BIGSERIAL PRIMARY KEY,
    ov TEXT NOT NULL,
    item_ov TEXT NOT NULL,
    preco_zpr0 NUMERIC,
    cod_tipo_list_precos TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT unique_preco_condicao UNIQUE (ov, item_ov)
);
CREATE INDEX IF NOT EXISTS idx_f_preco_condicao_ov_item ON public.f_preco_condicao(ov, item_ov);

-- 4. Criação da tabela f_ordem_faturamento
CREATE TABLE IF NOT EXISTS public.f_ordem_faturamento (
    id BIGSERIAL PRIMARY KEY,
    chave_representante_ov TEXT NOT NULL,
    material TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT unique_ordem_faturamento UNIQUE (chave_representante_ov, material)
);
CREATE INDEX IF NOT EXISTS idx_f_ordem_faturamento_chave ON public.f_ordem_faturamento(chave_representante_ov);
CREATE INDEX IF NOT EXISTS idx_f_ordem_faturamento_material ON public.f_ordem_faturamento(material);

-- Habilitar RLS nas novas tabelas
ALTER TABLE public.f_preco_condicao ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.f_ordem_faturamento ENABLE ROW LEVEL SECURITY;

CREATE POLICY all_f_preco_condicao ON public.f_preco_condicao FOR ALL USING (true);
CREATE POLICY all_f_ordem_faturamento ON public.f_ordem_faturamento FOR ALL USING (true);

-- Recriar a view vw_produto_bu para usar as novas colunas
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
    COALESCE(m.grupo_principal, 'Geral') as categoria
FROM public.f_shelf_life f
JOIN public.d_org_venda d ON f.centro = d.centro
LEFT JOIN public.d_material m ON f.produto_codigo = m.material;
