-- Migrations 005: Tabela f_shelf_life e d_org_venda para classificação de Business Unit

-- 1. Table for d_org_venda (Domínio de Centros)
CREATE TABLE IF NOT EXISTS public.d_org_venda (
    centro TEXT PRIMARY KEY,
    descricao TEXT NOT NULL
);

-- Populating d_org_venda based on user mappings (exemplos de prefixo)
INSERT INTO public.d_org_venda (centro, descricao) VALUES 
('1100', 'Dentscare Matriz'),
('1101', 'Dentscare Filial'),
('2200', 'Whiteness Matriz'),
('4400', 'Home Care Matriz')
ON CONFLICT (centro) DO UPDATE SET descricao = EXCLUDED.descricao;

-- 2. Table for f_shelf_life (Produto -> Centro)
CREATE TABLE IF NOT EXISTS public.f_shelf_life (
    id BIGSERIAL PRIMARY KEY,
    produto_codigo TEXT NOT NULL,
    centro TEXT NOT NULL REFERENCES public.d_org_venda(centro),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT unique_produto_centro UNIQUE (produto_codigo)
);

CREATE INDEX IF NOT EXISTS idx_f_shelf_life_produto ON public.f_shelf_life(produto_codigo);

-- 3. View para mapeamento fácil na API
CREATE OR REPLACE VIEW public.vw_produto_bu AS
SELECT 
    f.produto_codigo,
    CASE 
        WHEN f.centro LIKE '11%' THEN 'Dentscare'
        WHEN f.centro LIKE '22%' THEN 'Whiteness'
        WHEN f.centro LIKE '44%' THEN 'Home_Care'
        ELSE 'Outros'
    END as business_unit
FROM public.f_shelf_life f
JOIN public.d_org_venda d ON f.centro = d.centro;

-- Enable RLS
ALTER TABLE public.f_shelf_life ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.d_org_venda ENABLE ROW LEVEL SECURITY;

CREATE POLICY all_f_shelf_life ON public.f_shelf_life FOR ALL USING (true);
CREATE POLICY all_d_org_venda ON public.d_org_venda FOR ALL USING (true);
