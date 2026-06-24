-- Migrations 005: Tabela para acompanhar últimos pedidos dos clientes
-- Para uso na aba "Últimos Pedidos"

CREATE TABLE IF NOT EXISTS public.cliente_ultimo_pedido (
    id BIGSERIAL PRIMARY KEY,
    vendedor_code INTEGER NOT NULL,
    cliente_code TEXT NOT NULL,
    cliente_nome TEXT NOT NULL,
    data_ultimo_pedido DATE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT unique_cliente_ultimo_pedido UNIQUE (vendedor_code, cliente_code)
);

CREATE INDEX IF NOT EXISTS idx_cliente_ultimo_pedido_vendedor ON public.cliente_ultimo_pedido(vendedor_code);
CREATE INDEX IF NOT EXISTS idx_cliente_ultimo_pedido_cliente ON public.cliente_ultimo_pedido(cliente_code);

-- View para adicionar lógica de negócio e dias de forma dinâmica
CREATE OR REPLACE VIEW public.v_ultimos_pedidos WITH (security_invoker = true) AS
SELECT 
    vendedor_code,
    cliente_code,
    cliente_nome,
    data_ultimo_pedido,
    CURRENT_DATE - data_ultimo_pedido AS dias_desde_ultima_compra,
    CASE 
        WHEN CURRENT_DATE - data_ultimo_pedido <= 30 THEN 'Ativo'
        WHEN CURRENT_DATE - data_ultimo_pedido <= 60 THEN 'Oportunidade'
        WHEN CURRENT_DATE - data_ultimo_pedido <= 90 THEN 'Inativo'
        WHEN CURRENT_DATE - data_ultimo_pedido <= 365 THEN 'Crítico'
        ELSE 'Desativado'
    END AS oportunidade_recompra
FROM public.cliente_ultimo_pedido;

-- Enable RLS
ALTER TABLE public.cliente_ultimo_pedido ENABLE ROW LEVEL SECURITY;

-- Policies for cliente_ultimo_pedido
CREATE POLICY select_cliente_ultimo_pedido ON public.cliente_ultimo_pedido
    FOR SELECT
    USING (
        private.is_admin()
        OR vendedor_code = ANY(private.get_visible_seller_codes())
    );

CREATE POLICY all_cliente_ultimo_pedido ON public.cliente_ultimo_pedido
    FOR ALL
    USING (private.is_admin());
