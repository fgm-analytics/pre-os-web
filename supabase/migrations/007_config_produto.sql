-- Migrations 006: Tabela config_produto para armazenar configurações do Editor Admin

CREATE TABLE IF NOT EXISTS public.config_produto (
    produto_codigo TEXT PRIMARY KEY,
    business_unit  TEXT,    -- Permite mover o produto de aba (override: 'Dentscare', 'Home_Care', 'Whiteness')
    cor            TEXT NOT NULL DEFAULT 'dark_gray',
    segmentacao    NUMERIC(5,2) NOT NULL DEFAULT 40,
    ipi            NUMERIC(5,2) NOT NULL DEFAULT 0,
    ordem_exibicao INTEGER, -- Mantém a sequência
    created_at     TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at     TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.config_produto ENABLE ROW LEVEL SECURITY;

-- Allow all (adjust policies as needed for prod)
CREATE POLICY all_config_produto ON public.config_produto FOR ALL USING (true);
