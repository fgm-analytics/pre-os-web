-- Migrations 004: Tabela detalhada por Cliente e Produto para a aba Valores Clientes Produtos

-- 1. Table for historical billing performance grouped by vendedor, cliente, subgrupo, ano, mes
CREATE TABLE IF NOT EXISTS public.historico_cliente_produto (
    id BIGSERIAL PRIMARY KEY,
    vendedor_code INTEGER NOT NULL,
    vendedor_nome TEXT NOT NULL,
    cliente_code TEXT NOT NULL,
    cliente_nome TEXT NOT NULL,
    subgrupo TEXT NOT NULL,
    ano INTEGER NOT NULL,
    mes INTEGER NOT NULL,
    realizado_faturamento NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    realizado_volume NUMERIC(15, 4) NOT NULL DEFAULT 0.0000,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT unique_historico_cp UNIQUE (vendedor_code, cliente_code, subgrupo, ano, mes)
);

CREATE INDEX IF NOT EXISTS idx_hist_cp_vendedor ON public.historico_cliente_produto(vendedor_code);
CREATE INDEX IF NOT EXISTS idx_hist_cp_cliente ON public.historico_cliente_produto(cliente_code);

-- 2. Table for goals/performance target data for 2026 grouped by vendedor, cliente, subgrupo, mes
CREATE TABLE IF NOT EXISTS public.meta_cliente_produto_2026 (
    id BIGSERIAL PRIMARY KEY,
    vendedor_code INTEGER NOT NULL,
    vendedor_nome TEXT NOT NULL,
    cliente_code TEXT NOT NULL,
    cliente_nome TEXT NOT NULL,
    subgrupo TEXT NOT NULL,
    mes INTEGER NOT NULL, -- 1 to 12
    meta_faturamento NUMERIC(15, 2) DEFAULT 0.00,
    meta_volume NUMERIC(15, 4) DEFAULT 0.0000,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT unique_meta_cp_2026 UNIQUE (vendedor_code, cliente_code, subgrupo, mes)
);

CREATE INDEX IF NOT EXISTS idx_meta_cp_2026_vendedor ON public.meta_cliente_produto_2026(vendedor_code);
CREATE INDEX IF NOT EXISTS idx_meta_cp_2026_cliente ON public.meta_cliente_produto_2026(cliente_code);

-- Enable RLS
ALTER TABLE public.historico_cliente_produto ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meta_cliente_produto_2026 ENABLE ROW LEVEL SECURITY;

-- Policies for historico_cliente_produto
CREATE POLICY "Admins ver tudo historico_cp"
ON public.historico_cliente_produto
FOR ALL
TO authenticated
USING (
    EXISTS (SELECT 1 FROM public.usuarios WHERE email = auth.jwt() ->> 'email' AND role = 'admin')
);

CREATE POLICY "Vendedor ver proprio historico_cp"
ON public.historico_cliente_produto
FOR SELECT
TO authenticated
USING (
    vendedor_code IN (
        SELECT u.vendedor_code 
        FROM public.usuarios u 
        WHERE u.email = auth.jwt() ->> 'email' AND u.role = 'vendedor'
    )
);

CREATE POLICY "Gerente ver subordinados historico_cp"
ON public.historico_cliente_produto
FOR SELECT
TO authenticated
USING (
    vendedor_code IN (
        SELECT h.subordinado_vendedor_code
        FROM public.hierarquia_vendedores h
        JOIN public.usuarios u ON h.gerente_salesforce_id = u.salesforce_id
        WHERE u.email = auth.jwt() ->> 'email' AND u.role = 'gerente'
    )
    OR
    vendedor_code IN (
        SELECT u.vendedor_code 
        FROM public.usuarios u 
        WHERE u.email = auth.jwt() ->> 'email' AND u.role = 'gerente'
    )
);

-- Policies for meta_cliente_produto_2026
CREATE POLICY "Admins ver tudo meta_cp"
ON public.meta_cliente_produto_2026
FOR ALL
TO authenticated
USING (
    EXISTS (SELECT 1 FROM public.usuarios WHERE email = auth.jwt() ->> 'email' AND role = 'admin')
);

CREATE POLICY "Vendedor ver proprio meta_cp"
ON public.meta_cliente_produto_2026
FOR SELECT
TO authenticated
USING (
    vendedor_code IN (
        SELECT u.vendedor_code 
        FROM public.usuarios u 
        WHERE u.email = auth.jwt() ->> 'email' AND u.role = 'vendedor'
    )
);

CREATE POLICY "Gerente ver subordinados meta_cp"
ON public.meta_cliente_produto_2026
FOR SELECT
TO authenticated
USING (
    vendedor_code IN (
        SELECT h.subordinado_vendedor_code
        FROM public.hierarquia_vendedores h
        JOIN public.usuarios u ON h.gerente_salesforce_id = u.salesforce_id
        WHERE u.email = auth.jwt() ->> 'email' AND u.role = 'gerente'
    )
    OR
    vendedor_code IN (
        SELECT u.vendedor_code 
        FROM public.usuarios u 
        WHERE u.email = auth.jwt() ->> 'email' AND u.role = 'gerente'
    )
);
